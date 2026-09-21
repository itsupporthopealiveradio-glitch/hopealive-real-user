import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gufeqpyoypeyfceootgo.supabase.co';
const supabaseKey = 'sb_publishable_IqqdE-X-nDMUh1MXZvaKgQ_JeCBEBnR';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testLogin() {
  console.log("Attempting login with IT support...");
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'itsupporthopealiveradio@gmail.com',
    password: 'Hope@2020',
  });
  
  if (error) {
    console.error("Login Error:", error.message);
  } else {
    console.log("Login Success! User ID:", data.user?.id);
    
    // Test role check
    const { data: emp, error: empErr } = await supabase
      .from('employees')
      .select('role')
      .eq('auth_user_id', data.user?.id)
      .single();
      
    if (empErr) console.error("Employee Role Error:", empErr);
    else console.log("Role:", emp.role);
  }
}

testLogin();
