import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://haoxttmprwepyenguvzp.supabase.co';
const supabaseKey = 'sb_publishable_CP2eHoi7jg_-BC8_trqzgw_b4CCTkoc'; // anon key
const supabase = createClient(supabaseUrl, supabaseKey);

async function resetPassword() {
  console.log('Logging in with current password...');
  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email: 'Rafuma55@gmail.com',
    password: 'Rafuma3252565',
  });

  if (loginError) {
    console.log('Failed to login:', loginError.message);
    return;
  }

  console.log('Logged in! Updating password to pin_3252...');
  const { error: updateError } = await supabase.auth.updateUser({
    password: 'pin_3252'
  });

  if (updateError) {
    console.log('Failed to update password:', updateError.message);
  } else {
    console.log('Password successfully updated to pin_3252!');
  }
}

resetPassword();
