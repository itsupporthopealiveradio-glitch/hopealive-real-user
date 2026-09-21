import { useState, useEffect } from "react";
import { useParams } from "react-router";
import QRCode from "react-qr-code";
import { supabase } from "../../lib/supabase";

export default function GuestInvitePage() {
  const { token } = useParams<{ token: string }>();
  const [invite, setInvite] = useState<any>(null);
  const [hostName, setHostName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [timestamp, setTimestamp] = useState(Date.now());

  // Rotate QR code timestamp every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setTimestamp(Date.now());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchInvite = async () => {
      if (!token) {
        setError("Invalid invitation link.");
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("guest_invites")
        .select("*, employees!host_employee_id(full_name)")
        .eq("token", token)
        .maybeSingle();

      if (fetchError || !data) {
        console.error("Fetch error:", fetchError);
        setError(`This invitation was not found or has expired. ${fetchError?.message || ""}`);
        setLoading(false);
        return;
      }

      let inviteData = data;
      const createdTime = new Date(data.created_at).getTime();
      const isExpired = (Date.now() - createdTime) > 24 * 60 * 60 * 1000;
      
      if (isExpired && data.status === "pending") {
        await supabase.from("guest_invites").update({ status: "expired" }).eq("id", data.id);
        inviteData.status = "expired";
      } else {
        if (!sessionStorage.getItem(`viewed_${token}`)) {
          await supabase.from("guest_invites").update({ views: (data.views || 0) + 1 }).eq("id", data.id);
          sessionStorage.setItem(`viewed_${token}`, "true");
        }
      }

      setInvite(inviteData);
      setHostName(data.employees?.full_name || "Staff Member");
      setLoading(false);
    };

    fetchInvite();

    // Subscribe to live updates on this invite
    const channel = supabase
      .channel(`invite-${token}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "guest_invites",
        filter: `token=eq.${token}`,
      }, (payload) => {
        setInvite(payload.new);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center p-4 font-sans">
        <div className="w-full max-w-[400px] bg-white border border-slate-200 shadow-xl rounded-2xl p-8 text-center">
          <span className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto block" />
          <p className="text-sm text-slate-500 mt-4">Loading your invitation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center p-4 font-sans">
        <div className="w-full max-w-[400px] bg-white border border-slate-200 shadow-xl rounded-2xl p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          </div>
          <h1 className="text-xl font-bold text-slate-900">Invitation Not Found</h1>
          <p className="text-sm text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: "bg-amber-500/20", text: "text-amber-400", label: "Awaiting Arrival" },
    checked_in: { bg: "bg-emerald-500/20", text: "text-emerald-400", label: "Arrived" },
    checked_out: { bg: "bg-gray-500/20", text: "text-gray-400", label: "Visit Complete" },
    expired: { bg: "bg-red-500/20", text: "text-red-400", label: "Expired" },
    deleted: { bg: "bg-red-500/20", text: "text-red-500", label: "Access Denied" },
  };

  const currentStatus = statusStyles[invite.status] || statusStyles.pending;
  const base = window.location.origin + window.location.pathname;
  const qrValue = `${base.replace(/\/$/, '')}/#/security?token=${invite.token}`;

  let displayNames = invite.guest_name;

  return (
    <div className="min-h-screen bg-transparent flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-[400px] space-y-5">
        {/* Header */}
        <div className="text-center space-y-2 mb-4">
          <img src="/logo.png" alt="Hope Alive Radio" className="h-16 mx-auto object-contain drop-shadow-xl" />
          <h1 className="text-3xl font-extrabold bg-gradient-to-r from-[#FBB03B] to-yellow-200 bg-clip-text text-transparent tracking-tight">VIP Guest Pass</h1>
          <p className="text-xs text-slate-500 uppercase tracking-[0.2em] font-semibold">Hope Alive Radio</p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-[2rem] overflow-hidden shadow-xl border border-slate-200 relative transform transition-all hover:scale-[1.02]">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#FBB03B] via-yellow-200 to-[#FBB03B]"></div>
          {/* QR Code Section */}
          <div className="p-6 flex justify-center">
            {invite.status === "expired" || invite.status === "declined" || invite.status === "deleted" ? (
              <div className="w-full h-[252px] bg-red-500/5 border border-red-500/10 rounded-2xl flex flex-col items-center justify-center p-6 text-center space-y-3">
                <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                </div>
                <p className="text-red-400 font-bold">{invite.status === "deleted" ? "Access Denied" : "This pass is no longer valid"}</p>
                <p className="text-xs text-red-400/70">{invite.status === "deleted" ? "This guest pass has been cancelled." : "Please contact your host for a new invitation."}</p>
              </div>
            ) : (
              <div className="relative bg-white rounded-2xl p-5 shadow-[0_0_40px_rgba(251,176,59,0.15)] mx-auto inline-block ring-4 ring-[#FBB03B]/10">
                <QRCode
                  value={qrValue}
                  size={200}
                  bgColor="#FFFFFF"
                  fgColor="#000000"
                  level="H"
                />
                {/* Guest Icon Overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center shadow-2xl">
                    <div className="w-12 h-12 rounded-full bg-black flex items-center justify-center border-2 border-[#FBB03B]">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#FBB03B]"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Invite Details */}
          <div className="px-6 pb-6 space-y-4">
            {/* Status Badge */}
            <div className="flex justify-center">
              <span className={`px-4 py-1.5 rounded-full text-xs font-bold tracking-wide ${currentStatus.bg} ${currentStatus.text}`}>
                {currentStatus.label}
              </span>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 shadow-inner">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">
                  Guest Name
                </p>
                <p className="text-sm text-slate-900 font-bold truncate">{displayNames}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 shadow-inner">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Guests Allowed</p>
                <p className="text-sm text-slate-900 font-bold">1 person</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 col-span-2 shadow-inner">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Invited By</p>
                <p className="text-sm text-[#FBB03B] font-bold">{hostName}</p>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-gradient-to-r from-amber-500/10 to-amber-500/5 border border-amber-500/20 rounded-xl p-4 relative overflow-hidden">
              <div className="absolute -right-4 -top-4 w-16 h-16 bg-amber-500/10 rounded-full blur-xl"></div>
              <p className="text-xs text-amber-300/90 leading-relaxed text-center font-medium">
                Present this VIP Pass to Security at the gate. Valid for <strong className="text-amber-400 font-bold">1</strong> guest.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-slate-500">
          {new Date(invite.created_at).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>
    </div>
  );
}
