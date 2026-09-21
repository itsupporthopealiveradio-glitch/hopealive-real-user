import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  ArrowLeft,
  Clock,
  TrendingUp,
  Calendar,
  Download,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
} from "lucide-react";
import { supabase } from "../../lib/supabase";

type AttendanceRecord = {
  id: string;
  date: string;
  clockIn: string;
  clockOut: string | null;
  hours: number | null;
  status: "complete" | "in_progress";
  rawClockIn: string;
  rawClockOut: string | null;
};

const PAGE_SIZE = 8;

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function calcHours(clockIn: string, clockOut: string | null): number | null {
  if (!clockOut) return null;
  const ms = new Date(clockOut).getTime() - new Date(clockIn).getTime();
  return Math.round((ms / 3600000) * 10) / 10;
}

export default function AttendanceDashboard() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<"all" | "complete" | "in_progress">("all");
  const [employeeId, setEmployeeId] = useState("");
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printStart, setPrintStart] = useState("");
  const [printEnd, setPrintEnd] = useState("");

  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data?.session) navigate("/");
    };
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    const fetchRecords = async () => {
      setLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;

      if (!userId) {
        setLoading(false);
        return;
      }

      const { data: emp } = await supabase
        .from("employees")
        .select("id")
        .eq("auth_user_id", userId)
        .maybeSingle();

      if (emp) {
        setEmployeeId(emp.id);
        const { data, error } = await supabase
          .from("attendance_records")
          .select("*")
          .eq("employee_id", emp.id)
          .order("clock_in_at", { ascending: false });

        if (!error && data) {
          const mapped: AttendanceRecord[] = data.map((row: any) => ({
            id: row.id,
            date: formatDate(row.clock_in_at),
            clockIn: formatTime(row.clock_in_at),
            clockOut: row.clock_out_at ? formatTime(row.clock_out_at) : null,
            hours: calcHours(row.clock_in_at, row.clock_out_at),
            status: row.status,
            rawClockIn: row.clock_in_at,
            rawClockOut: row.clock_out_at,
          }));
          setRecords(mapped);
        }
      }
      setLoading(false);
    };

    fetchRecords();
  }, []);

  const filteredRecords = records.filter(r => filter === "all" || r.status === filter);
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const paged = filteredRecords.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Grouping logic for UI
  const groupedRecords = paged.reduce((acc, row) => {
    const d = new Date(row.rawClockIn);
    const monthYear = d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    if (!acc[monthYear]) acc[monthYear] = [];
    acc[monthYear].push(row);
    return acc;
  }, {} as Record<string, AttendanceRecord[]>);

  // Summary stats (always computed on all records to keep true stats regardless of filter)
  const totalHoursRaw = records.reduce((acc, r) => acc + (r.hours ?? 0), 0);
  const totalHours = Math.round(totalHoursRaw * 10) / 10;
  const daysPresent = records.filter((r) => r.status === "complete").length;
  const avgHours = daysPresent > 0 ? Math.round((totalHours / daysPresent) * 10) / 10 : 0;

  const handleDownloadClick = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setPrintStart(firstDay.toISOString().split('T')[0]);
    setPrintEnd(lastDay.toISOString().split('T')[0]);
    setShowPrintModal(true);
  };

  return (
    <div className="min-h-screen bg-[#f0f4f8] pb-10">
      <div className="w-full max-w-[400px] mx-auto p-6 space-y-6 font-sans">
        
        {/* Header Icons */}
        <div className="flex justify-between items-center">
          <button onClick={() => navigate("/dashboard")} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white shadow-sm border border-slate-200 text-slate-700">
            <ArrowLeft size={20} strokeWidth={2.5} />
          </button>
          <button onClick={handleDownloadClick} className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#6161D6] text-white shadow-md">
            <Download size={18} strokeWidth={2.5} />
          </button>
        </div>

        {/* Title */}
        <h1 className="text-[32px] font-black text-slate-900 tracking-tight">My Attendance</h1>

        {/* Segmented Control */}
        <div className="flex bg-white rounded-xl p-1 border border-slate-100 shadow-sm">
          <button 
            onClick={() => { setFilter('all'); setPage(1); }} 
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${filter === 'all' ? 'bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] text-slate-900' : 'text-slate-500'}`}
          >
            All
          </button>
          <button 
            onClick={() => { setFilter('in_progress'); setPage(1); }} 
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${filter === 'in_progress' ? 'bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] text-slate-900' : 'text-slate-500'}`}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400"></div>
            Active
          </button>
          <button 
            onClick={() => { setFilter('complete'); setPage(1); }} 
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${filter === 'complete' ? 'bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] text-slate-900' : 'text-slate-500'}`}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-[#6161D6]"></div>
            Completed
          </button>
        </div>

        {/* Summary Stats (Keeping the structure but adapting to mobile) */}
        <div className="grid grid-cols-3 gap-3">
           <div className="bg-white rounded-[1rem] p-3 shadow-sm border border-slate-100 flex flex-col items-center text-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase mb-1">Total Hrs</span>
              <span className="text-lg font-black text-slate-900">{totalHours > 0 ? totalHours : "0"}</span>
           </div>
           <div className="bg-white rounded-[1rem] p-3 shadow-sm border border-slate-100 flex flex-col items-center text-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase mb-1">Avg Daily</span>
              <span className="text-lg font-black text-slate-900">{avgHours > 0 ? avgHours : "0"}</span>
           </div>
           <div className="bg-white rounded-[1rem] p-3 shadow-sm border border-slate-100 flex flex-col items-center text-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase mb-1">Present</span>
              <span className="text-lg font-black text-slate-900">{daysPresent > 0 ? daysPresent : "0"}</span>
           </div>
        </div>

        {/* Lists Grouped by Month */}
        {loading ? (
          <div className="py-12 flex justify-center"><span className="w-6 h-6 border-2 border-[#6161D6] border-t-transparent rounded-full animate-spin"></span></div>
        ) : filteredRecords.length === 0 ? (
          <div className="py-12 text-center text-slate-400 font-medium text-sm">No records found.</div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedRecords).map(([month, rows]) => (
              <div key={month} className="space-y-3">
                <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider pl-1">{month}</h3>
                
                {rows.map(row => (
                  <div key={row.id} className="bg-white border border-slate-100 rounded-[1.25rem] p-4 shadow-sm flex items-center justify-between relative">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 mb-0.5">{row.clockIn} &rarr; {row.clockOut || 'Now'}</p>
                      <p className="text-sm font-black text-slate-900">{row.date}</p>
                      <p className={`text-[10px] font-bold mt-1 ${row.status === 'complete' ? 'text-[#6161D6]' : 'text-amber-500'}`}>
                        {row.hours != null ? `${row.hours} Hours Logged` : "Shift Active"}
                      </p>
                    </div>
                    <div className="flex flex-col items-end justify-between h-full space-y-4">
                      <div className={`px-2.5 py-1 rounded-md text-[10px] font-bold ${
                        row.status === 'complete' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                      }`}>
                        {row.status === 'complete' ? 'Approved' : 'Awaiting'}
                      </div>
                      <div className="w-6 h-6 rounded-md bg-slate-50 flex items-center justify-center">
                        <ChevronRight size={14} className="text-slate-300" strokeWidth={3} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 disabled:opacity-50"><ChevronLeft size={16} strokeWidth={2.5}/></button>
                  <span className="text-xs font-bold text-slate-500">Page {page} of {totalPages}</span>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 disabled:opacity-50"><ChevronRight size={16} strokeWidth={2.5}/></button>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Print Timesheet Modal */}
      {showPrintModal && (
        <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowPrintModal(false)}>
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-[320px] p-6 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="text-slate-900 font-bold text-lg mb-1">Print Timesheet</h3>
                <p className="text-slate-500 text-xs font-medium">Select the date range to generate your Timesheet.</p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block font-bold">Start Date</label>
                  <input
                    type="date"
                    value={printStart}
                    onChange={e => setPrintStart(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-amber-500/50 font-medium"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block font-bold">End Date</label>
                  <input
                    type="date"
                    value={printEnd}
                    onChange={e => setPrintEnd(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-amber-500/50 font-medium"
                  />
                </div>
              </div>
              <div className="flex gap-3 w-full mt-2">
                <button onClick={() => setShowPrintModal(false)} className="flex-1 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold">Cancel</button>
                <button 
                  onClick={() => {
                    if (!employeeId) return;
                    navigate(`/print-timesheet/${employeeId}?start=${printStart}&end=${printEnd}`);
                    setShowPrintModal(false);
                  }} 
                  className="flex-1 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-black font-bold shadow-sm"
                >
                  Generate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
