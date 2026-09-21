import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './db';
import {
  POLL_INTERVAL_MS,
  USE_REALTIME,
  PAUSE_WHEN_HIDDEN,
  BACKOFF_START_MS,
  BACKOFF_MAX_MS,
  MAX_ROWS,
} from './pollingConfig';

type Options = {
  /** Table to read, e.g. 'attendance_records'. */
  table: string;
  /** Named columns only. '*' on a polled table wastes egress every cycle. */
  columns: string;
  /** Optional narrowing applied to every fetch. */
  filter?: (q: any) => any;
  limit?: number;
  enabled?: boolean;
};

function isHidden() {
  return (
    PAUSE_WHEN_HIDDEN &&
    typeof document !== 'undefined' &&
    document.visibilityState === 'hidden'
  );
}

export function useLiveTable<T = any>({
  table,
  columns,
  filter,
  limit = MAX_ROWS,
  enabled = true,
}: Options) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const inFlight = useRef(false);
  const backoff = useRef(BACKOFF_START_MS);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchRows = useCallback(async () => {
    if (!enabled || inFlight.current || isHidden()) return;

    inFlight.current = true;
    try {
      let q = supabase.from(table).select(columns).limit(limit);
      if (filter) q = filter(q);

      const { data, error: err } = await q;
      if (err) throw err;

      setRows((data ?? []) as T[]);
      setLastUpdated(new Date());
      setError(null);
      backoff.current = BACKOFF_START_MS;
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load');
      backoff.current = Math.min(backoff.current * 2, BACKOFF_MAX_MS);
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [table, columns, limit, filter, enabled]);

  // Initial load + realtime subscription.
  useEffect(() => {
    if (!enabled) return;
    void fetchRows();

    if (!USE_REALTIME) return;

    const channel = supabase
      .channel(`live:${table}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        if (!isHidden()) void fetchRows();
      })
      .subscribe((status) => setLive(status === 'SUBSCRIBED'));

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [table, enabled, fetchRows]);

  // 6-minute safety timer. Skipped while realtime is healthy or the tab is hidden.
  useEffect(() => {
    if (!enabled) return;

    const schedule = () => {
      if (timer.current) clearTimeout(timer.current);
      const delay = error ? backoff.current : POLL_INTERVAL_MS;

      timer.current = setTimeout(async () => {
        const realtimeHealthy = USE_REALTIME && live && !error;
        if (!isHidden() && !realtimeHealthy) await fetchRows();
        schedule();
      }, delay);
    };

    schedule();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [enabled, live, error, fetchRows]);

  // One refresh when the user returns to the tab
  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') void fetchRows();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [enabled, fetchRows]);

  return { rows, loading, error, live, lastUpdated, refresh: fetchRows };
}
