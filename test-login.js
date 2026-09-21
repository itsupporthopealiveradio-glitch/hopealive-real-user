import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://haoxttmprwepyenguvzp.supabase.co';
const supabaseKey = 'sb_publishable_CP2eHoi7jg_-BC8_trqzgw_b4CCTkoc';
const supabase = createClient(supabaseUrl, supabaseKey);

async function loginUser() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'Rafuma55@gmail.com',
    password: 'pin_3252',
  });
  console.log('Login:', data?.user?.id || data?.session);
  console.log('Error:', error);
}
loginUser();
