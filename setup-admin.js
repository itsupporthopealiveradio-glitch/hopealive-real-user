import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://haoxttmprwepyenguvzp.supabase.co';
const supabaseKey = 'sb_publishable_CP2eHoi7jg_-BC8_trqzgw_b4CCTkoc'; // The anon key allows signup if enabled
const supabase = createClient(supabaseUrl, supabaseKey);

async function setupAdmin() {
  const email = 'rafuma55@gmail.com';
  const password = 'Rafuma3252565';
  
  console.log('Signing up admin...');
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: email,
    password: password,
  });
  
  if (authError) {
    console.log('Signup Error (maybe user already exists):', authError.message);
  } else {
    console.log('Auth user created:', authData.user?.id);
  }

  // Try to login to get the id if they already existed
  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (loginError) {
    console.log('Login Error:', loginError.message);
    return;
  }

  const userId = loginData.user.id;
  console.log('Logged in successfully. User ID:', userId);

  // Check if employee record exists
  const { data: empData } = await supabase
    .from('employees')
    .select('id')
    .eq('auth_user_id', userId)
    .maybeSingle();
    
  const { data: orgData } = await supabase.from('organizations').select('id').limit(1).single();
  const orgId = orgData?.id;

  if (!empData) {
    console.log('Creating employee record for admin...');
    const { error: insertError } = await supabase
      .from('employees')
      .insert({
        org_id: orgId,
        auth_user_id: userId,
        full_name: 'Rafuma Mufamadi',
        email: email,
        role: 'admin',
        onboarding_status: 'enrolled'
      });
      
    if (insertError) {
      console.log('Error creating employee record:', insertError);
    } else {
      console.log('Employee record created successfully!');
    }
  } else {
    console.log('Updating existing employee record to admin...');
    const { error: updateError } = await supabase
      .from('employees')
      .update({ role: 'admin', onboarding_status: 'enrolled' })
      .eq('auth_user_id', userId);
      
    if (updateError) {
      console.log('Error updating employee:', updateError);
    } else {
      console.log('Employee record updated successfully!');
    }
  }
}

setupAdmin();
