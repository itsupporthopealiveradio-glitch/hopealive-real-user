import { useNavigate, useLocation } from "react-router";
import { CheckCircle } from "lucide-react";
import { useEffect, useState } from "react";

function formatDateTime(d: Date) {
  const time = d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  const date = d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return { time, date };
}

export default function ClockConfirmation() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isClockingIn, setIsClockingIn] = useState(true);
  const now = new Date();
  const { time, date } = formatDateTime(now);

  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data?.session) {
        navigate("/");
      }
    };
    checkAuth();

    const params = new URLSearchParams(location.search);
    const action = params.get("action");
    if (action === "clockout") {
      setIsClockingIn(false);
    } else {
      setIsClockingIn(true);
    }
  }, [location.search]);

  return (
    <div className="min-h-screen bg-transparent flex items-center justify-center p-4">
      <div className="w-full max-w-[385px] mx-auto bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl space-y-6">

        {/* Success Icon + Heading */}
        <div className="flex flex-col items-center gap-4 text-center">
          <img src="/logo.png" alt="Hope Alive Radio Logo" className="h-12 object-contain" />
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center bg-green-500/10 border border-green-500/20"
          >
            <CheckCircle size={36} className="text-green-400" strokeWidth={2} />
          </div>
          <h1
            className="text-lg font-bold text-green-400"
          >
            {isClockingIn ? "✓ Thank You for Clocking In!" : "✓ Thank You for Clocking Out!"}
          </h1>
          <p className="text-xs text-gray-400">
            {isClockingIn ? "Clocked In" : "Clocked Out"} at <span className="text-white font-semibold">{time}</span> on <span className="text-white font-semibold">{date}</span>
          </p>
        </div>

        {/* Status Card */}
        <div className="border border-white/10 bg-white/5 text-white rounded-xl p-4">
          <p className="text-xs text-gray-400 font-semibold">
            Current Status
          </p>
          <p
            className="text-lg mt-1 font-bold"
            style={{ color: isClockingIn ? "#4ade80" : "#f87171" }}
          >
            {isClockingIn ? "Clocked In" : "Clocked Out"}
          </p>
          {isClockingIn && (
            <p className="text-xs text-gray-400 mt-1">Elapsed Time: Active Timer Running</p>
          )}
        </div>

        {/* Buttons */}
        <div className="flex flex-col gap-3">
          <button
            onClick={() => navigate(isClockingIn ? "/active-clock" : "/dashboard")}
            className="w-full h-12 rounded-lg text-black bg-primary hover:bg-primary/95 text-sm font-bold uppercase tracking-wider transition-all duration-200 active:scale-[0.98]"
          >
            Continue
          </button>
          <button
            onClick={() => navigate("/dashboard")}
            className="w-full text-center text-xs text-primary font-semibold hover:underline"
          >
            Go Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
