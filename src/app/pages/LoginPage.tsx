import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { AtSign, Lock, Eye, EyeOff, AlertCircle, ArrowRight, ArrowLeft, ShieldCheck, Wifi } from "lucide-react";
import { wampLogin, wampSetup } from "../../lib/wampApi";
import { secureStorage } from "../../lib/crypto";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [pin, setPin] = useState(["", "", "", ""]);
  const [confirmPin, setConfirmPin] = useState(["", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isFirstTimeSetup, setIsFirstTimeSetup] = useState(false);

  const pinRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  const confirmPinRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  // Load remembered email and check for URL errors on mount
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get("error") === "removed") {
      setError("You have been removed from the system.");
      // Clean up URL
      navigate("/", { replace: true });
    }

    async function loadEmail() {
      const savedEmail = await secureStorage.getItem("rememberedEmail");
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    }
    loadEmail();
  }, [location, navigate]);

  const handlePinChange = (index: number, value: string) => {
    const digit = value.replace(/[^0-9]/g, "").slice(-1);
    const newPin = [...pin];
    newPin[index] = digit;
    setPin(newPin);
    setError("");

    if (digit && index < 3) {
      pinRefs[index + 1].current?.focus();
    }
  };

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !pin[index] && index > 0) {
      pinRefs[index - 1].current?.focus();
    }
  };

  const handlePinPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/[^0-9]/g, "").slice(0, 4);
    const newPin = ["", "", "", ""];
    for (let i = 0; i < pasted.length; i++) {
      newPin[i] = pasted[i];
    }
    setPin(newPin);
    if (pasted.length === 4) {
      pinRefs[3].current?.focus();
    } else if (pasted.length > 0) {
      pinRefs[Math.min(pasted.length, 3)].current?.focus();
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const pinValue = pin.join("");
    const confirmPinValue = confirmPin.join("");

    if (!email || pinValue.length < 4) {
      setError("Please enter your email and complete 4-digit PIN");
      return;
    }

    if (isFirstTimeSetup && !idNumber.trim()) {
      setError("Please enter your ID Number for verification.");
      return;
    }

    if (isFirstTimeSetup && pinValue !== confirmPinValue) {
      setError("PINs do not match. Please try again.");
      return;
    }

    setLoading(true);
    try {
      // Normalize email
      const normalizedEmail = email.trim().toLowerCase();

      if (rememberMe) {
        await secureStorage.setItem("rememberedEmail", normalizedEmail);
      } else {
        secureStorage.removeItem("rememberedEmail");
      }

      if (isFirstTimeSetup) {
        await wampSetup(normalizedEmail, idNumber.trim(), pinValue);
        await wampLogin(normalizedEmail, pinValue);
        navigate("/face-onboarding");
        return;
      }

      // Normal Login Flow
      const { user } = await wampLogin(normalizedEmail, pinValue);
      navigate(user.role === "admin" ? "/dashboard" : "/dashboard");
    } catch (err: any) {
      setError(err.message || "An error occurred during login");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPinChange = (index: number, value: string) => {
    const digit = value.replace(/[^0-9]/g, "").slice(-1);
    const newConfirmPin = [...confirmPin];
    newConfirmPin[index] = digit;
    setConfirmPin(newConfirmPin);
    setError("");

    if (digit && index < 3) {
      confirmPinRefs[index + 1].current?.focus();
    }
  };

  const handleConfirmPinKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !confirmPin[index] && index > 0) {
      confirmPinRefs[index - 1].current?.focus();
    }
  };

  return (
    <div className="min-h-screen bg-transparent flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-[410px] mx-auto bg-white/90 dark:bg-[#121a25]/95 backdrop-blur-xl border border-white/80 dark:border-white/10 rounded-[1.75rem] p-6 sm:p-8 shadow-[0_24px_80px_rgba(15,23,42,0.14)] dark:shadow-black/30 space-y-6">
        <div className="text-center relative">
          {isFirstTimeSetup && (
            <button
              onClick={() => setIsFirstTimeSetup(false)}
              className="absolute left-0 top-0 p-2 text-slate-500 hover:text-slate-900 transition-colors"
              title="Back to Login"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div className="flex items-center justify-between mb-7 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Secure terminal</span>
            <span className="flex items-center gap-1.5"><Wifi className="h-3.5 w-3.5 text-emerald-500" /> Online</span>
          </div>

          <div className="flex items-center justify-center gap-6 mb-8 mt-2">
            <img
              src="/tbg-logo.png"
              alt="The Blessed Generation"
              className="h-16 w-auto object-contain"
            />
            <div className="h-12 w-[1px] bg-gray-200 dark:bg-gray-700"></div>
            <img
              src="/logo.png"
              alt="Hope Alive Radio"
              className="h-14 w-auto object-contain dark:invert"
            />
          </div>

          <h1 className="text-2xl sm:text-[1.7rem] font-bold tracking-tight text-slate-900 dark:text-white mb-1">
            {isFirstTimeSetup ? "First-Time Setup" : "Secure Clock-In"}
          </h1>
          <p className="text-sm text-slate-500 dark:text-gray-400">
            {isFirstTimeSetup ? "Create your 4-digit PIN to secure your account" : "Enter your credentials to continue"}
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {error && (
            <div className="bg-red-100 dark:bg-red-950/40 border border-red-300 dark:border-red-500/50 rounded-lg p-3 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-600 dark:text-red-200">{error}</p>
            </div>
          )}

          {/* Email Input */}
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs text-slate-500">
              Email Address
            </Label>
            <div className="relative">
              <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                className="h-12 pl-12 pr-4 bg-slate-50 dark:bg-white/10 border-slate-200 dark:border-white/20 text-slate-900 dark:text-white rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder-slate-400 dark:placeholder-gray-500"
              />
            </div>
          </div>

          {/* Employee Number Input (Only for First Time Setup) */}
          {isFirstTimeSetup && (
            <div className="space-y-1.5">
              <Label htmlFor="idNumber" className="text-xs text-slate-500">
                Employee Number
              </Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="idNumber"
                  type="text"
                  placeholder="Enter your Employee Number"
                  value={idNumber}
                  onChange={(e) => {
                    setIdNumber(e.target.value);
                    setError("");
                  }}
                  className="h-12 pl-12 pr-4 bg-slate-50 dark:bg-white/10 border-slate-200 dark:border-white/20 text-slate-900 dark:text-white rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder-slate-400 dark:placeholder-gray-500"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs text-slate-500 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              Security PIN
            </Label>
            <div className="flex justify-center gap-3" onPaste={handlePinPaste}>
              {pin.map((digit, i) => (
                <input
                  key={i}
                  ref={pinRefs[i]}
                  type={showPassword ? "text" : "password"}
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handlePinChange(i, e.target.value)}
                  onKeyDown={(e) => handlePinKeyDown(i, e)}
                  className="w-14 h-14 text-center text-xl font-bold rounded-xl border border-slate-200 dark:border-white/20 bg-slate-50 dark:bg-white/10 text-slate-900 dark:text-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all duration-200"
                  style={{ caretColor: "transparent" }}
                />
              ))}
            </div>
          </div>

          {isFirstTimeSetup && (
            <div className="pt-2 space-y-1.5">
              <Label className="text-xs text-slate-500 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                Confirm Security PIN
              </Label>
              <div className="flex justify-center gap-3">
                {confirmPin.map((digit, i) => (
                  <input
                    key={i}
                    ref={confirmPinRefs[i]}
                    type={showPassword ? "text" : "password"}
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleConfirmPinChange(i, e.target.value)}
                    onKeyDown={(e) => handleConfirmPinKeyDown(i, e)}
                    className="w-14 h-14 text-center text-xl font-bold rounded-xl border border-slate-200 dark:border-white/20 bg-slate-50 dark:bg-white/10 text-slate-900 dark:text-white focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all duration-200"
                    style={{ caretColor: "transparent" }}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-between items-center mt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 bg-white text-primary focus:ring-primary"
              />
              <span className="text-xs text-slate-500">Remember my email</span>
            </label>
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-xs text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1"
            >
              {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading || pin.join("").length < 4 || (isFirstTimeSetup && confirmPin.join("").length < 4)}
            className="w-full bg-primary hover:bg-primary/90 text-black font-semibold h-12 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 relative overflow-hidden group mt-4"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            ) : (
              <>
                {isFirstTimeSetup ? "Set Up Account" : "Access Terminal"}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        <div className="text-center pt-2">
          <button
            type="button"
            onClick={() => {
              setIsFirstTimeSetup(!isFirstTimeSetup);
              setError("");
              setPin(["", "", "", ""]);
              setConfirmPin(["", "", "", ""]);
            }}
            className="text-xs text-primary/80 hover:text-primary transition-colors underline"
          >
            {isFirstTimeSetup ? "Already have a PIN? Log in here" : "First time? Set up your PIN"}
          </button>
        </div>
      </div>
    </div>
  );
}
