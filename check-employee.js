import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://haoxttmprwepyenguvzp.supabase.co';
const supabaseKey = 'sb_publishable_CP2eHoi7jg_-BC8_trqzgw_b4CCTkoc';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkEmployee() {
  await supabase.auth.signInWithPassword({
    email: 'Rafuma55@gmail.com',
    password: 'Rafuma3252565',
  });
  const { data, error } = await supabase.from('employees').select('*');
  console.log(error);
  console.log(data);
}
checkEmployee();
