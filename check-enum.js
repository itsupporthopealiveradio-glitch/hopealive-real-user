import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://haoxttmprwepyenguvzp.supabase.co';
const supabaseKey = 'sb_publishable_CP2eHoi7jg_-BC8_trqzgw_b4CCTkoc'; // anon key
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkEnum() {
  const { data, error } = await supabase.rpc('get_enum_values', { enum_name: 'onboarding_state' });
  if (error) {
    console.log('RPC error, trying raw query if possible or checking the schema:', error);
  } else {
    console.log('Enum values:', data);
  }
}

checkEnum();
