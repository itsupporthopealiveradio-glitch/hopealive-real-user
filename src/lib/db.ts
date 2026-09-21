import { createClient } from '@supabase/supabase-js';

// Environment variable target selector: 'primary' or 'secondary'.
// The secondary target is the configured development fallback when .env.production is not loaded.
const target = (import.meta.env.VITE_DB_TARGET || 'secondary').toLowerCase();

// Primary database configuration
const primaryUrl = import.meta.env.VITE_SUPABASE_URL || 'https://haoxttmprwepyenguvzp.supabase.co';
const primaryKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Secondary database configuration (CPU / Failover Target)
const secondaryUrl = import.meta.env.VITE_SUPABASE_URL_SECONDARY || 'https://gufeqpyoypeyfceootgo.supabase.co';
const secondaryKey = import.meta.env.VITE_SUPABASE_ANON_KEY_SECONDARY || 'sb_publishable_IqqdE-X-nDMUh1MXZvaKgQ_JeCBEBnR';

// Determine active Supabase project endpoint
const supabaseUrl = target === 'primary' ? primaryUrl : secondaryUrl;
const supabaseKey = target === 'primary' ? primaryKey : secondaryKey;

// Single Supabase Client Instance across entire application
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storageKey: `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`,
    persistSession: true,
    autoRefreshToken: true,
  }
});

// Clear stale sessions from other project refs on boot
if (typeof window !== 'undefined') {
  try {
    const currentRef = new URL(supabaseUrl).hostname.split('.')[0];
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('sb-') && key.endsWith('-auth-token') && !key.includes(currentRef)) {
        localStorage.removeItem(key);
      }
    });
  } catch (e) {
    console.warn("Storage cleanup notice:", e);
  }
}
