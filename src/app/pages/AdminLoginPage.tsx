import React, { useState } from "react";
import { useNavigate } from "react-router";
import { wampLogin } from "../../lib/wampApi";
import { ShieldCheck, AtSign, Lock, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("ITsupporthopealiveradio@gmail.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      setError("Please enter your email and password");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const normalizedEmail = email.trim().toLowerCase();

      await wampLogin(normalizedEmail, password, true);
      navigate("/admin");
    } catch (err: any) {
      const message = err?.message || "An error occurred during login.";
      setError(message.includes("Failed to fetch") ? "Unable to reach the WAMP server. Make sure Apache is running." : message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        .admin-input::placeholder {
          color: rgba(255, 255, 255, 0.8) !important;
          opacity: 1 !important;
        }
        .admin-input:-webkit-autofill,
        .admin-input:-webkit-autofill:hover, 
        .admin-input:-webkit-autofill:focus, 
        .admin-input:-webkit-autofill:active{
          -webkit-text-fill-color: white !important;
          -webkit-box-shadow: 0 0 0 1000px rgba(255, 255, 255, 0.1) inset !important;
          transition: background-color 5000s ease-in-out 0s;
        }
      `}</style>
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,_rgba(251,191,36,0.18),_transparent_38%),#f3f6fa] flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-4xl mx-auto overflow-hidden rounded-[28px] border border-border-strong bg-surface-overlay shadow-[0_24px_70px_rgba(15,23,42,0.14)] md:grid md:grid-cols-[0.85fr_1.15fr]">
        <div className="hidden bg-slate-950 p-10 text-white md:flex md:flex-col md:justify-between">
          <div>
            <img src="/logo.png" alt="Hope Alive Radio Logo" className="h-20 object-contain object-left" />
            <p className="mt-12 text-xs font-bold uppercase tracking-[0.24em] text-amber-300">Operations control</p>
            <h2 className="mt-4 text-3xl font-bold leading-tight">Keep attendance moving with confidence.</h2>
            <p className="mt-5 text-sm leading-6 text-slate-300">Manage employees, review attendance, and protect the terminal from one secure workspace.</p>
          </div>
          <div className="border-t border-white/10 pt-5 text-xs text-slate-400">Hope Alive Radio · Authorized access only</div>
        </div>
        <div className="p-6 sm:p-10">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-4 md:hidden">
            <img src="/logo.png" alt="Hope Alive Radio Logo" className="h-24 object-contain" />
          </div>
          <div className="flex items-center justify-center gap-2 mb-2">
            <ShieldCheck size={20} className="text-primary" />
            <h1 className="text-xl font-bold text-content">Admin Portal</h1>
          </div>
          <p className="text-sm text-content-muted">
            Sign in to manage the live attendance system.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          {error && (
            <div className="bg-red-100 dark:bg-red-950/40 border border-red-300 dark:border-red-500/50 rounded-lg p-3 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-600 dark:text-red-200">{error}</p>
            </div>
          )}

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="admin-email" className="text-sm font-bold text-content">
              Admin Email
            </Label>
            <div className="relative">
              <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
              <Input
                id="admin-email"
                type="email"
                placeholder="ITsupporthopealiveradio@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="pl-11 h-12 bg-surface-subtle border-border-strong text-content placeholder:text-content-muted/70 admin-input font-bold"
              />
            </div>
          </div>

          <p className="text-xs leading-5 text-content-muted">Use the authorized IT administrator account.</p>

          {/* Password */}
          <div className="space-y-1.5">
            <Label htmlFor="admin-password" className="text-sm font-bold text-content">
              Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
              <Input
                id="admin-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="pl-11 h-12 bg-surface-subtle border-border-strong text-content placeholder:text-content-muted/70 admin-input font-bold"
              />
            </div>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer text-base mt-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Signing In...
              </>
            ) : (
              "Sign In as Admin"
            )}
          </Button>
        </form>

        {/* Footer */}
        <div className="text-center pt-2 border-t border-border-strong/40">
          <p className="text-xs text-content-muted">
            Admin portal — Hope Alive Radio Attendance System
          </p>
        </div>
      </div>
      </div>
    </div>
    </>
  );
}
