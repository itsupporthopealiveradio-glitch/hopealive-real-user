import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://haoxttmprwepyenguvzp.supabase.co';
const supabaseKey = 'sb_publishable_CP2eHoi7jg_-BC8_trqzgw_b4CCTkoc';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('employees').select('email, status, onboarding_status, auth_user_id');
  console.log(data);
}
check();
