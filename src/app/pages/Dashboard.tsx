import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import { Clock, Calendar, LogOut, ArrowLeft, UserPlus, Users, X, Share2, Copy, Moon, Sun, RefreshCw, CheckCircle2, Download, Printer, Play, Pause, Volume2, Headphones, MessageSquare } from "lucide-react";
import { logAudit } from "../../lib/audit";
import { supabase } from "../../lib/supabase";
import { parseWampTimestamp, wampMe } from "../../lib/wampApi";
import { secureStorage } from "../../lib/crypto";
import QRCode from "react-qr-code";
import { Share as NativeShare } from "@capacitor/share";

export default function Dashboard() {
  const navigate = useNavigate();
  const [isActive, setIsActive] = useState(false);
  const [lastClockTime, setLastClockTime] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [department, setDepartment] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [empNo, setEmpNo] = useState("");
  const [orgId, setOrgId] = useState("");
  const [employeeRole, setEmployeeRole] = useState("Employee");
  
  // Radio Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [liveShow, setLiveShow] = useState("Rush");
  const [liveArtworkVersion, setLiveArtworkVersion] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            setIsPlaying(true);
          }).catch((error) => {
            console.error("Playback failed:", error);
          });
        } else {
          setIsPlaying(true);
        }
      }
    }
  };

  const handleRefreshRadio = () => {
    setIsRefreshing(true);
    setLiveShow("Rush");
    setLiveArtworkVersion(Date.now());
    if (audioRef.current) {
      audioRef.current.src = `https://edge.iono.fm/xice/249_medium.mp3?t=${new Date().getTime()}`;
      audioRef.current.load();
      if (isPlaying) {
        audioRef.current.play().catch(e => console.error("Playback failed after refresh:", e));
      }
    }
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const handleShare = async () => {
    const shareData = {
      title: 'Hope Alive Radio',
      text: 'Listen to Hope Alive Radio live!',
      url: 'https://hopealiveonlineradio.com',
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
      }
    }
    try {
      await NativeShare.share({ ...shareData, dialogTitle: 'Share Hope Alive Radio' });
    } catch {
      await navigator.clipboard.writeText(shareData.url);
      alert("Link copied to clipboard!");
    }
  };

  const handleListenWith = () => {
    window.open("https://iono.fm/s/249", "_blank");
  };

  const handleContact = () => {
    window.location.href = "mailto:info@hopealiveradio.com";
  };

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showIDCard, setShowIDCard] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem("theme") === "dark");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    localStorage.setItem("theme", isDarkMode ? "dark" : "light");
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  // Guest Invite Modal
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [guestNames, setGuestNames] = useState<string[]>([""]);
  const [guestToCancel, setGuestToCancel] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [createdInvite, setCreatedInvite] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [guestCount, setGuestCount] = useState(1);

  // My Guests Today
  const [myGuests, setMyGuests] = useState<any[]>([]);

  // Print Timesheet Modal
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printStart, setPrintStart] = useState("");
  const [printEnd, setPrintEnd] = useState("");

  useEffect(() => {
    const init = async () => {
      // Auth guard
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        navigate("/");
        return;
      }

      const user = sessionData.session.user;
      setUserEmail(user.email || "");

      let authenticatedUser;
      try {
        authenticatedUser = await wampMe();
      } catch (error) {
        console.error("Error validating WAMP session:", error);
        await supabase.auth.signOut();
        navigate("/");
        return;
      }
      
      // Resolve the employee from the canonical backend session link first.
      let employeeData = null;
      let empErr = null;
      if (authenticatedUser.employeeId) {
        const result = await supabase
          .from("employees")
          .select("*")
          .eq("id", authenticatedUser.employeeId)
          .maybeSingle();
        employeeData = result.data;
        empErr = result.error;
      }

      if (empErr) console.error("Error fetching employee by ID:", empErr);

      if (!employeeData) {
        // Repair older records that were linked with auth_user_id only.
        const { data: empByEmail, error: emailErr } = await supabase
          .from("employees")
          .select("*")
          .eq("email", user.email?.toLowerCase())
          .maybeSingle();
        if (emailErr) console.error("Error fetching employee by email:", emailErr);
        
        if (empByEmail && ['active', 'pending'].includes(empByEmail.status)) {
          employeeData = empByEmail;
          await supabase.from("employees").update({ user_id: user.id, auth_user_id: user.id }).eq("id", empByEmail.id);
        }
      }

      if (!employeeData) {
        await supabase.auth.signOut();
        navigate("/?error=removed");
        return;
      }

      // SECURITY OFFICER REDIRECT
      if (employeeData.role === "security_officer") {
        navigate("/security");
        return;
      }

      setDisplayName(employeeData.full_name);
      setDepartment(employeeData.department || "Employee");
      setEmployeeId(employeeData.id);
      setEmpNo(employeeData.id_number || "");
      setOrgId(employeeData.org_id);
      setEmployeeRole(employeeData.role || "Employee");
      if (employeeData.profile_image_data) {
        setPhotoUrl(employeeData.profile_image_data);
      } else {
        setPhotoUrl(null);
      }

      // Check biometric enrollment
      const { data: biometrics } = await supabase
        .from("biometric_enrollments")
        .select("id")
        .eq("employee_id", employeeData.id)
        .maybeSingle();

      if (!biometrics) {
        navigate("/face-onboarding");
        return;
      }

      // Sync live clock status from DB
      const { data: activeRecord } = await supabase
        .from("attendance_records")
        .select("clock_in_at")
        .eq("employee_id", employeeData.id)
        .eq("status", "in_progress")
        .maybeSingle();

      if (activeRecord) {
        setIsActive(true);
        const activeClockIn = parseWampTimestamp(activeRecord.clock_in_at || activeRecord.clock_in);
        setLastClockTime(activeClockIn.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }));
        await secureStorage.setItem("isActive", "true");
        await secureStorage.setItem("clockInTime", activeClockIn.toISOString());
      } else {
        setIsActive(false);
        secureStorage.removeItem("isActive");
        secureStorage.removeItem("clockInTime");
        const savedTime = await secureStorage.getItem("lastClockTime");
        if (savedTime) setLastClockTime(savedTime);
      }

      // Fetch my guests today
      fetchMyGuests(employeeData.id);

      setIsLoading(false);
    };

    init();

    // Listen for storage changes in case of multi-tab usage
    const handleStorage = async () => {
      const updatedActive = await secureStorage.getItem("isActive") === "true";
      setIsActive(updatedActive);
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [navigate]);

  const fetchMyGuests = async (empId: string) => {
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const { data } = await supabase
      .from("guest_invites")
      .select("*")
      .eq("host_employee_id", empId)
      .neq("status", "cancelled")
      .neq("status", "expired")
      .gte("created_at", twentyFourHoursAgo.toISOString())
      .order("created_at", { ascending: false });

    if (data) setMyGuests(data);
  };

  // Subscribe to live updates on my guests
  useEffect(() => {
    if (!employeeId) return;

    const channel = supabase
      .channel("my-guests")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "guest_invites",
        filter: `host_employee_id=eq.${employeeId}`,
      }, () => {
        fetchMyGuests(employeeId);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [employeeId]);

  // Subscribe to live updates on my profile (e.g. Photo upload)
  useEffect(() => {
    if (!employeeId) return;

    const channel = supabase
      .channel("my-profile")
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "employees",
        filter: `id=eq.${employeeId}`,
      }, (payload) => {
        if (payload.new) {
          if ('profile_image_data' in payload.new) {
            setPhotoUrl((payload.new as any).profile_image_data);
          }
          if ('id_number' in payload.new) {
            setEmpNo((payload.new as any).id_number);
          }
          if ('full_name' in payload.new) {
            setDisplayName((payload.new as any).full_name);
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [employeeId]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    secureStorage.removeItem("isActive");
    secureStorage.removeItem("clockInTime");
    secureStorage.removeItem("lastClockTime");
    navigate("/");
  };

  const generateToken = () => {
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let token = "";
    for (let i = 0; i < 12; i++) token += chars[Math.floor(Math.random() * chars.length)];
    return token;
  };

  const handleCreateInvite = async () => {
    setInviteError(null);
    const names = guestNames.map(name => name.trim());
    if (names.some(name => !name)) {
      setInviteError("Please enter a name for every guest.");
      return;
    }
    setInviteLoading(true);
    try {
      const token = generateToken();

      const { data, error } = await supabase
        .from("guest_invites")
        .insert({
          org_id: orgId,
          host_employee_id: employeeId,
          guest_name: JSON.stringify(names),
          token: token,
          status: "pending",
          guest_count: guestCount,
        })
        .select()
        .single();

      if (error) throw error;

      setCreatedInvite({ ...data, token: data?.token || token, host_employee_id: data?.host_employee_id || employeeId });
      fetchMyGuests(employeeId);
      logAudit("User Created Guest Invite", `Success: ${names.join(", ")} (${guestCount} guests)`);
    } catch (err: any) {
      if (err.message?.includes("guest_count")) {
        setInviteError("Database Update Required: Please run the SQL command in Supabase to add the 'guest_count' column to the 'guest_invites' table, then reload the schema cache.");
      } else {
        setInviteError(err.message || "Failed to create invite.");
      }
    } finally {
      setInviteLoading(false);
    }
  };

  const getInviteLink = (token: string) => {
    // Automatically use the correct URL based on environment so it works reliably everywhere
    const base = window.location.origin + window.location.pathname;
    return `${base.replace(/\/$/, '')}/#/invite/${token}`;
  };

  const handleCopyLink = (token: string) => {
    navigator.clipboard.writeText(getInviteLink(token));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareLink = async (token: string, guestName: string) => {
    const link = getInviteLink(token);
    const shareData = {
      title: 'Hope Alive VIP Pass',
      text: `Guest pass for ${guestName}`,
      url: link,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
      }
    }
    try {
      await NativeShare.share({ ...shareData, dialogTitle: 'Share Guest Pass' });
    } catch {
      handleCopyLink(token);
    }
  };

  const resetInviteModal = () => {
    setShowInviteModal(false);
    setTimeout(() => {
      setGuestNames([""]);
      setCreatedInvite(null);
      setCopied(false);
      setInviteError(null);
      setGuestCount(1);
    }, 200);
  };

  const guestStatusLabel = (status: string) => {
    switch (status) {
      case "pending": return { label: "Awaiting", style: "bg-amber-500/20 text-amber-400" };
      case "checked_in": return { label: "Arrived", style: "bg-emerald-500/20 text-emerald-400" };
      case "checked_out": return { label: "Left", style: "bg-gray-500/20 text-gray-400" };
      case "cancelled": return { label: "Cancelled", style: "bg-red-500/20 text-red-400" };
      case "deleted": return { label: "Deleted", style: "bg-red-500/20 text-red-400 line-through opacity-70" };
      default: return { label: status, style: "bg-gray-500/20 text-gray-400" };
    }
  };

  if (isLoading) {
    return (
      <div className={`${isDarkMode ? "dark" : ""} min-h-screen bg-[#f0f4f8] dark:bg-[#121212] flex items-center justify-center p-4`}>
        <div className="w-full max-w-[385px] mx-auto bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/20 rounded-2xl p-6 shadow-xl text-center">
          <span className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto block" />
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-4 font-semibold">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${isDarkMode ? "dark" : ""} min-h-screen bg-[#f0f4f8] dark:bg-[#121212] pb-24 font-sans transition-colors duration-300`}>
      <div className="w-full max-w-[400px] mx-auto p-6 space-y-6">
        
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">{displayName}</h1>
            <p className="text-sm text-slate-500 dark:text-gray-400 font-medium leading-none">{userEmail}</p>
            <div className="flex items-center gap-2 mt-1">
              {department && (
                <span className="inline-block px-2 py-0.5 rounded-full bg-slate-200 border border-slate-300 text-[10px] uppercase tracking-wider text-slate-600 dark:text-slate-400 font-bold">
                  {department}
                </span>
              )}
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                {empNo ? (empNo.toUpperCase().startsWith('EMP') ? empNo : `EMP-${empNo}`) : `EMP-${employeeId.substring(0, 6)}`}
              </span>
            </div>
          </div>
          <Avatar className="w-14 h-14 border-2 border-white shadow-sm bg-slate-100 shrink-0">
            <AvatarFallback className="bg-primary text-black font-bold text-lg">
              {displayName.split(' ').map(n => n[0]).join('')}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center gap-2">
          <Badge
            className={`text-xs px-3 py-1 border-none font-bold shadow-sm ${
              isActive
                ? 'bg-green-100 text-green-700 hover:bg-green-100'
                : 'bg-red-100 text-red-700 hover:bg-red-100'
            }`}
          >
            {isActive ? "● Clocked In" : "● Clocked Out"}
          </Badge>
          {lastClockTime && (
             <span className="text-xs text-slate-500 dark:text-gray-400 font-medium">Last: {lastClockTime}</span>
          )}
        </div>

        {/* 2x2 Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* Attendance */}
          <div 
            onClick={() => navigate("/attendance")}
            className="bg-white dark:bg-[#1a1a1a] p-4 rounded-[1.25rem] shadow-sm border border-slate-100 dark:border-white/10 flex flex-col gap-3 cursor-pointer transition-transform hover:scale-105 active:scale-95"
          >
            <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">Attendance</h3>
              <p className="text-[10px] text-slate-500 dark:text-gray-400 font-bold mt-0.5">View your records</p>
            </div>
          </div>

          {/* Invite Guest */}
          <div 
            onClick={() => setShowInviteModal(true)}
            className="bg-white dark:bg-[#1a1a1a] p-4 rounded-[1.25rem] shadow-sm border border-slate-100 dark:border-white/10 flex flex-col gap-3 cursor-pointer transition-transform hover:scale-105 active:scale-95"
          >
            <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">Invite Guest</h3>
              <p className="text-[10px] text-slate-500 dark:text-gray-400 font-bold mt-0.5">Generate VIP passes</p>
            </div>
          </div>

          {/* Timesheet */}
          <div 
            onClick={() => {
              const now = new Date();
              const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
              const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
              setPrintStart(firstDay.toISOString().split('T')[0]);
              setPrintEnd(lastDay.toISOString().split('T')[0]);
              setShowPrintModal(true);
            }}
            className="bg-white dark:bg-[#1a1a1a] p-4 rounded-[1.25rem] shadow-sm border border-slate-100 dark:border-white/10 flex flex-col gap-3 cursor-pointer transition-transform hover:scale-105 active:scale-95"
          >
            <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center">
              <Download className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">Timesheet</h3>
              <p className="text-[10px] text-slate-500 dark:text-gray-400 font-bold mt-0.5">Download monthly PDF</p>
            </div>
          </div>

          {/* Logout */}
          <div 
            onClick={handleLogout}
            className="bg-white dark:bg-[#1a1a1a] p-4 rounded-[1.25rem] shadow-sm border border-slate-100 dark:border-white/10 flex flex-col gap-3 cursor-pointer transition-transform hover:scale-105 active:scale-95"
          >
            <div className="w-10 h-10 rounded-full bg-red-50 border border-red-100 flex items-center justify-center">
              <LogOut className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">Logout</h3>
              <p className="text-[10px] text-slate-500 dark:text-gray-400 font-bold mt-0.5">Sign out securely</p>
            </div>
          </div>
        </div>

        {/* Live Radio Player Component */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Live Radio</h3>
            <button onClick={handleRefreshRadio} className="text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5">
              <RefreshCw size={12} /> Refresh Web
            </button>
          </div>
          <div className="bg-white dark:bg-[#1a1a1a] rounded-[1.25rem] shadow-sm border border-slate-100 dark:border-white/10 overflow-hidden">
            {/* Banner */}
            <div className="w-full h-[120px] bg-slate-900 relative">
               <img src={`https://cdn.iono.fm/files/p3221/banner_249_20250905_141622_750.jpeg?v=${liveArtworkVersion}`} alt={`${liveShow} live artwork`} className="w-full h-full object-cover" />
            </div>
            
            <div className="p-4 pb-5">
              {/* Header Info */}
              <div className="flex gap-4">
                <img src="/logo.png" alt="Logo" className="w-[80px] h-[80px] rounded-lg shadow-sm border border-slate-100 dark:border-white/10 shrink-0 bg-white dark:bg-[#1a1a1a] object-contain p-2" />
                <div className="flex-1 min-w-0 pt-1">
                  <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] ${isPlaying ? 'animate-pulse' : ''}`}></div>
                  <span className={`bg-emerald-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-sm uppercase tracking-wide shrink-0 ${isRefreshing ? 'animate-pulse' : ''}`}>ON AIR · {liveShow}</span>
                </div>
                  
                  {/* Player Controls */}
                  <div className="mt-2.5 flex items-center gap-3">
                    <button onClick={togglePlay} className="w-10 h-10 rounded-full border-2 border-slate-600 flex items-center justify-center shrink-0 hover:bg-slate-50 dark:bg-white/5 transition-colors">
                      {isPlaying ? <Pause className="w-4 h-4 text-slate-700 dark:text-slate-300 fill-slate-700" /> : <Play className="w-4 h-4 text-slate-700 dark:text-slate-300 fill-slate-700 ml-1" />}
                    </button>
                    
                    {/* Scrub line */}
                    <div className="flex-1 flex items-center gap-2">
                       <div className="h-[2px] w-full bg-slate-200 relative overflow-hidden">
                          {isPlaying && <div className="absolute top-0 left-0 h-full bg-[#6161D6] animate-pulse w-full opacity-40"></div>}
                       </div>
                       <span className="text-[10px] font-mono text-slate-500 dark:text-gray-400">Live</span>
                    </div>
                    
                    <Volume2 className="w-4 h-4 text-slate-400 shrink-0" />
                  </div>
                </div>
              </div>
              
              {/* Audio Element (Hidden) */}
              <audio ref={audioRef} src="https://edge.iono.fm/xice/249_medium.mp3" preload="none" playsInline />

              {/* Description */}
              <p className="text-xs text-slate-500 dark:text-gray-400 mt-4 leading-relaxed">
                Hope Alive is a Radio Station for all ages, groups, races, and cultures. The sole basis of our beliefs is the Bible, God's infallible written Word.
              </p>
              
              {/* Action Buttons */}
              <div className="grid grid-cols-3 gap-2 mt-4">
                <button onClick={handleShare} className="flex items-center justify-center gap-2 py-2.5 px-2 rounded-xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                  <Share2 size={14} className="text-slate-500 group-hover:text-primary transition-colors" />
                  <span className="text-[11px] font-bold">Share</span>
                </button>
                <button onClick={handleListenWith} className="flex items-center justify-center gap-2 py-2.5 px-2 rounded-xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                  <Headphones size={14} className="text-slate-500 group-hover:text-primary transition-colors" />
                  <span className="text-[11px] font-bold truncate">Listen with...</span>
                </button>
                <button onClick={handleContact} className="flex items-center justify-center gap-2 py-2.5 px-2 rounded-xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                  <MessageSquare size={14} className="text-slate-500 group-hover:text-primary transition-colors" />
                  <span className="text-[11px] font-bold">Contact</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* My Guests Today */}
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            My Guests Today
            {myGuests.length > 0 && (
              <span className="bg-primary/20 text-primary-focus text-xs px-2 py-0.5 rounded-full font-bold">
                {myGuests.length}
              </span>
            )}
          </h3>
          {myGuests.length > 0 ? (
            <div className="space-y-3">
              {myGuests.map((guest) => {
                const s = guestStatusLabel(guest.status);
                let displayNames = guest.guest_name;
                try {
                  const parsed = JSON.parse(guest.guest_name);
                  if (Array.isArray(parsed)) displayNames = parsed.join(", ");
                } catch (e) {}

                return (
                  <div
                    key={guest.id}
                    className="bg-white dark:bg-[#1a1a1a] p-4 rounded-[1.25rem] shadow-sm border border-slate-100 dark:border-white/10 flex items-center gap-4"
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                      guest.status === "pending" ? "bg-amber-50" :
                      guest.status === "checked_in" ? "bg-emerald-50" :
                      "bg-slate-100"
                    }`}>
                      <Users className={`w-6 h-6 ${
                        guest.status === "pending" ? "text-amber-500" :
                        guest.status === "checked_in" ? "text-emerald-500" :
                        "text-slate-400"
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm truncate">{displayNames}</h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-slate-500 dark:text-gray-400 font-bold">{guest.guest_count} {guest.guest_count === 1 ? 'Guest' : 'Guests'}</span>
                        <span className="text-[10px] text-slate-300">•</span>
                        <span className={`text-[10px] font-bold ${s.style.split(' ')[1]}`}>{s.label}</span>
                      </div>
                    </div>
                    {guest.status === "pending" && (
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          onClick={() => setGuestToCancel(guest.id)}
                          className="w-8 h-8 rounded-full bg-red-50 hover:bg-red-100 flex items-center justify-center transition-colors"
                          title="Cancel Invite"
                        >
                          <X size={14} className="text-red-500" />
                        </button>
                        <button
                          onClick={() => handleShareLink(guest.token, displayNames)}
                          className="w-8 h-8 rounded-full bg-slate-50 dark:bg-white/5 hover:bg-slate-100 flex items-center justify-center transition-colors"
                          title="Share Pass"
                        >
                          <Share2 size={14} className="text-slate-600 dark:text-slate-400" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white dark:bg-[#1a1a1a] p-5 rounded-[1.25rem] shadow-sm border border-slate-100 dark:border-white/10 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-slate-400" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">No guests today</h4>
                <p className="text-xs text-slate-500 dark:text-gray-400 font-medium">Tap invite to add someone</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 w-full flex justify-center pb-6 px-4 pointer-events-none z-40">
        <div className="w-full max-w-[380px] bg-white dark:bg-[#1a1a1a]/90 backdrop-blur-xl rounded-[2rem] p-2 flex items-end justify-between shadow-[0_8px_30px_rgb(0,0,0,0.08)] pointer-events-auto border border-slate-200 dark:border-white/20">
          
          <button className="flex flex-col items-center justify-end w-14 h-12 text-primary transition-colors gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
            <span className="text-[9px] font-bold">Home</span>
          </button>
          
          <button onClick={() => navigate("/attendance")} className="flex flex-col items-center justify-end w-14 h-12 text-slate-400 hover:text-primary transition-colors gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            <span className="text-[9px] font-bold">Records</span>
          </button>
          
          {/* Central Glowing Button for Clock In */}
          <div className="relative flex flex-col items-center justify-start -mt-8 w-16">
            <div className={`absolute top-0 w-14 h-14 rounded-full blur-md ${isActive ? 'bg-red-500/40' : 'bg-primary/40'}`}></div>
            <button 
              onClick={() => navigate(isActive ? "/active-clock" : "/verify")}
              className={`relative w-14 h-14 rounded-full flex items-center justify-center shadow-lg border-4 border-[#f0f4f8] transition-transform active:scale-95 ${isActive ? 'bg-red-500 text-white' : 'bg-primary text-black'}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
            </button>
            <span className={`text-[9px] font-bold mt-1.5 ${isActive ? 'text-red-500' : 'text-primary'}`}>{isActive ? 'Clock Out' : 'Clock In'}</span>
          </div>

          <button onClick={() => setShowInviteModal(true)} className="flex flex-col items-center justify-end w-14 h-12 text-slate-400 hover:text-primary transition-colors gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg>
            <span className="text-[9px] font-bold">Invite</span>
          </button>
          
          <button onClick={() => setShowProfileMenu(true)} className="flex flex-col items-center justify-end w-14 h-12 text-slate-400 hover:text-primary transition-colors gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            <span className="text-[9px] font-bold">Profile</span>
          </button>

        </div>
      </div>

      {/* ─── Invite Guest Modal ─── */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={resetInviteModal}>
          <div
            className="bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/20 rounded-2xl w-full max-w-[380px] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-white/10">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Invite a Guest</h3>
              <button onClick={resetInviteModal} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center">
                <X size={16} className="text-slate-500 dark:text-gray-400" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {!createdInvite ? (
                <>
                  {/* Guest Names */}
                  <div className="space-y-3">
                    <label className="text-xs text-slate-500 dark:text-gray-400 font-bold">Guest Names</label>
                    <div className="space-y-2">
                      {guestNames.map((name, index) => (
                        <input
                          key={index}
                          type="text"
                          value={name}
                          onChange={(e) => setGuestNames(current => current.map((item, itemIndex) => itemIndex === index ? e.target.value : item))}
                          placeholder={`Guest ${index + 1} name`}
                          className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/20 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-colors"
                          disabled={inviteLoading}
                        />
                      ))}
                    </div>
                  </div>
                  
                  {/* Guest Count */}
                  <div className="space-y-3">
                    <label className="text-xs text-slate-500 dark:text-gray-400 font-bold">Number of Guests</label>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => {
                          const nextCount = Math.max(1, guestCount - 1);
                          setGuestCount(nextCount);
                          setGuestNames(current => current.slice(0, nextCount));
                        }}
                        disabled={inviteLoading || guestCount <= 1}
                        className="w-10 h-10 rounded-xl border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-900 dark:text-white disabled:opacity-50"
                      >
                        -
                      </button>
                      <span className="text-lg font-bold text-slate-900 dark:text-white w-8 text-center">{guestCount}</span>
                      <button
                        onClick={() => {
                          const nextCount = Math.min(10, guestCount + 1);
                          setGuestCount(nextCount);
                          setGuestNames(current => [...current, ...Array.from({ length: nextCount - current.length }, () => "")]);
                        }}
                        disabled={inviteLoading || guestCount >= 10}
                        className="w-10 h-10 rounded-xl border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-900 dark:text-white disabled:opacity-50"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {inviteError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm font-semibold text-center">
                      {inviteError}
                    </div>
                  )}

                  {/* Create Button */}
                  <Button
                    onClick={handleCreateInvite}
                    disabled={guestNames.some(name => !name.trim()) || inviteLoading}
                    className="w-full h-12 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-xl text-sm shadow-md"
                  >
                    {inviteLoading ? "Creating..." : "Generate Guest Pass"}
                  </Button>
                </>
              ) : (
                /* Created Invite — Show QR + Share */
                <div className="space-y-4 text-center">
                  <div className="flex justify-center">
                    <div className="relative bg-white dark:bg-[#1a1a1a] rounded-2xl p-3 shadow-lg border border-slate-100 dark:border-white/10">
                      <QRCode
                        value={JSON.stringify({ type: "har_guest", token: createdInvite.token })}
                        size={160}
                        bgColor="#FFFFFF"
                        fgColor="#000000"
                        level="H"
                      />
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center border-2 border-amber-500 shadow-md">
                          <span className="text-sm font-black text-amber-500">{createdInvite.guest_count}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-slate-900 dark:text-white font-bold">
                      {(() => {
                        try {
                          const parsed = JSON.parse(createdInvite.guest_name);
                          if (Array.isArray(parsed)) return parsed.join(", ");
                          return createdInvite.guest_name;
                        } catch {
                          return createdInvite.guest_name;
                        }
                      })()}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-gray-400">{createdInvite.guest_count} {createdInvite.guest_count === 1 ? "guest" : "guests"} invited</p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleCopyLink(createdInvite.token)}
                      variant="outline"
                      className="flex-1 h-10 border-slate-200 dark:border-white/20 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:bg-white/5 rounded-xl text-xs font-bold"
                    >
                      {copied ? <CheckCircle2 size={14} className="mr-1.5 text-emerald-500" /> : <Copy size={14} className="mr-1.5" />}
                      {copied ? "Copied!" : "Copy Link"}
                    </Button>
                    <Button
                      onClick={() => {
                        let names = createdInvite.guest_name;
                        try {
                          const parsed = JSON.parse(createdInvite.guest_name);
                          if (Array.isArray(parsed)) names = parsed.join(", ");
                        } catch {}
                        handleShareLink(createdInvite.token, names);
                      }}
                      className="flex-1 h-10 bg-amber-500 hover:bg-amber-600 text-black rounded-xl text-xs font-bold shadow-sm"
                    >
                      <Share2 size={14} className="mr-1.5" />
                      Share
                    </Button>
                  </div>

                  <Button
                    onClick={resetInviteModal}
                    variant="outline"
                    className="w-full h-10 border-slate-200 dark:border-white/20 text-slate-500 dark:text-gray-400 hover:bg-slate-50 dark:bg-white/5 rounded-xl text-xs font-bold"
                  >
                    Done
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Print Timesheet Modal */}
      {showPrintModal && (
        <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowPrintModal(false)}>
          <div className="bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/20 rounded-2xl w-full max-w-[320px] p-6 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="text-slate-900 dark:text-white font-bold text-lg mb-1">Print Timesheet</h3>
                <p className="text-slate-500 dark:text-gray-400 text-xs font-medium">Select the date range to generate your Timesheet.</p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-500 dark:text-gray-400 mb-1 block font-bold">Start Date</label>
                  <input
                    type="date"
                    value={printStart}
                    onChange={e => setPrintStart(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/20 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500/50 font-medium"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 dark:text-gray-400 mb-1 block font-bold">End Date</label>
                  <input
                    type="date"
                    value={printEnd}
                    onChange={e => setPrintEnd(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/20 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500/50 font-medium"
                  />
                </div>
              </div>
              <div className="flex gap-3 w-full mt-2">
                <Button onClick={() => setShowPrintModal(false)} variant="outline" className="flex-1 border-slate-200 dark:border-white/20 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:bg-white/5 font-bold">Cancel</Button>
                <Button 
                  onClick={() => {
                    const url = `${window.location.origin}${window.location.pathname}#/print-timesheet/${employeeId}?start=${printStart}&end=${printEnd}`;
                    window.location.href = url;
                    setShowPrintModal(false);
                  }} 
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-black font-bold shadow-sm"
                >
                  Generate
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ID Card Modal */}
      {showIDCard && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="relative w-full max-w-[340px] max-h-[90vh] overflow-x-auto overflow-y-auto bg-white rounded-[24px] shadow-2xl flex flex-col pt-6 pb-2 border border-slate-200 font-sans">
            
            {/* Close Button */}
            <button 
              onClick={() => setShowIDCard(false)}
              className="absolute top-4 right-4 w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center z-50 transition-colors text-slate-700"
            >
              <X size={16} strokeWidth={2.5} />
            </button>

            {/* Top Header - HAR Logo Centered */}
            <div className="flex justify-center items-center pt-4 pb-6">
              <img src="/logo.png" alt="Hope Alive Radio" className="h-[60px] object-contain" />
            </div>

            {/* Website & EMP Number */}
            <div className="flex justify-between items-center px-6 pb-4 relative z-10 gap-2">
              <span className="text-[8.5px] sm:text-[10px] font-bold text-black tracking-wider uppercase truncate">WWW.HOPEALIVEONLINERADIO.COM</span>
            </div>

            {/* Photo Area */}
            <div className="px-5">
              <div className="relative w-full aspect-[4/4.5] rounded-t-[2rem] overflow-hidden bg-slate-100 shadow-inner">
                {photoUrl ? (
                  <img src={photoUrl} className="w-full h-full object-cover object-top" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                    <span className="font-black text-6xl uppercase">{displayName.charAt(0)}</span>
                  </div>
                )}
                
                {/* Diagonal White Cutout overlaying bottom-left of photo */}
                <div 
                  className="absolute bottom-0 left-0 w-[85%] bg-white pt-6 pb-1 pr-8"
                  style={{ clipPath: 'polygon(0 0, 75% 0, 100% 100%, 0 100%)' }}
                >
                  <div className="pl-0">
                    <h2 className="text-[30px] font-black leading-[1.05] tracking-tight text-black mb-1">
                      {displayName.split(' ')[0]}<br/>{displayName.split(' ').slice(1).join(' ')}
                    </h2>
                    <p className="text-[14px] font-bold tracking-[0.15em] text-black uppercase">{employeeRole}</p>
                  </div>
                </div>
              </div>

              {/* Bottom Info Section */}
              <div className="bg-white">
                <div className="pt-2 pb-4">
                  <p className="text-[9px] tracking-widest text-black font-semibold uppercase">{userEmail}</p>
                </div>

                <div className="flex justify-between items-end pb-4">
                  <div className="flex flex-col gap-[6px] text-[13px] font-bold text-black tracking-wide">
                    <div className="flex"><span className="w-[70px] uppercase font-black">CELL:</span> <span className="font-medium">0671521711</span></div>
                    <div className="flex"><span className="w-[70px] uppercase font-black">TELL:</span> <span className="font-medium">+27 67 153 1089</span></div>
                    <div className="flex"><span className="w-[70px] uppercase font-black">EMP NO:</span> <span className="font-medium uppercase">{empNo ? (empNo.toUpperCase().startsWith('EMP') ? empNo : `EMP-${empNo}`) : `HAR-INT-${employeeId.split('-').pop() || '008'}`}</span></div>
                  </div>
                  <div className="w-[100px] h-[100px] shrink-0 p-1">
                    <QRCode value={employeeId} size={100} className="w-full h-full" level="Q" />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center pt-4 pb-4">
               <span className="text-[10px] font-medium text-black tracking-widest uppercase">INFO@HOPEALIVERADIO.COM</span>
            </div>
            
          </div>
        </div>
      )}

      {/* Cancel Guest Modal */}
      {guestToCancel && (
        <div className="fixed inset-0 z-[110] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setGuestToCancel(null)}>
          <div className="bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 rounded-2xl w-full max-w-[320px] p-6 shadow-2xl overflow-hidden animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="text-slate-900 dark:text-white font-bold text-lg mb-1">Cancel Guest Pass?</h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">Are you sure you want to cancel this guest pass? This action cannot be undone.</p>
              </div>
              <div className="flex gap-3 w-full mt-2">
                <button onClick={() => setGuestToCancel(null)} className="flex-1 py-2 rounded-lg border border-slate-200 dark:border-white/20 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 font-bold text-sm transition-colors">No, keep it</button>
                <button 
                  onClick={async () => {
                    const { error } = await supabase.from("guest_invites").update({ status: "cancelled" }).eq("id", guestToCancel);
                    if (error) throw error;
                    setMyGuests(current => current.filter(guest => guest.id !== guestToCancel));
                    fetchMyGuests(employeeId);
                    setGuestToCancel(null);
                  }} 
                  className="flex-1 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-bold text-sm shadow-sm transition-colors"
                >
                  Yes, cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Profile Menu Modal */}
      {showProfileMenu && (
        <div className="fixed inset-0 z-[110] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={() => setShowProfileMenu(false)}>
          <div
            className="bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 rounded-2xl w-full max-w-[380px] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 sm:zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 flex flex-col gap-2">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Profile Settings</h3>
                <button onClick={() => setShowProfileMenu(false)} className="p-2 bg-slate-100 dark:bg-white/10 rounded-full text-slate-500 dark:text-slate-400 transition-colors">
                  <X size={18} />
                </button>
              </div>
              
              <button onClick={() => { setShowProfileMenu(false); setShowIDCard(true); }} className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
                <span className="font-bold text-slate-900 dark:text-white">View Access Card</span>
                <Users size={18} className="text-slate-500" />
              </button>
              
              <button onClick={() => setIsDarkMode(!isDarkMode)} className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
                <span className="font-bold text-slate-900 dark:text-white">{isDarkMode ? "Light Mode" : "Dark Mode"}</span>
                {isDarkMode ? <Sun size={18} className="text-amber-500" /> : <Moon size={18} className="text-slate-500" />}
              </button>

              <button onClick={handleLogout} className="w-full flex items-center justify-between p-4 bg-red-50 dark:bg-red-500/10 rounded-xl hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors mt-2">
                <span className="font-bold text-red-600 dark:text-red-400">Logout</span>
                <LogOut size={18} className="text-red-500" />
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
