import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, MapPin, AlertCircle, CheckCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { logAudit } from "../../lib/audit";
import { verifyLocation, formatDistance, MAX_DISTANCE_METERS } from "../../lib/geolocation";
import { supabase } from "../../lib/supabase";
import { secureStorage } from "../../lib/crypto";
import { parseWampTimestamp, wampClockOut } from "../../lib/wampApi";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function formatElapsed(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return { display: `${pad(h)}:${pad(m)}:${pad(s)}`, h, m, s };
}

function formatClockInTime(d: Date) {
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
}

function formatClockInDate(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ⚠️ DEV MODE — set to false for production
const DEV_MODE = false;

export default function ActiveClock() {
  const navigate = useNavigate();
  const [elapsed, setElapsed] = useState(0);
  const [flash, setFlash] = useState(false);
  const clockInTime = useRef(new Date());
  const [clockReady, setClockReady] = useState(false);

  // Location verification state
  const [locationState, setLocationState] = useState<"idle" | "checking" | "verified" | "outside" | "error">("idle");
  const [distance, setDistance] = useState<number | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    // Auth guard
    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data?.session) {
        navigate("/");
        return;
      }
      
      const { data: emp } = await supabase
        .from("employees")
        .select("id, status")
        .eq("auth_user_id", data.session.user.id)
        .maybeSingle();
        
      if (!emp || emp.status !== 'active') {
        await supabase.auth.signOut();
        navigate("/?error=removed");
      }
    };
    checkAuth();

    const initClockTime = async () => {
      const savedTime = await secureStorage.getItem("clockInTime");
      if (savedTime) {
        clockInTime.current = parseWampTimestamp(savedTime);
      } else {
        await secureStorage.setItem("clockInTime", clockInTime.current.toISOString());
      }
      setClockReady(true);
    };
    initClockTime();

    const updateTimer = () => {
      if (!clockReady) return;
      const now = new Date();
      const diffSeconds = Math.floor((now.getTime() - clockInTime.current.getTime()) / 1000);
      setElapsed(diffSeconds >= 0 ? diffSeconds : 0);
    };

    updateTimer();
    const id = setInterval(() => {
      updateTimer();
      setFlash(true);
      setTimeout(() => setFlash(false), 100);
    }, 1000);
    return () => clearInterval(id);
  }, [clockReady]);

  const forceClockOut = async (status: string = "clock_out") => {
    try {
      const clockOutTime = new Date().toISOString();
      const formattedTime = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });

      await secureStorage.setItem("isActive", "false");
      await secureStorage.setItem("lastClockTime", formattedTime);

      await wampClockOut(status, clockOutTime);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    // Immediate out-of-bounds check on mount
    const initialCheck = async () => {
      try {
        const result = DEV_MODE 
          ? { isWithinRange: true, distance: 12.5, userLocation: { latitude: 0, longitude: 0 }, error: undefined }
          : await verifyLocation();
          
        if (!result.isWithinRange) {
          alert(`You have been automatically clocked out because you left the ${MAX_DISTANCE_METERS}m radius of the workspace.`);
          await forceClockOut("System Kickout");
          navigate("/dashboard");
        }
      } catch (e) {
        // fail silently
      }
    };
    initialCheck();

    // Auto clock-out check
    const checkLocationInterval = setInterval(async () => {
      try {
        const result = DEV_MODE 
          ? { isWithinRange: true, distance: 12.5, userLocation: { latitude: 0, longitude: 0 }, error: undefined }
          : await verifyLocation();
          
        if (!result.isWithinRange) {
          clearInterval(checkLocationInterval);
          alert(`You have been automatically clocked out because you left the ${MAX_DISTANCE_METERS}m radius of the workspace.`);
          await forceClockOut("System Kickout");
          navigate("/dashboard");
        }
      } catch (e) {
        // silently fail and retry next interval
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(checkLocationInterval);
  }, [navigate]);

  const handleClockOut = async (isMock: boolean = false) => {
    setLocationState("checking");
    setLocationError(null);

    try {
      const result = isMock 
        ? { isWithinRange: true, distance: 12.5, userLocation: { latitude: 0, longitude: 0 }, error: undefined }
        : await verifyLocation();
        
      setDistance(result.distance);

      if (result.isWithinRange) {
        setLocationState("verified");
        await forceClockOut("clock_out");
        setTimeout(() => {
          navigate("/confirmation?action=clockout");
        }, 500);
      } else {
        setLocationState("outside");
        alert("You are outside the office radius, but you are being clocked out now.");
        await forceClockOut("System Kickout");
        navigate("/dashboard");
      }

      if (result.error) {
        setLocationError(result.error);
      }
    } catch (error) {
      setLocationState("error");
      setLocationError(error instanceof Error ? error.message : "Failed to verify location");
    }
  };

  const { display, h, m, s } = formatElapsed(clockReady ? elapsed : 0);
  const subtext = `${h > 0 ? `${h} hour${h !== 1 ? "s" : ""} ` : ""}${m > 0 ? `${m} minute${m !== 1 ? "s" : ""} ` : ""}${s} second${s !== 1 ? "s" : ""}`;

  return (
    <>
      <div className="min-h-screen bg-transparent flex items-center justify-center p-4">
        <div className="w-full max-w-[385px] mx-auto bg-white border border-slate-200 rounded-2xl p-6 shadow-xl space-y-6">

          {/* Header */}
          <div className="relative flex justify-center items-center pb-2 border-b border-slate-100 text-slate-900">
            <button
              onClick={() => navigate("/dashboard")}
              className="absolute left-0 w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft size={20} className="text-slate-700" strokeWidth={2} />
            </button>
            <div className="text-center">
              <img src="/logo.png" alt="Hope Alive Radio Logo" className="h-10 mx-auto mb-1 object-contain" />
              <h1 className="text-lg font-bold text-slate-900 leading-tight">Active Clock</h1>
              <p className="text-xs text-green-400 mt-0.5 font-semibold">Currently Clocked In</p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {/* Clock In Time Card */}
            <div className="border border-slate-200 bg-slate-50 text-slate-900 rounded-xl p-4">
              <p className="text-xs text-slate-500 font-bold">Clocked In At</p>
              <p className="text-lg text-slate-900 mt-1 font-bold">
                {formatClockInTime(clockInTime.current)}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {formatClockInDate(clockInTime.current)}
              </p>
            </div>

            {/* Timer Card */}
            <div
              className="border border-slate-200 bg-slate-50 text-slate-900 rounded-xl p-6 flex flex-col items-center"
            >
              <p className="text-xs text-slate-500 mb-2 font-bold">Hours Worked</p>
              <span
                className="text-[#FEAC22] text-center transition-transform duration-100"
                style={{
                  fontSize: 48,
                  fontWeight: 700,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  letterSpacing: "0.04em",
                  transform: flash ? "scale(1.03)" : "scale(1)",
                  display: "block",
                }}
              >
                {display}
              </span>
              <p className="text-xs text-slate-600 text-center mt-2 font-bold">{subtext}</p>
            </div>

            {/* Location Verification Card */}
            {locationState !== "idle" && (
              <div className={`border border-slate-200 bg-slate-50 text-slate-900 rounded-xl p-4 transition-all duration-300 ${locationState === "verified" ? "border-l-4 border-green-500" : ""}`}>
                <div className="flex items-center gap-2 mb-3">
                  <MapPin size={18} className={locationState === "verified" ? "text-green-400" : "text-primary"} strokeWidth={2} />
                  <h3 className="text-sm font-bold text-slate-900">
                    Location Verification
                  </h3>
                </div>

                {locationState === "checking" && (
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full"
                      style={{ animation: "spin 1s linear infinite" }}
                    />
                    <span className="text-xs text-slate-500">Verifying your location…</span>
                  </div>
                )}

                {locationState === "verified" && (
                  <div className="mb-1">
                    <div className="flex items-center gap-2 text-green-400">
                      <CheckCircle size={18} strokeWidth={2} />
                      <span className="text-xs font-semibold">Location Verified</span>
                    </div>
                    {distance !== null && (
                      <p className="text-xs text-slate-500 mt-1">
                        Distance from office: {formatDistance(distance)}
                      </p>
                    )}
                  </div>
                )}

                {locationState === "outside" && (
                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-2 text-red-400">
                      <AlertCircle size={18} strokeWidth={2} />
                      <span className="text-xs font-semibold">Outside Office Area</span>
                    </div>
                    {distance !== null && (
                      <p className="text-xs text-slate-500 mb-2">
                        You are {formatDistance(distance)} away from the office. Maximum allowed distance is {formatDistance(MAX_DISTANCE_METERS)}.
                      </p>
                    )}
                  </div>
                )}

                {locationState === "error" && (
                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-2 text-red-400">
                      <AlertCircle size={18} strokeWidth={2} />
                      <span className="text-xs font-semibold">Location Error</span>
                    </div>
                    {locationError && (
                      <p className="text-xs text-slate-500 mb-2">
                        {locationError}
                      </p>
                    )}
                    <p className="text-xs text-slate-500">
                      Please enable location services and try again.
                    </p>
                  </div>
                )}

                {(locationState === "outside" || locationState === "error") && (
                  <button
                    onClick={() => handleClockOut(false)}
                    className="w-full h-10 rounded-lg border border-primary text-primary text-xs transition-all duration-200 hover:bg-primary/10 flex items-center justify-center gap-2 mt-2 font-bold"
                  >
                    <RefreshCw size={12} strokeWidth={2} />
                    Retry Location Check
                  </button>
                )}
              </div>
            )}

            {/* Clock Out Button Container */}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleClockOut(DEV_MODE)}
                disabled={locationState === "checking" || locationState === "outside" || locationState === "error"}
                className="w-full h-12 rounded-xl text-black font-bold transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed bg-primary hover:bg-primary/95 text-sm uppercase tracking-wider"
              >
                {locationState === "checking" ? "VERIFYING LOCATION…" : "CLOCK OUT"}
              </button>
              
            </div>

            {/* View Details */}
            <button
              onClick={() => navigate("/attendance")}
              className="w-full text-center text-xs text-primary hover:underline font-semibold"
            >
              View My Attendance
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
