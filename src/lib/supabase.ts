import { wampSupabase } from './wampClient';

export const supabase = wampSupabase;

// Global security auditor function
export async function logSecurityEvent(eventType: string, details: any = {}) {
  try {
    await supabase.from('security_events').insert({
      id: crypto.randomUUID(),
      event_type: eventType,
      severity: 'medium',
      details: JSON.stringify(details),
    });
  } catch (err) {
    console.error("Failed to log security event", err);
  }
}
