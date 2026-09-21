import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { ShieldAlert, Terminal, MapPin, MonitorSmartphone, AlertTriangle } from "lucide-react";

export function SecurityAuditLog() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasNewAlert, setHasNewAlert] = useState(false);

  useEffect(() => {
    fetchLogs();

    // Subscribe to real-time security breaches
    const channel = supabase
      .channel('security_audit_logs_channel')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'security_audit_logs' }, (payload) => {
        setLogs((current) => [payload.new, ...current]);
        setHasNewAlert(true);
        // Trigger browser notification if critical
        if (payload.new.event_type.includes('REVERSE_ENGINEERING') || payload.new.event_type.includes('RLS_VIOLATION')) {
          try { new Audio('/alert.mp3').play(); } catch(e){}
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchLogs() {
    try {
      const { data, error } = await supabase
        .from('security_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        if (error.code === '42P01') {
           setLogs([]); // Table doesn't exist yet
        } else {
           throw error;
        }
      } else {
        setLogs(data || []);
      }
    } catch (err) {
      console.error("Failed to fetch security logs", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`p-6 rounded-2xl border ${hasNewAlert ? 'bg-red-500/10 border-red-500/50' : 'bg-surface border-border-strong'} transition-colors duration-500`}>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${hasNewAlert ? 'bg-red-500 text-white animate-pulse' : 'bg-primary/20 text-primary'}`}>
            {hasNewAlert ? <AlertTriangle size={20} /> : <ShieldAlert size={20} />}
          </div>
          <div>
            <h3 className={`text-lg font-bold ${hasNewAlert ? 'text-red-500' : 'text-content'}`}>
              Security Audit Log
            </h3>
            <p className="text-sm text-content-muted">Real-time threat detection and access auditing</p>
          </div>
        </div>
        {hasNewAlert && (
          <button 
            onClick={() => setHasNewAlert(false)}
            className="px-4 py-2 bg-surface-elevated text-content text-sm font-bold rounded-lg hover:bg-surface border border-border-strong"
          >
            Acknowledge Alerts
          </button>
        )}
      </div>

      <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
        {loading ? (
          <p className="text-content-muted text-sm text-center py-10">Loading security logs...</p>
        ) : logs.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-border-strong rounded-xl bg-surface-elevated/50">
            <ShieldAlert size={32} className="mx-auto text-emerald-500 mb-3 opacity-50" />
            <p className="text-content font-medium">System Secure</p>
            <p className="text-content-muted text-sm mt-1">No security breaches or anomalies detected.</p>
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="p-4 bg-surface-elevated border border-border-strong rounded-xl flex flex-col md:flex-row gap-4 justify-between items-start">
              <div className="flex items-start gap-3">
                <div className={`mt-1 flex-shrink-0 ${log.event_type.includes('ATTEMPT') || log.event_type.includes('VIOLATION') ? 'text-red-500' : 'text-amber-500'}`}>
                  <Terminal size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-content font-mono">{log.event_type}</h4>
                  <div className="text-xs text-content-muted mt-1 font-mono break-all max-w-[500px]">
                    {JSON.stringify(log.details)}
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col items-end gap-1 min-w-[150px]">
                <div className="text-xs font-medium text-content bg-surface px-2 py-1 rounded border border-border-strong flex items-center gap-1.5">
                  <MapPin size={12} className="text-content-subtle" />
                  {log.ip_address || 'Unknown IP'}
                </div>
                <div className="text-[10px] text-content-subtle truncate max-w-[200px] flex items-center gap-1">
                  <MonitorSmartphone size={10} />
                  {log.user_agent || 'Unknown Device'}
                </div>
                <div className="text-[10px] text-content-muted mt-1 font-mono">
                  {new Date(log.created_at).toLocaleString()}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
