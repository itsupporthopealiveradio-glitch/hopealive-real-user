import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { logAudit } from "../../lib/audit";
import {
  QrCode, ShieldCheck, Users, LogOut, ArrowLeft, CheckCircle2,
  XCircle, Clock, UserCheck, AlertCircle, Camera, RefreshCw, Eye
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { motion, AnimatePresence } from "framer-motion";

interface GuestInvite {
  id: string;
  guest_name: string;
  guest_count: number;
  token: string;
  status: string;
  checked_in_at: string | null;
  checked_out_at: string | null;
  created_at: string;
  host_employee_id: string;
  employees?: { full_name: string } | null;
}

function displayGuestNames(value: string): string {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.join(", ") : value;
  } catch {
    return value;
  }
}

export default function SecurityDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"scanner" | "register">("scanner");
  const [displayName, setDisplayName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Scanner state
  const [scanResult, setScanResult] = useState<any>(null);
  const [scanError, setScanError] = useState("");
  const [scanLoading, setScanLoading] = useState(false);
  const [idPhotoFile, setIdPhotoFile] = useState<File | null>(null);
  const [manualToken, setManualToken] = useState("");
  const [autoScanToken, setAutoScanToken] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState("");

  // Guest Register
  const [invites, setInvites] = useState<GuestInvite[]>([]);
  const [registerFilter, setRegisterFilter] = useState<"all" | "pending" | "checked_in" | "checked_out">("all");

  useEffect(() => {
    const init = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) { navigate("/"); return; }

      const user = sessionData.session.user;

      const { data: emp } = await supabase
        .from("employees")
        .select("id, role, full_name, status")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (!emp || emp.status !== "active" || emp.role !== "security_officer") {
        navigate("/dashboard");
        return;
      }

      setDisplayName(emp.full_name);
      setEmployeeId(emp.id);
      setIsLoading(false);
      fetchInvites();

      // Check for token in URL (from QR code scan via native camera)
      const hashParts = window.location.hash.split('?');
      if (hashParts.length > 1) {
        const params = new URLSearchParams(hashParts[1]);
        const tokenFromUrl = params.get('token');
        if (tokenFromUrl) {
          setManualToken(tokenFromUrl);
          setAutoScanToken(tokenFromUrl);
          // Clean up URL so it doesn't re-trigger on refresh
          window.history.replaceState(null, "", window.location.pathname + window.location.hash.split('?')[0]);
        }
      }
    };

    init();

    // Realtime subscription for guest invites
    const channel = supabase
      .channel("security-invites")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "guest_invites",
      }, () => {
        fetchInvites();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [navigate]);

  const fetchInvites = async () => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [{ data: inviteData }, { data: employeeData }] = await Promise.all([
      supabase
        .from("guest_invites")
        .select("*")
        .neq("status", "cancelled")
        .neq("status", "expired")
        .gte("created_at", todayStart.toISOString())
        .order("created_at", { ascending: false }),
      supabase.from("employees").select("id, full_name"),
    ]);

    if (inviteData) {
      const employeesById = new Map((employeeData || []).map((employee: any) => [employee.id, employee]));
      setInvites(inviteData.map((invite: any) => ({
        ...invite,
        employees: employeesById.get(invite.host_employee_id) || null,
      })));
    }
  };

  const handleScanToken = async (tokenStr: string) => {
    setScanLoading(true);
    setScanError("");
    setScanResult(null);
    setActionSuccess("");
    setIdPhotoFile(null);

    logAudit("Security Scanned QR", `Attempting scan for token: ${tokenStr.substring(0, 10)}...`);

    try {
      let parsedToken = tokenStr.trim();

      // Try to parse as JSON (from QR code)
      try {
        const parsed = JSON.parse(parsedToken);
        if (parsed.type === "har_guest" && parsed.token) {
          parsedToken = parsed.token;
        }
      } catch {
        // Not JSON, treat as raw token
      }

      const { data, error } = await supabase
        .from("guest_invites")
        .select("*")
        .eq("token", parsedToken)
        .maybeSingle();

      if (error || !data) {
        setScanError("No invitation found with this QR code.");
        setScanLoading(false);
        return;
      }

      const { data: hostEmployee } = await supabase
        .from("employees")
        .select("id, full_name")
        .eq("id", data.host_employee_id)
        .maybeSingle();
      setScanResult({ ...data, employees: hostEmployee || null });
    } catch (err: any) {
      setScanError(err.message || "Failed to process QR code.");
    } finally {
      setScanLoading(false);
    }
  };

  useEffect(() => {
    if (autoScanToken) {
      handleScanToken(autoScanToken);
      setAutoScanToken("");
    }
  }, [autoScanToken]);

  const handleCheckIn = async () => {
    if (!scanResult) return;
    if (!idPhotoFile) {
      setScanError("You must capture an ID photo before approving.");
      return;
    }

    setActionLoading(true);
    try {
      // 1. Upload the ID photo
      const fileExt = idPhotoFile.name.split('.').pop();
      const fileName = `${scanResult.id}-${Date.now()}.${fileExt}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('guest_ids')
        .upload(fileName, idPhotoFile);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('guest_ids')
        .getPublicUrl(fileName);

      // 2. Update the DB
      const { error } = await supabase
        .from("guest_invites")
        .update({
          status: "checked_in",
          checked_in_at: new Date().toISOString(),
          checked_in_by: employeeId,
          id_photo_url: publicUrl
        })
        .eq("id", scanResult.id);

      if (error) throw error;

      logAudit("Security Check-in Guest", `Success: ${scanResult.guest_name} (Host: ${scanResult.employees?.full_name})`);

      setActionSuccess(`✓ ${scanResult.guest_name} approved!`);
      setScanResult({ ...scanResult, status: "checked_in", checked_in_at: new Date().toISOString() });
      fetchInvites();
    } catch (err: any) {
      setScanError(err.message || "Failed to approve guest.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDecline = async () => {
    if (!scanResult) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("guest_invites")
        .update({
          status: "declined",
        })
        .eq("id", scanResult.id);

      if (error) throw error;

      logAudit("Security Decline Guest", `Declined: ${scanResult.guest_name}`);

      setActionSuccess(`✕ ${scanResult.guest_name} declined.`);
      setScanResult({ ...scanResult, status: "declined" });
      fetchInvites();
    } catch (err: any) {
      setScanError(err.message || "Failed to decline guest.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async (inviteId?: string) => {
    const targetId = inviteId || scanResult?.id;
    if (!targetId) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("guest_invites")
        .update({
          status: "checked_out",
          checked_out_at: new Date().toISOString(),
          checked_out_by: employeeId,
        })
        .eq("id", targetId);

      if (error) throw error;

      logAudit("Security Check-out Guest", `Check-out: ID ${targetId}`);

      if (!inviteId && scanResult) {
        setActionSuccess(`✓ ${scanResult.guest_name} checked out successfully!`);
        setScanResult({ ...scanResult, status: "checked_out", checked_out_at: new Date().toISOString() });
      }
      fetchInvites();
    } catch (err: any) {
      setScanError(err.message || "Failed to check out guest.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const filteredInvites = invites.filter(inv => {
    if (registerFilter === "all") return true;
    return inv.status === registerFilter;
  });

  const todayStats = {
    total: invites.reduce((sum, inv) => sum + inv.guest_count, 0),
    checkedIn: invites.filter(i => i.status === "checked_in").reduce((sum, inv) => sum + inv.guest_count, 0),
    checkedOut: invites.filter(i => i.status === "checked_out").reduce((sum, inv) => sum + inv.guest_count, 0),
    pending: invites.filter(i => i.status === "pending").reduce((sum, inv) => sum + inv.guest_count, 0),
    deleted: invites.filter(i => i.status === "deleted").reduce((sum, inv) => sum + inv.guest_count, 0),
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center p-4">
        <div className="w-full max-w-[420px] mx-auto bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl text-center">
          <span className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto block" />
          <p className="text-sm text-gray-300 mt-4 font-semibold">Loading Security Dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent flex flex-col items-center p-4 font-sans">
      <div className="w-full max-w-[480px] mx-auto space-y-4">
        {/* Header */}
        <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <ShieldCheck size={20} className="text-amber-400" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-white">{displayName}</h1>
                <p className="text-[10px] text-amber-400 uppercase tracking-widest font-semibold">Security Officer</p>
              </div>
            </div>
            <button onClick={handleLogout} className="w-9 h-9 rounded-lg hover:bg-white/5 flex items-center justify-center transition-colors">
              <LogOut size={18} className="text-gray-400" />
            </button>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "Expected", value: todayStats.total, color: "text-white" },
              { label: "Pending", value: todayStats.pending, color: "text-amber-400" },
              { label: "Arrived", value: todayStats.checkedIn, color: "text-emerald-400" },
              { label: "Left", value: todayStats.checkedOut, color: "text-gray-400" },
              { label: "Deleted", value: todayStats.deleted, color: "text-red-400" },
            ].map((stat) => (
              <div key={stat.label} className="bg-white/5 rounded-lg p-2 text-center border border-white/5">
                <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-[9px] text-gray-500 uppercase tracking-wider">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-1.5 flex gap-1">
          {([
            { key: "scanner", label: "QR Scanner", icon: QrCode },
            { key: "register", label: "Guest Register", icon: Users },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 h-10 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all duration-200 ${
                activeTab === key
                  ? "bg-amber-500 text-black shadow-lg shadow-amber-500/20"
                  : "text-gray-400 hover:bg-white/5"
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>

        {/* Scanner Tab */}
        {activeTab === "scanner" && (
          <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Camera size={16} className="text-amber-400" />
              Scan Guest QR Code
            </h2>

            {/* Manual Token Input (for web testing) */}
            <div className="space-y-2">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Enter or Paste Invite Token</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  placeholder="Paste QR token here..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-colors"
                />
                <Button
                  onClick={() => { if (manualToken.trim()) handleScanToken(manualToken); }}
                  disabled={!manualToken.trim() || scanLoading}
                  className="h-10 px-5 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-xl text-xs shrink-0"
                >
                  {scanLoading ? <RefreshCw size={14} className="animate-spin" /> : "Scan"}
                </Button>
              </div>
            </div>

            {/* Scan Error */}
            <AnimatePresence>
              {scanError && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center gap-2"
                >
                  <XCircle size={16} className="text-red-400 shrink-0" />
                  <p className="text-xs text-red-300">{scanError}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action Success */}
            <AnimatePresence>
              {actionSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-center gap-2"
                >
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  <p className="text-xs text-emerald-300">{actionSuccess}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Scan Result Card */}
            <AnimatePresence>
              {scanResult && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                  className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden"
                >
                  {/* Guest Info Header */}
                  <div className="p-4 border-b border-white/5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-white font-bold text-sm truncate pr-2" title={displayGuestNames(scanResult.guest_name)}>{displayGuestNames(scanResult.guest_name)}</h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        scanResult.status === "pending" ? "bg-amber-500/20 text-amber-400" :
                        scanResult.status === "checked_in" ? "bg-emerald-500/20 text-emerald-400" :
                        scanResult.status === "declined" ? "bg-red-500/20 text-red-400" :
                        "bg-gray-500/20 text-gray-400"
                      }`}>
                        {scanResult.status === "pending" ? "Awaiting" : scanResult.status === "checked_in" ? "Arrived" : scanResult.status === "declined" ? "Declined" : "Left"}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-black/30 rounded-lg p-2">
                        <p className="text-[9px] text-gray-500 uppercase">Guests</p>
                        <p className="text-lg font-bold text-amber-400">{scanResult.guest_count}</p>
                      </div>
                      <div className="bg-black/30 rounded-lg p-2">
                        <p className="text-[9px] text-gray-500 uppercase">Invited By</p>
                        <p className="text-xs font-semibold text-white truncate">{scanResult.employees?.full_name || "Unknown"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="p-4 space-y-2">
                    {scanResult.status === "pending" && (
                      <div className="space-y-4">
                        <div className="p-4 border-2 border-dashed border-gray-700 rounded-xl bg-white/[0.02]">
                          <label className="block text-center cursor-pointer">
                            <input 
                              type="file" 
                              accept="image/*" 
                              capture="environment" 
                              className="hidden"
                              onChange={(e) => setIdPhotoFile(e.target.files?.[0] || null)}
                            />
                            {idPhotoFile ? (
                              <div className="flex flex-col items-center space-y-2">
                                <div className="w-16 h-16 rounded-lg bg-emerald-500/20 text-emerald-500 flex items-center justify-center">
                                  <Camera size={24} />
                                </div>
                                <span className="text-sm font-bold text-emerald-400">ID Captured</span>
                                <span className="text-xs text-gray-500 underline">Tap to retake</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center space-y-2 group">
                                <div className="w-16 h-16 rounded-lg bg-white/5 group-hover:bg-amber-500/20 text-gray-400 group-hover:text-amber-500 flex items-center justify-center transition-colors">
                                  <Camera size={24} />
                                </div>
                                <span className="text-sm font-bold text-gray-300">Take ID Photo</span>
                                <span className="text-xs text-amber-500/70">Required for entry</span>
                              </div>
                            )}
                          </label>
                        </div>
                        
                        <div className="flex gap-2">
                          <Button
                            onClick={handleDecline}
                            disabled={actionLoading}
                            className="flex-1 h-12 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-bold rounded-xl text-sm flex items-center justify-center gap-2"
                          >
                            {actionLoading ? <RefreshCw size={16} className="animate-spin" /> : <XCircle size={16} />}
                            Decline
                          </Button>
                          <Button
                            onClick={handleCheckIn}
                            disabled={actionLoading || !idPhotoFile}
                            className={`flex-[2] h-12 font-bold rounded-xl text-sm flex items-center justify-center gap-2 ${idPhotoFile ? "bg-emerald-500 hover:bg-emerald-600 text-white" : "bg-gray-700 text-gray-400 cursor-not-allowed"}`}
                          >
                            {actionLoading ? <RefreshCw size={16} className="animate-spin" /> : <UserCheck size={16} />}
                            Approve ({scanResult.guest_count})
                          </Button>
                        </div>
                      </div>
                    )}

                    {scanResult.status === "checked_in" && (
                      <Button
                        onClick={() => handleCheckOut()}
                        disabled={actionLoading}
                        className="w-full h-12 bg-red-500/80 hover:bg-red-600 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2"
                      >
                        {actionLoading ? <RefreshCw size={16} className="animate-spin" /> : <LogOut size={16} />}
                        Check Out {scanResult.guest_count} Guest{scanResult.guest_count > 1 ? "s" : ""}
                      </Button>
                    )}

                    {scanResult.status === "checked_out" && (
                      <div className="bg-gray-500/10 border border-gray-500/20 rounded-xl p-3 text-center">
                        <p className="text-xs text-gray-400">These guests have already left the premises.</p>
                      </div>
                    )}

                    <Button
                      onClick={() => { setScanResult(null); setScanError(""); setActionSuccess(""); setManualToken(""); }}
                      variant="outline"
                      className="w-full h-10 border-white/10 text-gray-400 hover:bg-white/5 rounded-xl text-xs"
                    >
                      Scan Next
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Guest Register Tab */}
        {activeTab === "register" && (
          <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Eye size={16} className="text-amber-400" />
                Today's Guest Register
              </h2>
              <button onClick={fetchInvites} className="w-8 h-8 rounded-lg hover:bg-white/5 flex items-center justify-center">
                <RefreshCw size={14} className="text-gray-400" />
              </button>
            </div>

            {/* Filter Chips */}
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {([
                { key: "all", label: "All" },
                { key: "pending", label: "Pending" },
                { key: "checked_in", label: "Arrived" },
                { key: "checked_out", label: "Left" },
                { key: "deleted", label: "Deleted" },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setRegisterFilter(key)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
                    registerFilter === key
                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                      : "bg-white/5 text-gray-400 border border-white/5 hover:bg-white/10"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Invite List */}
            {filteredInvites.length === 0 ? (
              <div className="text-center py-12">
                <Users size={36} className="mx-auto text-gray-600 mb-3" />
                <p className="text-gray-400 text-sm">No guests {registerFilter !== "all" ? `with status "${registerFilter}"` : "expected today"}.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredInvites.map((invite) => (
                  <div
                    key={invite.id}
                    className="bg-white/[0.03] border border-white/5 rounded-xl p-3 hover:bg-white/[0.06] transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${
                          invite.status === "pending" ? "bg-amber-400" :
                          invite.status === "checked_in" ? "bg-emerald-400 animate-pulse" :
                          "bg-gray-500"
                        }`} />
                        <span className="text-sm text-white font-semibold truncate" title={displayGuestNames(invite.guest_name)}>{displayGuestNames(invite.guest_name)}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold shrink-0 ${
                        invite.status === "pending" ? "bg-amber-500/20 text-amber-400" :
                        invite.status === "checked_in" ? "bg-emerald-500/20 text-emerald-400" :
                        invite.status === "declined" ? "bg-red-500/20 text-red-400" :
                        invite.status === "deleted" ? "bg-red-500/20 text-red-400 line-through opacity-70" :
                        "bg-gray-500/20 text-gray-400"
                      }`}>
                        {invite.status === "pending" ? "PENDING" : invite.status === "checked_in" ? "ARRIVED" : invite.status === "declined" ? "DECLINED" : invite.status === "deleted" ? "DELETED" : "LEFT"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-gray-500">
                        Invited by <span className="text-gray-400 font-medium">{invite.employees?.full_name || "Unknown"}</span>
                        {invite.checked_in_at && (
                          <> · In at <span className="text-emerald-400">{new Date(invite.checked_in_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}</span></>
                        )}
                        {invite.checked_out_at && (
                          <> · Out at <span className="text-gray-400">{new Date(invite.checked_out_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}</span></>
                        )}
                      </p>
                      {invite.status === "checked_in" && (
                        <button
                          onClick={() => handleCheckOut(invite.id)}
                          className="text-[10px] text-red-400 hover:text-red-300 font-bold uppercase tracking-wider"
                        >
                          Check Out
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
