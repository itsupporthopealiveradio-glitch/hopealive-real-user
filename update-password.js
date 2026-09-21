import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://haoxttmprwepyenguvzp.supabase.co';
const supabaseKey = 'sb_publishable_CP2eHoi7jg_-BC8_trqzgw_b4CCTkoc'; // anon key
const supabase = createClient(supabaseUrl, supabaseKey);

async function resetPassword() {
  // First try to login with the old known password
  console.log('Logging in with old PIN password...');
  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email: 'Rafuma55@gmail.com',
    password: 'pin_3252',
  });

  if (loginError) {
    console.log('Failed to login with pin_3252:', loginError.message);
    
    // Maybe they already have the new password?
    const { data: testData, error: testError } = await supabase.auth.signInWithPassword({
      email: 'Rafuma55@gmail.com',
      password: 'Rafuma3252565',
    });
    
    if (!testError) {
      console.log('User ALREADY HAS the new password Rafuma3252565! You can log in.');
      return;
    } else {
      console.log('Also failed to login with new password:', testError.message);
      return;
    }
  }

  console.log('Logged in! Updating password to Rafuma3252565...');
  const { error: updateError } = await supabase.auth.updateUser({
    password: 'Rafuma3252565'
  });

  if (updateError) {
    console.log('Failed to update password:', updateError.message);
  } else {
    console.log('Password successfully updated to Rafuma3252565!');
  }
}

resetPassword();
