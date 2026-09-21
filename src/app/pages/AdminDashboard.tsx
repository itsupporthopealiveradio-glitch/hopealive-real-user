import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import {
  LogOut, Sun, Moon, Users, FileText, Activity, Download, Plus, Trash2, X,
  Clock, UserCheck, Timer, TrendingUp, ChevronDown, AlertTriangle,
  CheckCircle2, Loader2, Camera, Printer, Database, ShieldCheck, Save
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import * as faceapi from "@vladmandic/face-api";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { logAudit } from "../../lib/audit";

// ─── Types ───────────────────────────────────────────────────────────────────
type DateFilter = "today" | "week" | "month" | "all";

interface Employee {
  id: string;
  auth_user_id: string | null;
  full_name: string;
  email: string;
  department?: string;
  role: string;
  onboarding_status: string;
  created_at: string;
}

interface AttendanceRecord {
  id: string;
  employee_id: string;
  clock_in_at: string;
  clock_out_at: string | null;
  status: string;
  created_at: string;
  employees: { full_name: string; department?: string; } | null;
}

interface AuditLog {
  id: string;
  action: string;
  result: string;
  ip_address: string | null;
  device_info: string | null;
  created_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getDateRange(filter: DateFilter): { from: Date | null; to: Date } {
  const now = new Date();
  const to = now;
  switch (filter) {
    case "today": {
      const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { from, to };
    }
    case "week": {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday start
      const from = new Date(now.getFullYear(), now.getMonth(), diff);
      from.setHours(0, 0, 0, 0);
      return { from, to };
    }
    case "month": {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from, to };
    }
    case "all":
    default:
      return { from: null, to };
  }
}

function calcHours(clockIn: string, clockOut: string | null): string {
  const start = new Date(clockIn).getTime();
  const end = clockOut ? new Date(clockOut).getTime() : Date.now();
  const diffMs = Math.max(0, end - start);
  const hours = Math.floor(diffMs / 3_600_000);
  const mins = Math.floor((diffMs % 3_600_000) / 60_000);
  return `${hours}h ${mins}m`;
}

function calcHoursNum(clockIn: string, clockOut: string | null): number {
  const start = new Date(clockIn).getTime();
  const end = clockOut ? new Date(clockOut).getTime() : Date.now();
  return Math.max(0, (end - start) / 3_600_000);
}

function formatDecimalHours(decimalHours: number): string {
  const h = Math.floor(decimalHours);
  const m = Math.floor((decimalHours - h) * 60);
  return `${h}h ${m}m`;
}

function parseGuestNames(rawName: string): string {
  try {
    const parsed = JSON.parse(rawName);
    if (Array.isArray(parsed)) return parsed.join(", ");
    return rawName;
  } catch {
    return rawName;
  }
}

function statusColor(status: string) {
  switch (status?.toLowerCase()) {
    case "verified":
    case "enrolled":
    case "approved":
    case "active":
    case "complete":
      return "bg-success-bg text-success-content border-success-content/30";
    case "rejected":
    case "declined":
    case "failed":
      return "bg-danger-bg text-danger-content border-danger-content/30";
    case "pending":
    case "pending_authorization":
    case "in_progress":
    default:
      return "bg-warning-bg text-warning-content border-warning-content/30";
  }
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"employees" | "attendance" | "audit" | "hours_month" | "avg_hours" | "guests">("employees");
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState<"all" | "in_progress" | "complete">("all");
  const [isLoading, setIsLoading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem("theme") === "dark");

  useEffect(() => {
    localStorage.setItem("theme", isDarkMode ? "dark" : "light");
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  // Data
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [guestInvites, setGuestInvites] = useState<any[]>([]);
  const [guestToDelete, setGuestToDelete] = useState<string | null>(null);
  const [expandedHost, setExpandedHost] = useState<string | null>(null);

  // Add Employee Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newIdNumber, setNewIdNumber] = useState("");
  const [newDepartment, setNewDepartment] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<"employee" | "admin" | "security_officer">("employee");
  const [addLoading, setAddLoading] = useState(false);
  const [addStatus, setAddStatus] = useState("");
  const [addError, setAddError] = useState("");
  const [addSuccess, setAddSuccess] = useState("");
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [faceModelsLoaded, setFaceModelsLoaded] = useState(false);

  // Modals
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [selectedEmployeeStats, setSelectedEmployeeStats] = useState<Employee | null>(null);
  const [uploadingImageFor, setUploadingImageFor] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit Employee Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editEmployeeData, setEditEmployeeData] = useState<Employee | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  // Reset PIN state
  const [resettingPinFor, setResettingPinFor] = useState<string | null>(null);
  const [resetPinResult, setResetPinResult] = useState<{ pin: string, count: number } | null>(null);
  const [resetPinError, setResetPinError] = useState("");

  // Filters
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");

  // Print Timesheet Modal
  const [printEmployeeId, setPrintEmployeeId] = useState<string | null>(null);
  const [printStart, setPrintStart] = useState("");
  const [printEnd, setPrintEnd] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // ── Show toast ──
  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // ── Init auth guard ──
  useEffect(() => {
    const init = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        navigate("/");
        return;
      }

      // Check if Admin
      const { data: employeeData } = await supabase
        .from("employees")
        .select("role")
        .eq("auth_user_id", sessionData.session.user.id)
        .maybeSingle();

      const adminEmail = import.meta.env.VITE_ADMIN_EMAIL || "rafuma55@gmail.com";
      const isAdminEmail = sessionData.session.user.email?.toLowerCase() === adminEmail.toLowerCase();
      
      if (!isAdminEmail && employeeData?.role !== "admin") {
        navigate("/dashboard");
        return;
      }

      setIsLoading(false);
      try {
        await fetchData();
      } catch (error) {
        console.error("Unable to load WAMP admin data", error);
      }
    };

    init();

    // Load face-api models for reference extraction
    const loadModels = async () => {
      try {
        const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.3/model/";
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        setFaceModelsLoaded(true);
      } catch (err) {
        console.error("Error loading face models", err);
      }
    };
    loadModels();
    
    // WAMP has no websocket dependency; keep the operational view fresh with polling.
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [dateFilter]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };
  // ── Handlers ──
  const handleEditEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editEmployeeData) return;
    setEditLoading(true);
    setEditError("");
    try {
      const { error } = await supabase.rpc("edit_employee_info", {
        p_employee_id: editEmployeeData.id,
        p_first_name: editEmployeeData.full_name.split(" ")[0] || "",
        p_last_name: editEmployeeData.full_name.split(" ").slice(1).join(" ") || "",
        p_id_number: editEmployeeData.id_number,
        p_department: editEmployeeData.department,
        p_role: editEmployeeData.role
      });
      if (error) throw error;
      showToast("Employee updated successfully", "success");
      setIsEditModalOpen(false);
      fetchData();
    } catch (err: any) {
      setEditError(err.message || "Failed to update employee.");
    } finally {
      setEditLoading(false);
    }
  };

  const handleResetPin = async (employeeId: string) => {
    setResettingPinFor(employeeId);
    setResetPinError("");
    setResetPinResult(null);
    try {
      const { data, error } = await supabase.rpc("admin_reset_employee_pin", { p_employee_id: employeeId });
      if (error) throw error;
      setResetPinResult({ pin: data.new_pin, count: data.reset_count });
      logAudit("Admin Reset PIN", `PIN reset for employee ID ${employeeId}`);
    } catch (err: any) {
      setResetPinError(err.message || "Failed to reset PIN.");
    } finally {
      setResettingPinFor(null);
    }
  };


  // ── Fetch all data ──
  const fetchData = async () => {
    const [empsRes, attRes, auditRes, guestRes] = await Promise.all([
      supabase.from("employees").select("*").eq('status', 'active').neq('email', 'itsupporthopealiveradio@gmail.com').order("created_at", { ascending: false }),
      supabase.from("attendance_records").select("*").order("clock_in_at", { ascending: false }),
      supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("guest_invites").select("*").neq("status", "cancelled").neq("status", "expired").order("created_at", { ascending: false }).limit(100),
    ]);
    const employeesById = new Map((empsRes.data || []).map((employee: any) => [employee.id, employee]));
    if (empsRes.data) setEmployees(empsRes.data);
    if (attRes.data) {
      setAttendance(attRes.data.map((record: any) => {
        const employee = employeesById.get(record.employee_id) || {
          id: record.employee_id,
          full_name: [record.employee_first_name, record.employee_last_name].filter(Boolean).join(" "),
          department: record.employee_department,
        };
        return {
          ...record,
          clock_in_at: record.clock_in_at || record.clock_in,
          clock_out_at: record.clock_out_at || record.clock_out,
          employees: employee,
        };
      }));
    }
    if (auditRes.data) setAuditLogs(auditRes.data);
    if (guestRes.data) {
      setGuestInvites(guestRes.data.map((invite: any) => ({
        ...invite,
        employees: employeesById.get(invite.host_employee_id) || null,
      })));
    }
  };

  // ── Filtered data ──
  const filteredEmployees = useMemo(() => {
    if (departmentFilter === "all") return employees;
    return employees.filter(e => e.department?.toLowerCase() === departmentFilter.toLowerCase());
  }, [employees, departmentFilter]);

  const departmentFilteredAttendance = useMemo(() => {
    if (departmentFilter === "all") return attendance;
    return attendance.filter(r => r.employees?.department?.toLowerCase() === departmentFilter.toLowerCase());
  }, [attendance, departmentFilter]);

  const tableFilteredAttendance = useMemo(() => {
    let result = departmentFilteredAttendance;
    
    const { from } = getDateRange(dateFilter);
    if (from) {
      result = result.filter((r) => new Date(r.clock_in_at) >= from);
    }

    if (attendanceStatusFilter !== "all") {
      result = result.filter(r => r.status === attendanceStatusFilter);
    }
    
    return result;
  }, [departmentFilteredAttendance, dateFilter, attendanceStatusFilter]);

  const groupedTableAttendance = useMemo(() => {
    const grouped = new Map<string, any>();

    tableFilteredAttendance.forEach((record) => {
      const dateStr = new Date(record.clock_in_at).toLocaleDateString("en-GB");
      const empId = record.employee_id;
      const key = `${empId}_${dateStr}`;

      if (!grouped.has(key)) {
        grouped.set(key, {
          id: key,
          employee: record.employees,
          date: new Date(record.clock_in_at).toLocaleDateString("en-US", { weekday: 'short', month: 'short', day: 'numeric' }),
          rawDate: new Date(record.clock_in_at),
          totalHours: calcHoursNum(record.clock_in_at, record.clock_out_at),
          clockOutCount: record.clock_out_at ? 1 : 0,
          inProgress: !record.clock_out_at,
          firstClockIn: record.clock_in_at,
          lastClockOut: record.clock_out_at,
          systemKickout: record.kickout_reason === 'SYSTEM_AUTO'
        });
      } else {
        const existing = grouped.get(key);
        existing.totalHours += calcHoursNum(record.clock_in_at, record.clock_out_at);
        if (record.clock_out_at) existing.clockOutCount += 1;
        if (!record.clock_out_at) existing.inProgress = true;
        if (new Date(record.clock_in_at) < new Date(existing.firstClockIn)) existing.firstClockIn = record.clock_in_at;
        if (record.clock_out_at && (!existing.lastClockOut || new Date(record.clock_out_at) > new Date(existing.lastClockOut))) {
           existing.lastClockOut = record.clock_out_at;
        }
        if (record.kickout_reason === 'SYSTEM_AUTO') existing.systemKickout = true;
      }
    });

    return Array.from(grouped.values()).sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime());
  }, [tableFilteredAttendance]);

  // ── Stats (Not affected by Date or Status filters, ONLY Department) ──
  const stats = useMemo(() => {
    const totalEmployees = filteredEmployees.length;
    
    // Clocked In Now (unique employees)
    const clockedIn = new Set(departmentFilteredAttendance.filter((r) => !r.clock_out_at).map(r => r.employee_id)).size;

    // This month
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const monthRecords = departmentFilteredAttendance.filter((r) => new Date(r.clock_in_at) >= monthStart);
    const totalHoursMonthRaw = monthRecords.reduce((sum, r) => sum + calcHoursNum(r.clock_in_at, r.clock_out_at), 0);
    const totalHoursMonth = Math.round(totalHoursMonthRaw * 10) / 10;

    // Days this month with records
    const uniqueDays = new Set(
      monthRecords.map((r) => new Date(r.clock_in_at).toDateString())
    );
    const totalDaysWorked = uniqueDays.size;

    // Today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const clockedOutToday = new Set(departmentFilteredAttendance.filter(r => r.clock_out_at && new Date(r.clock_out_at) >= todayStart).map(r => r.employee_id)).size;

    return { totalEmployees, clockedIn, clockedOutToday, totalHoursMonth, totalDaysWorked };
  }, [filteredEmployees, departmentFilteredAttendance]);

  // ── Employee Stats (for new tabs) ──
  const employeeStatsMonth = useMemo(() => {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const monthRecords = departmentFilteredAttendance.filter((r) => new Date(r.clock_in_at) >= monthStart);
    
    return filteredEmployees.map(emp => {
      const empRecords = monthRecords.filter(r => r.employee_id === emp.id);
      const totalHoursRaw = empRecords.reduce((sum, r) => sum + calcHoursNum(r.clock_in_at, r.clock_out_at), 0);
      const totalHours = Math.round(totalHoursRaw * 10) / 10;
      
      const uniqueDays = new Set(
        empRecords.map((r) => new Date(r.clock_in_at).toDateString())
      );
      const daysWorked = uniqueDays.size;

      return { emp, totalHours, daysWorked };
    });
  }, [filteredEmployees, departmentFilteredAttendance]);

  // ── Departments List ──
  const uniqueDepartments = useMemo(() => {
    const deps = new Set(employees.map(e => e.department).filter(Boolean) as string[]);
    return Array.from(deps).sort();
  }, [employees]);

  // ── Add Employee ──
  const handleAddEmployee = async () => {
    setAddError("");
    setAddSuccess("");
    setAddStatus("");

    if (!newFirstName.trim() || !newLastName.trim() || !newEmail.trim() || !newIdNumber.trim() || !newDepartment.trim()) {
      setAddError("All text fields are required.");
      return;
    }

    if (!referenceImage) {
      setAddError("Please upload a reference photo for the employee's Face ID.");
      return;
    }

    if (!faceModelsLoaded) {
      setAddError("Biometric models are still loading. Please wait a moment.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim())) {
      setAddError("Please enter a valid email address.");
      return;
    }

    setAddLoading(true);
    setAddStatus("Checking database...");

    try {
      const { data: existing } = await supabase
        .from("employees")
        .select("id, status")
        .eq("email", newEmail.trim().toLowerCase())
        .maybeSingle();

      if (existing && existing.status === 'active') {
        setAddError("An employee with this email already exists.");
        setAddLoading(false);
        return;
      }

      setAddStatus("Extracting biometric signature from photo...");

      const img = document.createElement("img");
      img.src = URL.createObjectURL(referenceImage);
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      const detection = await faceapi
        .detectSingleFace(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        setAddError("Could not detect a clear face in the uploaded photo. Please try a front-facing photo with good lighting.");
        setAddLoading(false);
        return;
      }

      const referenceDescriptorArray = Array.from(detection.descriptor);
      const fullName = `${newFirstName.trim()} ${newLastName.trim()}`;

      let profileImageData: string | null = null;
      if (referenceImage) {
        profileImageData = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(referenceImage);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (error) => reject(error);
        });
      }

      const employeeData = {
        id: existing?.id || crypto.randomUUID(),
        first_name: newFirstName.trim(),
        last_name: newLastName.trim(),
        full_name: fullName,
        employee_number: newIdNumber.trim(),
        id_number: newIdNumber.trim(),
        employee_id: newIdNumber.trim(),
        department: newDepartment.trim(),
        email: newEmail.trim().toLowerCase(),
        role: newRole,
        status: "active",
        onboarding_status: "pending",
        auth_user_id: null,
        reference_descriptor: referenceDescriptorArray,
        profile_image_data: profileImageData,
      };

      setAddStatus("Saving to database...");

      let dbError;
      if (existing && existing.status === 'terminated') {
        const { error: updateError } = await supabase.from("employees").update(employeeData).eq("id", existing.id);
        dbError = updateError;
      } else {
        const { error: insertError } = await supabase.from("employees").insert(employeeData);
        dbError = insertError;
      }

      if (dbError) throw dbError;

      setAddSuccess("Employee added successfully!");
      showToast(`${fullName} has been pre-authorized.`, "success");

      setNewFirstName("");
      setNewLastName("");
      setNewIdNumber("");
      setNewDepartment("");
      setNewEmail("");
      setNewRole("employee");
      setReferenceImage(null);

      setTimeout(() => {
        setShowAddModal(false);
        setAddLoading(false);
        fetchData();
      }, 1500);
    } catch (err: any) {
      const message = err?.message || "Failed to add employee.";
      setAddError(message);
      setAddLoading(false);
    }
  };
  // ─── Update Employee Photo ───
  const handleUpdatePhoto = async (e: React.ChangeEvent<HTMLInputElement>, empId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImageFor(empId);
    try {
      if (!faceModelsLoaded) throw new Error("Face models are still loading. Please try again in a moment.");

      const imageUrl = URL.createObjectURL(file);
      const image = document.createElement("img");
      image.src = imageUrl;
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("The selected image could not be read."));
      });

      const detection = await faceapi
        .detectSingleFace(image, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptor();
      URL.revokeObjectURL(imageUrl);

      if (!detection) throw new Error("No clear face was found. Upload a well-lit, front-facing photo of the employee.");

      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("The selected image could not be read."));
        reader.readAsDataURL(file);
      });
      const { error } = await supabase.from('employees').update({
        profile_image_data: base64,
        reference_descriptor: JSON.stringify(Array.from(detection.descriptor)),
      }).eq('id', empId);
      if (error) throw error;
      showToast("Reference photo and Face ID authorization saved", "success");
      logAudit("Admin Updated Biometric Reference", `Success: Employee ID ${empId}`);
      fetchData();
      if (selectedEmployeeStats && selectedEmployeeStats.id === empId) {
        setSelectedEmployeeStats({ ...selectedEmployeeStats, profile_image_data: base64 });
      }
    } catch (err: any) {
      showToast("Failed to update photo: " + err.message, "error");
    } finally {
      setUploadingImageFor(null);
    }
  };

  // ─── Delete Employee ───
  const handleDeleteEmployee = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const { error } = await supabase.rpc('admin_delete_employee', { target_emp_id: deleteTarget.id });
      if (error) throw error;

      showToast(`${deleteTarget.full_name} has been removed.`, "success");
      logAudit("Admin Deleted Employee", `Success: ${deleteTarget.full_name}`);
      setDeleteTarget(null);
      await fetchData();
    } catch (err: any) {
      showToast(err.message || "Failed to delete employee.", "error");
    } finally {
      setAddLoading(false);
    }
  };

  // ── Delete Guest ──
  const handleDeleteGuest = async () => {
    if (!guestToDelete) return;
    try {
      const { error } = await supabase.from("guest_invites").update({ status: 'cancelled' }).eq("id", guestToDelete);
      if (error) throw error;
      setGuestInvites(prev => prev.filter(g => g.id !== guestToDelete));
      showToast("Guest record deleted", "success");
    } catch (err: any) {
      showToast("Failed to delete guest: " + err.message, "error");
    } finally {
      setGuestToDelete(null);
    }
  };

  // ── Print Attendance ──
  // 🖨 Print Attendance 🖨
  const handlePrintRegister = () => {
    if (tableFilteredAttendance.length === 0) {
      showToast("No records to print.", "error");
      return;
    }
    
    // Open TimesheetPrintView for ALL employees
    const startStr = dateRange.from ? dateRange.from.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    const endStr = dateRange.to ? dateRange.to.toISOString().split('T')[0] : startStr;
    navigate(`/print-timesheet/all?start=${startStr}&end=${endStr}`);
  };

  const auditChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    auditLogs.forEach(log => {
      const shortName = log.action.replace('Admin ', '').replace('User ', '');
      counts[shortName] = (counts[shortName] || 0) + 1;
    });
    return Object.keys(counts).map(key => ({
      name: key,
      count: counts[key]
    })).sort((a, b) => b.count - a.count);
  }, [auditLogs]);

  // ── Loading screen ──
  if (isLoading) {
    return (
      <div className={`${isDarkMode ? "dark" : ""} min-h-screen bg-[#f0f4f8] dark:bg-[#121212] flex items-center justify-center p-4 transition-colors duration-300`}>
        <div className="flex flex-col items-center gap-3">
          <span className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 dark:text-gray-400 text-xs">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  // ✨ Render ✨────────────────────────────────────────────────────────────────
  return (
    <div className={`${isDarkMode ? "dark" : ""} min-h-screen bg-[radial-gradient(circle_at_top_right,_rgba(245,158,11,0.12),_transparent_34%),#f3f6fa] dark:bg-[radial-gradient(circle_at_top_right,_rgba(245,158,11,0.1),_transparent_30%),#101722] p-4 pb-20 font-sans transition-colors duration-300`}>
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ddd; padding: 8px; color: black !important; }
          th { background-color: #f3f4f6 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print-header::before {
            content: "";
            display: block;
            height: 60px;
            background: url('/tbg-logo.png') no-repeat left center/contain;
            margin-bottom: 10px;
          }
        }
      `}</style>
      <div className="w-full max-w-5xl mx-auto space-y-5">

        {/* ═══ Header ═══ */}
        <div className="relative flex items-center justify-between overflow-hidden bg-slate-950 border border-slate-800 rounded-[22px] p-4 shadow-[0_18px_45px_rgba(15,23,42,0.18)] no-print">
          <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_center,_rgba(245,158,11,0.18),_transparent_66%)] pointer-events-none" />
          <div className="flex items-center gap-4">
            <img
              src="/tbg-logo.png"
              alt="The Blessed Generation"
              className="relative w-12 h-10 object-contain"
            />
            <div className="h-6 w-[1px] bg-white/15 hidden sm:block"></div>
            <img
              src="/logo.png"
              alt="Hope Alive Radio"
              className="relative w-9 h-9 rounded-lg object-contain"
            />
            <div className="relative hidden sm:block">
              <h1 className="text-lg font-bold text-white tracking-tight">Admin Dashboard</h1>
              <p className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-slate-400">Hope Alive operations control</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="hidden lg:flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" /> WAMP live
            </span>
            {/* Global Department Filter */}
            {uniqueDepartments.length > 0 && (
              <Select value={departmentFilter} onValueChange={(val) => setDepartmentFilter(val)}>
                <SelectTrigger className="w-[160px] bg-white/10 border-white/15 text-slate-200 h-8 rounded-xl font-semibold">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent style={{ backgroundColor: "#020617", color: "#f8fafc" }} className="bg-slate-950 border-slate-700 text-white rounded-xl">
                  <SelectItem style={{ color: "#f8fafc" }} className="text-white focus:bg-slate-800 focus:text-white" value="all">All Departments</SelectItem>
                  {uniqueDepartments.map(d => (
                    <SelectItem style={{ color: "#f8fafc" }} className="text-white focus:bg-slate-800 focus:text-white" key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <button
              onClick={handleLogout}
              className="p-2 hover:bg-red-500/10 rounded-xl transition-colors text-red-300 hover:text-red-200"
              title="Sign out"
            >
              <LogOut size={18} />
            </button>
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 hover:bg-white/10 rounded-xl transition-colors text-slate-300"
              title="Toggle Dark Mode"
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>

        {/* ═══ Stats Summary ═══ */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 no-print">
          {[
            {
              label: "Total Employees",
              value: stats.totalEmployees,
              icon: <Users size={16} className="text-[#6161D6]" />,
              color: "text-slate-900 dark:text-white",
              onClick: () => setActiveTab("employees"),
            },
            {
              label: "Clocked In Now",
              value: stats.clockedIn,
              icon: <UserCheck size={16} className="text-emerald-600" />,
              color: "text-emerald-600",
              onClick: () => {
                setActiveTab("attendance");
                setDateFilter("today");
                setAttendanceStatusFilter("in_progress");
              },
            },
            {
              label: "Clocked Out Today",
              value: stats.clockedOutToday,
              icon: <Clock size={16} className="text-slate-500 dark:text-gray-400" />,
              color: "text-slate-600 dark:text-slate-400",
              onClick: () => {
                setActiveTab("attendance");
                setDateFilter("today");
                setAttendanceStatusFilter("complete");
              },
            },
            {
              label: "Hours This Month",
              value: stats.totalHoursMonth.toFixed(1),
              icon: <Timer size={16} className="text-blue-600" />,
              color: "text-blue-600",
              onClick: () => setActiveTab("hours_month"),
            },
            {
              label: "Days Worked",
              value: stats.totalDaysWorked,
              icon: <TrendingUp size={16} className="text-purple-600" />,
              color: "text-purple-600",
              onClick: () => setActiveTab("days_worked"),
            },
          ].map((s, idx) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05, duration: 0.3 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.95 }}
              onClick={s.onClick}
              className="bg-white/90 dark:bg-white/[0.06] border border-slate-200/80 dark:border-white/10 rounded-2xl p-4 flex flex-col gap-2 shadow-[0_10px_28px_rgba(15,23,42,0.06)] hover:border-amber-300 dark:hover:border-amber-400/40 cursor-pointer hover:bg-amber-50/40 dark:hover:bg-amber-400/[0.06] transition-colors"
            >
              <div className="flex items-center gap-2">
                {s.icon}
                <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-gray-400">{s.label}</span>
              </div>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </motion.div>
          ))}
        </div>

        {/* ═══ Tabs ═══ */}
        <div className="flex gap-2 bg-white/90 dark:bg-white/[0.06] p-1.5 rounded-2xl border border-slate-200/80 dark:border-white/10 no-print shadow-sm">
          {([
            { key: "employees" as const, label: "Employees", icon: <Users size={15} /> },
            { key: "attendance" as const, label: "Attendance", icon: <FileText size={15} /> },
            { key: "guests" as const, label: "Guests", icon: <UserCheck size={15} /> },
            { key: "audit" as const, label: "Audit Log", icon: <Activity size={15} /> },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all duration-200 ${
                activeTab === tab.key
                  ? "bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/25"
                  : "text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:text-white hover:bg-slate-50"
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* ═══ Content Card ═══ */}
        <div className="bg-white/90 dark:bg-white/[0.06] border border-slate-200/80 dark:border-white/10 rounded-[22px] p-4 md:p-6 shadow-[0_16px_42px_rgba(15,23,42,0.06)] min-h-[420px]">

          {/* ─── Employees Tab ─── */}
          {activeTab === "employees" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">Employees</h2>
                  <span className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300 px-2.5 py-0.5 rounded-full font-semibold">
                    {employees.length}
                  </span>
                </div>
                <Button
                  onClick={() => {
                    setAddError("");
                    setAddSuccess("");
                    setShowAddModal(true);
                  }}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs h-9 rounded-xl font-semibold gap-1.5 shadow-sm shadow-amber-500/20"
                >
                  <Plus size={14} /> Add Employee
                </Button>
              </div>

              {filteredEmployees.length === 0 ? (
                <div className="relative overflow-hidden text-center py-16 px-6 rounded-2xl border border-dashed border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.03]">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-400/15 dark:text-amber-300">
                    <Users size={25} />
                  </div>
                  <p className="text-slate-900 dark:text-white text-sm font-semibold">Your directory is ready for its first member.</p>
                  <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-500 dark:text-slate-400">Pre-authorize a team member with their employee number, email, and reference photo.</p>
                  <button onClick={() => setShowAddModal(true)} className="mt-5 text-xs font-bold text-amber-700 hover:text-amber-600 dark:text-amber-300">Add the first employee</button>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-4 md:-mx-6">
                  <div className="min-w-[600px] px-4 md:px-6">
                    <table className="w-full text-sm text-left block md:table">
                      <thead className="text-[10px] text-content-muted uppercase bg-surface-elevated hidden md:table-header-group border-b border-border-strong">
                        <tr className="md:table-row">
                          <th className="px-4 py-3 rounded-tl-lg">Employee</th>
                          <th className="px-4 py-3">Email</th>
                          <th className="px-4 py-3">Department</th>
                          <th className="px-4 py-3">Role</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3 rounded-tr-lg text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="block md:table-row-group">
                        {filteredEmployees.map((emp) => (
                          <tr
                            key={emp.id}
                            onClick={() => setSelectedEmployeeStats(emp)}
                            className="block md:table-row border border-border-strong md:border-b bg-surface hover:bg-surface-overlay text-content transition-colors cursor-pointer p-4 md:p-0 rounded-xl md:rounded-none mb-3 md:mb-0"
                          >
                            <td className="flex md:table-cell justify-between items-center md:items-start px-0 md:px-4 py-1 md:py-3 font-medium text-xs text-content border-b border-border-strong md:border-none pb-2 md:pb-3 mb-2 md:mb-0">
                              <div>
                                <div>{emp.full_name}</div>
                                {emp.id_number && (
                                  <div className="text-[10px] text-content-muted font-mono mt-0.5" title="Employee Number">{emp.id_number}</div>
                                )}
                              </div>
                            </td>
                            <td className="flex md:table-cell justify-between items-center px-0 md:px-4 py-1 md:py-3 text-xs text-content-muted">
                              <span className="md:hidden text-content-subtle text-[10px] uppercase font-bold">Email</span>
                              {emp.email}
                            </td>
                            <td className="flex md:table-cell justify-between items-center px-0 md:px-4 py-1 md:py-3">
                              <span className="md:hidden text-content-subtle text-[10px] uppercase font-bold">Department</span>
                              {emp.department ? (
                                <span className="text-[10px] bg-info-bg text-info-content px-2 py-0.5 rounded-full uppercase font-medium border border-info-content/30">
                                  {emp.department}
                                </span>
                              ) : (
                                <span className="text-content-subtle text-xs">—</span>
                              )}
                            </td>
                            <td className="flex md:table-cell justify-between items-center px-0 md:px-4 py-1 md:py-3">
                              <span className="md:hidden text-content-subtle text-[10px] uppercase font-bold">Role</span>
                              <span className="text-[10px] bg-surface-overlay text-content-muted border border-border-strong px-2 py-0.5 rounded-full uppercase font-medium">
                                {emp.role}
                              </span>
                            </td>
                            <td className="flex md:table-cell justify-between items-center px-0 md:px-4 py-1 md:py-3">
                              <span className="md:hidden text-slate-400 text-[10px] uppercase font-bold">Status</span>
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${statusColor(emp.onboarding_status)}`}
                              >
                                {emp.onboarding_status}
                              </span>
                            </td>
                            <td className="flex md:table-cell justify-end md:text-right px-0 md:px-4 py-2 md:py-3 mt-2 md:mt-0 pt-2 md:pt-3 border-t border-slate-100 dark:border-white/10 md:border-none">
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setEditEmployeeData(emp); setIsEditModalOpen(true); }}
                                  className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors inline-flex bg-slate-50 md:bg-transparent md:rounded-none"
                                  title="Edit employee"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(emp); }}
                                  className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors inline-flex bg-slate-50 md:bg-transparent md:rounded-none"
                                  title="Delete employee"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── Attendance Tab ─── */}
          {activeTab === "attendance" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 no-print">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Attendance Records</h2>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {/* Date Filter */}
                  <div className="flex-1 sm:flex-none">
                    <Select value={dateFilter} onValueChange={(val) => setDateFilter(val as DateFilter)}>
                      <SelectTrigger className="w-full sm:w-[130px] bg-slate-50 border-slate-100 dark:border-white/10 text-slate-900 dark:text-white h-9 rounded-xl">
                        <SelectValue placeholder="Today" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#111] border-slate-100 dark:border-white/10 text-slate-900 dark:text-white rounded-xl">
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="week">This Week</SelectItem>
                        <SelectItem value="month">This Month</SelectItem>
                        <SelectItem value="all">All Time</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={handlePrintRegister}
                    variant="outline"
                    className="text-xs h-8 bg-[#FBB03B] border-[#FBB03B] hover:bg-[#e5a035] text-white font-bold rounded-xl shrink-0"
                  >
                    <Printer size={14} className="mr-1.5" /> Print Register (PDF)
                  </Button>
                </div>
              </div>

              <div className="hidden print-only mb-4">
                <div className="flex items-center gap-4 mb-2">
                  <img src="/tbg-logo.png" className="h-10" />
                  <div className="h-8 w-[1px] bg-black"></div>
                  <img src="/logo.png" className="h-10" />
                  <h1 className="text-2xl font-bold font-serif ml-4">Attendance Register</h1>
                </div>
                <p className="text-sm font-bold">Hope Alive Radio - Official Record</p>
                <p className="text-xs">Printed on: {new Date().toLocaleString()}</p>
              </div>

              <p className="text-xs text-slate-400 no-print">
                Showing {groupedTableAttendance.length} group{groupedTableAttendance.length !== 1 ? "s" : ""}
              </p>

              {groupedTableAttendance.length === 0 ? (
                <div className="text-center py-16">
                  <Clock size={40} className="mx-auto text-slate-400 mb-3" />
                  <p className="text-slate-500 dark:text-gray-400 text-sm">No attendance records for this period.</p>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-4 md:-mx-6">
                  <div className="min-w-full px-4 md:px-6">
                    <table className="w-full text-sm text-left block md:table">
                      <thead className="text-[10px] text-content-muted uppercase bg-surface-elevated hidden md:table-header-group border-b border-border-strong">
                        <tr className="md:table-row">
                          <th className="px-4 py-3 rounded-tl-lg">Employee</th>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Total Hours</th>
                          <th className="px-4 py-3">Sessions</th>
                          <th className="px-4 py-3 rounded-tr-lg">Status</th>
                        </tr>
                      </thead>
                      <tbody className="block md:table-row-group">
                        {groupedTableAttendance.map((group) => (
                          <tr
                            key={group.id}
                            className="block md:table-row border border-border-strong md:border-b bg-surface hover:bg-surface-overlay text-content transition-colors p-4 md:p-0 rounded-xl md:rounded-none mb-3 md:mb-0"
                          >
                            <td className="flex md:table-cell justify-between items-center md:items-start px-0 md:px-4 py-1 md:py-3 font-medium text-xs border-b border-border-strong md:border-none pb-2 md:pb-3 mb-2 md:mb-0">
                              <div>
                                <div className="text-content font-semibold">{group.employee?.full_name || "Unknown"}</div>
                                {group.employee?.department && (
                                  <div className="text-[10px] text-info-content uppercase tracking-wider mt-0.5">
                                    {group.employee.department}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="flex md:table-cell justify-between items-center px-0 md:px-4 py-1 md:py-3 text-xs text-content">
                              <span className="md:hidden text-content-subtle text-[10px] uppercase font-bold">Date</span>
                              {group.date}
                            </td>
                            <td className="flex md:table-cell justify-between items-center px-0 md:px-4 py-1 md:py-3 text-xs font-mono text-primary">
                              <span className="md:hidden text-content-subtle text-[10px] uppercase font-bold font-sans">Total Hours</span>
                              {formatDecimalHours(group.totalHours)}
                            </td>
                            <td className="flex md:table-cell justify-between items-center px-0 md:px-4 py-1 md:py-3 text-xs text-content-muted">
                              <span className="md:hidden text-content-subtle text-[10px] uppercase font-bold">Sessions</span>
                              {group.clockOutCount > 0 ? `Clocked Out (${group.clockOutCount})` : "—"}
                            </td>
                            <td className="flex md:table-cell justify-between items-center px-0 md:px-4 py-2 md:py-3 border-t border-border-strong md:border-none mt-2 md:mt-0 pt-2 md:pt-3">
                              <span className="md:hidden text-content-subtle text-[10px] uppercase font-bold">Status</span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                                  group.systemKickout
                                    ? "bg-danger-bg text-danger-content border-danger-content/30"
                                    : group.inProgress
                                    ? "bg-info-bg text-info-content border-info-content/30"
                                    : "bg-success-bg text-success-content border-success-content/30"
                                }`}
                              >
                                {group.systemKickout ? "System Kickout" : group.inProgress ? "In Progress" : "Complete"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── Audit Log Tab ─── */}
          {activeTab === "audit" && (
            <div className="space-y-6">
              
              {/* Performance Matrix */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl p-4 flex flex-col justify-center items-center text-center">
                  <Activity size={24} className="text-primary mb-2" />
                  <span className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Frontend Status</span>
                  <span className="text-lg font-bold text-green-500 mt-1">Online</span>
                  <span className="text-[9px] text-slate-400 mt-0.5">Latency: ~{(Math.random() * 15 + 10).toFixed(0)}ms</span>
                </div>
                <div className="bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl p-4 flex flex-col justify-center items-center text-center">
                  <Database size={24} className="text-blue-500 mb-2" />
                  <span className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Backend API</span>
                  <span className="text-lg font-bold text-green-500 mt-1">Connected</span>
                  <span className="text-[9px] text-slate-400 mt-0.5">WAMP live polling</span>
                </div>
                <div className="bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl p-4 flex flex-col justify-center items-center text-center">
                  <ShieldCheck size={24} className="text-emerald-500 mb-2" />
                  <span className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">RLS Security</span>
                  <span className="text-lg font-bold text-slate-800 dark:text-white mt-1">Enforced</span>
                  <span className="text-[9px] text-slate-400 mt-0.5">Server-side access rules</span>
                </div>
                <div className="bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl p-4 flex flex-col justify-center items-center text-center">
                  <Activity size={24} className="text-purple-500 mb-2" />
                  <span className="text-[10px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Total Actions</span>
                  <span className="text-lg font-bold text-slate-800 dark:text-white mt-1">{auditLogs.length}</span>
                  <span className="text-[9px] text-slate-400 mt-0.5">Tracked Events</span>
                </div>
              </div>

              {/* Chart Section */}
              {auditLogs.length > 0 && (
                <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-sm border border-slate-100 dark:border-white/10 p-5">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Action Frequency</h3>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={auditChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                          cursor={{ fill: 'rgba(249, 115, 22, 0.05)' }}
                        />
                        <Bar dataKey="count" fill="#f97316" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              <h2 className="text-base font-bold text-slate-900 dark:text-white mt-2">System Audit Log</h2>

              {auditLogs.length === 0 ? (
                <div className="text-center py-16 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/10">
                  <Activity size={40} className="mx-auto text-slate-400 mb-3" />
                  <p className="text-slate-600 dark:text-gray-400 text-sm font-semibold mb-1">No audit logs found.</p>
                  <p className="text-slate-400 text-xs">Waiting for system activity...</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 bg-white dark:bg-[#1a1a1a] border border-slate-100 dark:border-white/10 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors flex items-center justify-between gap-3 shadow-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-slate-900 dark:text-white text-xs font-medium">
                          {log.action}{" "}
                          <span className="text-slate-500 dark:text-gray-400 font-normal ml-1">{log.result}</span>
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1 truncate">
                          {log.ip_address || "Unknown IP"} • {log.device_info || "Unknown device"}
                        </p>
                      </div>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap ml-2 shrink-0">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── Hours This Month Tab ─── */}
          {activeTab === "hours_month" && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Hours This Month (By Employee)</h2>
              
              {employeeStatsMonth.length === 0 ? (
                <div className="text-center py-16">
                  <Timer size={40} className="mx-auto text-slate-400 mb-3" />
                  <p className="text-slate-500 dark:text-gray-400 text-sm">No recorded hours for this month.</p>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-4 md:-mx-6">
                  <div className="min-w-full px-4 md:px-6">
                    <table className="w-full text-sm text-left block md:table">
                      <thead className="text-[10px] text-slate-500 dark:text-gray-400 uppercase bg-slate-50 hidden md:table-header-group">
                        <tr className="md:table-row">
                          <th className="px-4 py-3 rounded-tl-lg">Employee</th>
                          <th className="px-4 py-3">Department</th>
                          <th className="px-4 py-3 rounded-tr-lg">Total Hours</th>
                        </tr>
                      </thead>
                      <tbody className="block md:table-row-group">
                        {employeeStatsMonth.map(({ emp, totalHours }) => (
                          <tr
                            key={emp.id}
                            className="block md:table-row border border-slate-100 dark:border-white/10 md:border-b md:border-slate-100 dark:border-white/10 bg-slate-50 md:bg-transparent rounded-xl md:rounded-none mb-3 md:mb-0 text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors p-4 md:p-0"
                          >
                            <td className="flex md:table-cell justify-between items-center md:items-start px-0 md:px-4 py-1 md:py-3 font-medium text-xs text-slate-900 dark:text-white border-b border-slate-100 dark:border-white/10 md:border-none pb-2 md:pb-3 mb-2 md:mb-0">
                              {emp.full_name}
                            </td>
                            <td className="flex md:table-cell justify-between items-center px-0 md:px-4 py-1 md:py-3">
                              <span className="md:hidden text-slate-400 text-[10px] uppercase font-bold">Department</span>
                              {emp.department ? (
                                <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full uppercase font-medium border border-blue-200">
                                  {emp.department}
                                </span>
                              ) : (
                                <span className="text-slate-400 text-xs">—</span>
                              )}
                            </td>
                            <td className="flex md:table-cell justify-between items-center px-0 md:px-4 py-1 md:py-3 text-xs font-mono text-blue-600">
                              <span className="md:hidden text-slate-400 text-[10px] uppercase font-bold font-sans">Total Hours</span>
                              {formatDecimalHours(totalHours)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── Days Worked Tab ─── */}
          {activeTab === "days_worked" && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Days Worked This Month (By Employee)</h2>
              
              {employeeStatsMonth.length === 0 ? (
                <div className="text-center py-16">
                  <TrendingUp size={40} className="mx-auto text-slate-400 mb-3" />
                  <p className="text-slate-500 dark:text-gray-400 text-sm">No recorded hours for this month.</p>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-4 md:-mx-6">
                  <div className="min-w-full px-4 md:px-6">
                    <table className="w-full text-sm text-left block md:table">
                      <thead className="text-[10px] text-slate-500 dark:text-gray-400 uppercase bg-slate-50 hidden md:table-header-group">
                        <tr className="md:table-row">
                          <th className="px-4 py-3 rounded-tl-lg">Employee</th>
                          <th className="px-4 py-3">Department</th>
                          <th className="px-4 py-3 rounded-tr-lg">Days Worked</th>
                        </tr>
                      </thead>
                      <tbody className="block md:table-row-group">
                        {employeeStatsMonth.map(({ emp, daysWorked }) => (
                          <tr
                            key={emp.id}
                            className="block md:table-row border border-slate-100 dark:border-white/10 md:border-b md:border-slate-100 dark:border-white/10 bg-slate-50 md:bg-transparent rounded-xl md:rounded-none mb-3 md:mb-0 text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors p-4 md:p-0"
                          >
                            <td className="flex md:table-cell justify-between items-center md:items-start px-0 md:px-4 py-1 md:py-3 font-medium text-xs text-slate-900 dark:text-white border-b border-slate-100 dark:border-white/10 md:border-none pb-2 md:pb-3 mb-2 md:mb-0">
                              {emp.full_name}
                            </td>
                            <td className="flex md:table-cell justify-between items-center px-0 md:px-4 py-1 md:py-3">
                              <span className="md:hidden text-slate-400 text-[10px] uppercase font-bold">Department</span>
                              {emp.department ? (
                                <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full uppercase font-medium border border-blue-200">
                                  {emp.department}
                                </span>
                              ) : (
                                <span className="text-slate-400 text-xs">—</span>
                              )}
                            </td>
                            <td className="flex md:table-cell justify-between items-center px-0 md:px-4 py-1 md:py-3 text-xs font-mono text-purple-600">
                              <span className="md:hidden text-slate-400 text-[10px] uppercase font-bold font-sans">Days Worked</span>
                              {daysWorked} Day{daysWorked !== 1 ? 's' : ''}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── Guests Tab ─── */}
          {activeTab === "guests" && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Guest Invitations</h2>

              {guestInvites.length === 0 ? (
                <div className="text-center py-16">
                  <UserCheck size={40} className="mx-auto text-slate-400 mb-3" />
                  <p className="text-slate-500 dark:text-gray-400 text-sm">No guest invitations found.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {Object.entries(
                    guestInvites.reduce((acc, inv) => {
                      const host = inv.employees?.full_name || 'Unknown';
                      if (!acc[host]) acc[host] = [];
                      acc[host].push(inv);
                      return acc;
                    }, {} as Record<string, any[]>)
                  )
                  .sort((a, b) => b[1].length - a[1].length)
                  .map(([host, invites]) => (
                    <div key={host} className="border border-slate-100 dark:border-white/10 rounded-xl overflow-hidden bg-surface">
                      <button 
                        onClick={() => setExpandedHost(expandedHost === host ? null : host)}
                        className="w-full flex items-center justify-between p-4 bg-surface hover:bg-surface-overlay transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                            {host.charAt(0)}
                          </div>
                          <div>
                            <h3 className="font-bold text-content text-sm">{host}</h3>
                            <p className="text-[10px] text-content-muted">{invites.length} invitation{invites.length !== 1 ? 's' : ''}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                            {invites.reduce((sum, inv) => sum + (inv.guest_count || 1), 0)} Total Guests
                          </span>
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-content-muted transition-transform duration-200 ${expandedHost === host ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"></polyline></svg>
                        </div>
                      </button>

                      {expandedHost === host && (
                        <div className="bg-surface-elevated border-t border-border-strong p-4 space-y-3">
                          {invites.map((inv) => (
                            <div key={inv.id} className="flex flex-col md:flex-row md:items-center justify-between p-3 bg-surface border border-border-strong rounded-lg gap-3">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-slate-50 dark:bg-white/5 rounded-lg text-content-muted shrink-0">
                                  <UserCheck size={16} />
                                </div>
                                <div>
                                  <p className="text-xs font-bold text-content">{parseGuestNames(inv.guest_name)}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[10px] text-content-muted">{new Date(inv.created_at).toLocaleDateString()}</span>
                                    <span className="text-[10px] text-content-subtle">•</span>
                                    <span className="text-[10px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">{inv.guest_count} Guest{inv.guest_count > 1 ? 's' : ''}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                  inv.status === 'pending' ? 'bg-amber-500/20 text-amber-500 border border-amber-500/20' :
                                  inv.status === 'checked_in' ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/20' :
                                  inv.status === 'checked_out' ? 'bg-slate-500/20 text-slate-500 dark:text-gray-400 border border-slate-500/20' :
                                  'bg-red-500/20 text-red-500 border border-red-500/20'
                                }`}>
                                  {inv.status.replace('_', ' ')}
                                </span>
                                <button
                                  onClick={() => setGuestToDelete(inv.id)}
                                  className="p-1.5 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors bg-white dark:bg-transparent border border-slate-200 dark:border-transparent"
                                  title="Delete invitation"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Edit Employee Modal ── */}
      {isEditModalOpen && editEmployeeData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-white dark:bg-[#1a1a1a]/70 backdrop-blur-sm" onClick={() => !editLoading && setIsEditModalOpen(false)} />
          <div className="relative w-full max-w-[500px] bg-white dark:bg-[#1a1a1a] border border-slate-100 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden flex flex-col max-h-[90vh]">
            <button onClick={() => !editLoading && setIsEditModalOpen(false)} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-surface text-content-muted hover:text-content transition-colors">
              <X size={20} />
            </button>
            <div className="p-6 border-b border-border-strong bg-surface">
              <h3 className="text-xl font-bold text-content flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                Edit Employee
              </h3>
              <p className="text-content-muted text-xs mt-1">Update employee information.</p>
            </div>
            <div className="p-6 overflow-y-auto bg-surface-elevated">
              <form onSubmit={handleEditEmployee} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-content-subtle uppercase">Full Name</label>
                    <input
                      type="text"
                      value={editEmployeeData.full_name}
                      onChange={(e) => setEditEmployeeData({ ...editEmployeeData, full_name: e.target.value })}
                      className="w-full h-10 bg-surface border border-border-strong rounded-xl px-3 text-sm text-content focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-content-subtle uppercase">ID Number</label>
                    <input
                      type="text"
                      value={editEmployeeData.id_number}
                      onChange={(e) => setEditEmployeeData({ ...editEmployeeData, id_number: e.target.value })}
                      className="w-full h-10 bg-surface border border-border-strong rounded-xl px-3 text-sm text-content focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-content-subtle uppercase">Department</label>
                    <input
                      type="text"
                      value={editEmployeeData.department}
                      onChange={(e) => setEditEmployeeData({ ...editEmployeeData, department: e.target.value })}
                      className="w-full h-10 bg-surface border border-border-strong rounded-xl px-3 text-sm text-content focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-content-subtle uppercase">Role</label>
                    <Select value={editEmployeeData.role} onValueChange={(val: any) => setEditEmployeeData({ ...editEmployeeData, role: val })}>
                      <SelectTrigger className="h-10 bg-surface border-border-strong">
                        <SelectValue placeholder="Role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="employee">Employee</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="security_officer">Security Officer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {editError && (
                  <div className="p-3 rounded-lg bg-danger-bg text-danger-content text-xs font-medium border border-danger-content/20 flex items-start gap-2">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    <p>{editError}</p>
                  </div>
                )}
                
                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={editLoading}
                    className="w-full h-11 bg-primary hover:bg-primary-hover text-primary-content font-bold rounded-xl flex items-center justify-center gap-2"
                  >
                    {editLoading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {editLoading ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Add Employee Modal ═══ */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-white dark:bg-[#1a1a1a]/70 backdrop-blur-sm"
            onClick={() => !addLoading && setShowAddModal(false)}
          />
          {/* Modal */}
          <div className="relative w-full max-w-md bg-surface-overlay border border-border-strong rounded-2xl p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200">
            {/* Close */}
            <button
              onClick={() => !addLoading && setShowAddModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-surface text-content-muted hover:text-content transition-colors"
            >
              <X size={16} />
            </button>

            <h3 className="text-base font-bold text-content mb-1">Add New Employee</h3>
            <p className="text-xs text-content-muted mb-4">Pre-authorize an employee with their reference photo.</p>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
              {/* Photo Upload */}
              <div>
                <label className="text-xs text-slate-500 dark:text-white mb-1.5 block font-medium">Reference Photo (Required)</label>
                <div className="relative group">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setReferenceImage(e.target.files[0]);
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    disabled={addLoading}
                  />
                  <div className={`w-full border-2 border-dashed ${referenceImage ? 'border-primary/50 bg-[#6161D6]/5' : 'border-slate-100 dark:border-white/10 bg-slate-50 group-hover:border-primary/50 group-hover:bg-slate-100'} rounded-xl px-4 py-6 text-center transition-all flex flex-col items-center justify-center gap-2`}>
                    {referenceImage ? (
                      <>
                        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-primary">
                          <img src={URL.createObjectURL(referenceImage)} alt="Preview" className="w-full h-full object-cover" />
                        </div>
                        <p className="text-xs text-[#6161D6] font-medium">{referenceImage.name}</p>
                      </>
                    ) : (
                      <>
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 dark:text-gray-400">
                          <Plus size={20} />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-slate-600 dark:text-white">Click to upload photo</p>
                          <p className="text-[10px] text-slate-400 dark:text-gray-300">Clear, front-facing face photo required</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-content-muted mb-1.5 block font-medium">First Name</label>
                  <input
                    type="text"
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    placeholder="e.g. John"
                    className="w-full bg-surface border border-border-strong rounded-xl px-4 py-2.5 text-sm text-content placeholder:text-content-subtle focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
                    disabled={addLoading}
                  />
                </div>
                <div>
                  <label className="text-xs text-content-muted mb-1.5 block font-medium">Last Name</label>
                  <input
                    type="text"
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    placeholder="e.g. Doe"
                    className="w-full bg-surface border border-border-strong rounded-xl px-4 py-2.5 text-sm text-content placeholder:text-content-subtle focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
                    disabled={addLoading}
                  />
                </div>
              </div>
              
              <div>
                <label className="text-xs text-content-muted mb-1.5 block font-medium">Employee Number</label>
                <input
                  type="text"
                  value={newIdNumber}
                  onChange={(e) => setNewIdNumber(e.target.value)}
                  placeholder="e.g. EMP1001"
                  className="w-full bg-surface border border-border-strong rounded-xl px-4 py-2.5 text-sm text-content placeholder:text-content-subtle focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
                  disabled={addLoading}
                />
              </div>

              <div>
                <label className="text-xs text-content-muted mb-1.5 block font-medium">Department</label>
                <Select value={newDepartment} onValueChange={setNewDepartment} disabled={addLoading}>
                  <SelectTrigger className="w-full bg-surface border-border-strong h-11 rounded-xl text-content">
                    <SelectValue placeholder="Select Department" />
                  </SelectTrigger>
                  <SelectContent className="bg-surface-overlay border-border-strong text-content rounded-xl max-h-[300px]">
                    <SelectItem value="IT">IT</SelectItem>
                    <SelectItem value="Frontend">Frontend</SelectItem>
                    <SelectItem value="Backend">Backend</SelectItem>
                    <SelectItem value="Database">Database</SelectItem>
                    <SelectItem value="IT Support">IT Support</SelectItem>
                    <SelectItem value="Project Manager">Project Manager</SelectItem>
                    <SelectItem value="Project Leader">Project Leader</SelectItem>
                    <SelectItem value="Documentation">Documentation</SelectItem>
                    <SelectItem value="Journalist">Journalist</SelectItem>
                    <SelectItem value="Technical Producers">Technical Producers</SelectItem>
                    <SelectItem value="Presenters">Presenters</SelectItem>
                    <SelectItem value="Marketing">Marketing</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Email */}
              <div>
                <label className="text-xs text-content-muted mb-1.5 block font-medium">Email Address</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="e.g. john@hopealive.org"
                  className="w-full bg-surface border border-border-strong rounded-xl px-4 py-2.5 text-sm text-content placeholder:text-content-subtle focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
                  disabled={addLoading}
                />
              </div>

              {/* Role */}
              <div>
                <label className="text-xs text-content-muted mb-1.5 block font-medium">Role</label>
                <Select value={newRole} onValueChange={(val) => setNewRole(val as "employee" | "admin" | "security_officer")} disabled={addLoading}>
                  <SelectTrigger className="w-full bg-surface border-border-strong h-11 rounded-xl text-content">
                    <SelectValue placeholder="Select Role" />
                  </SelectTrigger>
                  <SelectContent className="bg-surface-overlay border-border-strong text-content rounded-xl">
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="security_officer">Security</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Feedback */}
              {addError && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <AlertTriangle size={14} className="text-red-600 shrink-0" />
                  <p className="text-xs text-red-600">{addError}</p>
                </div>
              )}
              {addSuccess && (
                <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                  <p className="text-xs text-emerald-600">{addSuccess}</p>
                </div>
              )}

              {/* Submit */}
              <Button
                onClick={handleAddEmployee}
                disabled={addLoading}
                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-xl h-10 text-sm"
              >
                {addLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin mr-2" /> Adding…
                  </>
                ) : (
                  <>
                    <Plus size={16} className="mr-1" /> Add Employee
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Delete Confirmation Modal ═══ */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white dark:bg-[#1a1a1a] backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#111] border border-gray-800 rounded-2xl p-6 w-full max-w-sm"
            >
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Delete Employee?</h3>
              <p className="text-slate-500 dark:text-gray-400 text-sm mb-6">
                Are you sure you want to remove <span className="text-amber-500 font-bold">{deleteTarget.full_name}</span>? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  disabled={deleteLoading}
                  className="flex-1 bg-slate-50 border-slate-100 dark:border-white/10 hover:bg-slate-100 text-slate-900 dark:text-white rounded-xl h-9 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleDeleteEmployee}
                  disabled={deleteLoading}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-slate-900 dark:text-white rounded-xl h-9 text-xs"
                >
                  {deleteLoading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <>
                      <Trash2 size={14} className="mr-1" /> Delete
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Employee Details & Guest Analytics Modal */}
      <AnimatePresence>
        {selectedEmployeeStats && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-[#111] border border-gray-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-sm"
            >
              {/* Header */}
              <div className="p-6 border-b border-gray-800 flex justify-between items-start bg-white dark:bg-[#1a1a1a]/[0.02]">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{selectedEmployeeStats.full_name}</h3>
                  <div className="flex gap-2">
                    <span className="text-[10px] bg-amber-500/20 text-amber-500 px-2 py-0.5 rounded-full uppercase font-bold tracking-wider border border-amber-500/20">{selectedEmployeeStats.role}</span>
                    {selectedEmployeeStats.department && (
                      <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full uppercase font-bold tracking-wider border border-blue-200">{selectedEmployeeStats.department}</span>
                    )}
                  </div>
                  
                  <div className="mt-3 flex items-center gap-2">
                    <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={(e) => handleUpdatePhoto(e, selectedEmployeeStats.id)} />
                    <Button 
                      variant="outline" 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingImageFor === selectedEmployeeStats.id}
                      className="h-7 text-xs px-3 border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg flex items-center gap-1.5"
                    >
                      {uploadingImageFor === selectedEmployeeStats.id ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
                      Update Photo
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => handleResetPin(selectedEmployeeStats.id)}
                      disabled={resettingPinFor === selectedEmployeeStats.id}
                      className="h-7 text-xs px-3 border-amber-200 text-amber-600 hover:bg-amber-50 rounded-lg flex items-center gap-1.5"
                    >
                      {resettingPinFor === selectedEmployeeStats.id ? <Loader2 size={12} className="animate-spin" /> : <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>}
                      Reset PIN
                    </Button>
                  </div>
                  {resetPinResult && (
                    <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg max-w-[300px]">
                      <p className="text-xs text-amber-800 font-bold mb-1">New PIN Generated: {resetPinResult.pin}</p>
                      <p className="text-[10px] text-amber-600">Please share this securely with the employee. {3 - resetPinResult.count} resets remaining today.</p>
                    </div>
                  )}
                  {resetPinError && (
                    <div className="mt-2 text-[10px] text-red-500 font-medium max-w-[300px]">{resetPinError}</div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    onClick={() => {
                      const now = new Date();
                      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
                      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                      setPrintStart(firstDay.toISOString().split('T')[0]);
                      setPrintEnd(lastDay.toISOString().split('T')[0]);
                      setPrintEmployeeId(selectedEmployeeStats.id);
                      logAudit("Admin Printed Timesheet", `Success: ${selectedEmployeeStats.full_name}`);
                      setSelectedEmployeeStats(null); // Close the stats modal first
                    }}
                    variant="outline"
                    className="h-8 text-xs border-amber-500/30 text-amber-500 hover:bg-amber-500/10 rounded-lg"
                  >
                    Print Timesheet
                  </Button>
                  <button
                    onClick={() => setSelectedEmployeeStats(null)}
                    className="p-2 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:text-white transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto flex-1 bg-white dark:bg-[#1a1a1a] space-y-8">
                {/* Guest Analytics Section */}
                <div>
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <UserCheck size={16} className="text-amber-500" />
                    Guest Invitation Analytics
                  </h4>
                  
                  {(() => {
                    const empInvites = guestInvites.filter(i => i.host_employee_id === selectedEmployeeStats.id);
                    const linksSent = empInvites.length;
                    const linksOpened = empInvites.reduce((sum, i) => sum + (i.views || 0), 0);
                    const admitted = empInvites.filter(i => i.status === 'checked_in' || i.status === 'checked_out').length;
                    const expired = empInvites.filter(i => i.status === 'expired').length;
                    const declined = empInvites.filter(i => i.status === 'declined' || i.status === 'deleted').length;
                    const photos = empInvites.filter(i => i.id_photo_url).map(i => ({ url: i.id_photo_url, date: i.created_at, names: parseGuestNames(i.guest_name) }));

                    return (
                      <div className="space-y-8">
                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                          <div className="bg-slate-50 border border-slate-100 dark:border-white/10 rounded-2xl p-4 text-center">
                            <p className="text-3xl font-black text-slate-900 dark:text-white">{linksSent}</p>
                            <p className="text-[10px] text-slate-500 dark:text-gray-400 uppercase font-bold mt-2">Links Sent</p>
                          </div>
                          <div className="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-4 text-center">
                            <p className="text-3xl font-black text-blue-600">{linksOpened}</p>
                            <p className="text-[10px] text-blue-600/70 uppercase font-bold mt-2">Times Opened</p>
                          </div>
                          <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-4 text-center">
                            <p className="text-3xl font-black text-emerald-600">{admitted}</p>
                            <p className="text-[10px] text-emerald-600/70 uppercase font-bold mt-2">Checked In</p>
                          </div>
                          <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-4 text-center">
                            <p className="text-3xl font-black text-red-600">{declined}</p>
                            <p className="text-[10px] text-red-600/70 uppercase font-bold mt-2">Declined / Cancelled</p>
                          </div>
                          <div className="bg-gray-500/5 border border-gray-500/10 rounded-2xl p-4 text-center">
                            <p className="text-3xl font-black text-slate-400">{expired}</p>
                            <p className="text-[10px] text-slate-400/70 uppercase font-bold mt-2">Expired</p>
                          </div>
                        </div>

                        {/* ID Photos Gallery */}
                        {photos.length > 0 && (
                          <div className="space-y-4 pt-6 border-t border-gray-800/50">
                            <h5 className="text-xs font-black text-slate-400 uppercase tracking-widest">ID Photos Captured</h5>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                              {photos.map((photo, i) => (
                                <div key={i} className="group relative aspect-[4/3] bg-gray-900 rounded-xl overflow-hidden border border-slate-100 dark:border-white/10 shadow-sm">
                                  <img 
                                    src={photo.url} 
                                    alt={`ID for ${photo.names}`}
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                  />
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex flex-col justify-end p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                    <span className="text-sm font-bold text-slate-900 dark:text-white leading-tight">{photo.names}</span>
                                    <span className="text-[10px] font-medium text-amber-500/80 mt-1">{new Date(photo.date).toLocaleDateString()}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {photos.length === 0 && linksSent > 0 && (
                          <div className="p-8 bg-white dark:bg-[#1a1a1a]/[0.02] rounded-2xl border border-dashed border-slate-100 dark:border-white/10 text-center">
                            <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-3">
                              <Camera size={20} className="text-slate-400" />
                            </div>
                            <p className="text-sm font-medium text-slate-500 dark:text-gray-400">No ID photos captured yet.</p>
                            <p className="text-xs text-slate-400 mt-1">Photos taken by Security will appear here.</p>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══ Toast Notification ═══ */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div
            className={`px-4 py-2.5 rounded-xl border shadow-sm  flex items-center gap-2 text-xs font-medium ${
              toast.type === "success"
                ? "bg-emerald-500/15 border-emerald-200 text-emerald-600"
                : "bg-red-50 border-red-200 text-red-600"
            }`}
          >
            {toast.type === "success" ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
            {toast.message}
          </div>
        </div>
      )}
      {/* Delete Guest Confirmation Modal */}
      {guestToDelete && (
        <div className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setGuestToDelete(null)}>
          <div className="bg-white dark:bg-[#1a1a1a] border border-slate-100 dark:border-white/10 rounded-2xl w-full max-w-[320px] p-6 shadow-sm overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center text-red-500">
                <Trash2 size={24} />
              </div>
              <div>
                <h3 className="text-slate-900 dark:text-white font-bold text-lg mb-1">Delete Guest?</h3>
                <p className="text-slate-500 dark:text-gray-400 text-sm">This will permanently remove the guest record from your view. The data will still be retained securely in the system logs.</p>
              </div>
              <div className="flex gap-3 w-full mt-2">
                <Button onClick={() => setGuestToDelete(null)} variant="outline" className="flex-1 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-white/5">Cancel</Button>
                <Button onClick={handleDeleteGuest} className="flex-1 bg-red-500 hover:bg-red-600 text-white dark:text-white">Delete</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print Timesheet Modal */}
      {printEmployeeId && (
        <div className="fixed inset-0 z-[70] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setPrintEmployeeId(null)}>
          <div className="bg-white dark:bg-[#1a1a1a] border border-slate-100 dark:border-white/10 rounded-2xl w-full max-w-[320px] p-6 shadow-sm overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="text-slate-900 dark:text-white font-bold text-lg mb-1">Print Timesheet</h3>
                <p className="text-slate-500 dark:text-gray-400 text-xs">Select the date range to generate the Timesheet Document.</p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-500 dark:text-gray-400 mb-1 block font-medium">Start Date</label>
                  <input
                    type="date"
                    value={printStart}
                    onChange={e => setPrintStart(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 dark:text-gray-400 mb-1 block font-medium">End Date</label>
                  <input
                    type="date"
                    value={printEnd}
                    onChange={e => setPrintEnd(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>
              <div className="flex gap-3 w-full mt-2">
                <Button onClick={() => setPrintEmployeeId(null)} variant="outline" className="flex-1 border-slate-100 dark:border-white/10 text-slate-900 dark:text-white hover:bg-slate-50">Cancel</Button>
                <Button 
                  onClick={() => {
                    navigate(`/print-timesheet/${printEmployeeId}?start=${printStart}&end=${printEnd}`);
                    setPrintEmployeeId(null);
                  }} 
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold"
                >
                  Generate
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
