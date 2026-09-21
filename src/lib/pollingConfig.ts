/**
 * Every polling interval in the app, in one file.
 *
 * There must be no setInterval or setTimeout anywhere else in src/ that triggers
 * a database query. If you need to change how often the app talks to Supabase,
 * change it here and nowhere else.
 */

/** 6 minutes. The headline change. */
export const POLL_INTERVAL_MS = 6 * 60 * 1000; // 360000

/**
 * When Realtime is connected the app doesn't poll at all — the database pushes
 * changes and this interval is only a safety net for a dropped subscription.
 */
export const USE_REALTIME = true;

/** Never query while the tab is in the background. Large saving, no downside. */
export const PAUSE_WHEN_HIDDEN = true;

/** On error, back off from 30s up to 15 minutes instead of retrying hard. */
export const BACKOFF_START_MS = 30 * 1000;
export const BACKOFF_MAX_MS = 15 * 60 * 1000;

/**
 * Row cap per query. Free tier includes limited monthly egress, and an admin
 * dashboard left open all day is what eats it. Select named columns, never '*',
 * on any table you poll.
 */
export const MAX_ROWS = 100;
