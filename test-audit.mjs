import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env.local', 'utf-8');
const env = Object.fromEntries(envFile.split('\n').filter(Boolean).map(line => line.split('=')));

const supabaseUrl = env.VITE_SUPABASE_URL.trim();
const supabaseKey = env.VITE_SUPABASE_ANON_KEY.trim();
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAudit() {
  const { error: insertError } = await supabase.from('audit_log').insert({
    action: 'Test Action',
    result: 'Success',
    ip_address: '127.0.0.1',
    device_info: 'Node.js test'
  });
  if (insertError) {
    console.error('Insert error:', insertError);
  }

  const { data, error } = await supabase.from('audit_log').select('*');
  if (error) {
    console.error('Error fetching audit_log:', error);
  } else {
    console.log('Audit log data:', data);
  }
}
checkAudit();
