import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://haoxttmprwepyenguvzp.supabase.co';
const supabaseKey = 'sb_publishable_CP2eHoi7jg_-BC8_trqzgw_b4CCTkoc';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  await supabase.auth.signInWithPassword({ email: 'Rafuma55@gmail.com', password: 'pin_3252' });
  const { error } = await supabase.from('employees').insert({
    full_name: 'Test',
    email: 'testx@example.com',
    role: 'employee',
    department: 'HR',
    id_number: '123456789'
  });
  console.log(error?.message);
}

check();
