import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://haoxttmprwepyenguvzp.supabase.co';
const supabaseKey = 'sb_publishable_CP2eHoi7jg_-BC8_trqzgw_b4CCTkoc';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  await supabase.auth.signInWithPassword({ email: 'Rafuma55@gmail.com', password: 'pin_3252' });
  const { error } = await supabase.from('employees').insert({
    full_name: 'Test',
    email: 'test@example.com',
    role: 'Employee',
    onboarding_status: 'not_started'
  });
  console.log('not_started:', error?.message);
  
  const { error: err2 } = await supabase.from('employees').insert({
    full_name: 'Test',
    email: 'test2@example.com',
    role: 'Employee',
    onboarding_status: 'invited'
  });
  console.log('invited:', err2?.message);
}

check();
