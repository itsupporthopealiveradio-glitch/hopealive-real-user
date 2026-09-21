import { supabase } from './supabase';

export const logAudit = async (action: string, result: string) => {
  try {
    await supabase.from("audit_log").insert({
      action,
      result,
      ip_address: "Internal",
      device_info: navigator.userAgent || "Unknown Device"
    });
  } catch (error) {
    console.error("Failed to log audit:", error);
  }
};
