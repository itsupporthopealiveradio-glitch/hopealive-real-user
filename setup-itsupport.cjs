const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://haoxttmprwepyenguvzp.supabase.co', 'sb_publishable_CP2eHoi7jg_-BC8_trqzgw_b4CCTkoc');

async function setup() {
  const userId = 'ac420f2f-cf18-4508-be6d-e013ea18e19e'; // The newly created ID
  const email = 'ITSupporthopealiveradio@gmail.com';
  
  const { data, error } = await supabase
    .from('employees')
    .insert([
      {
        org_id: '15fb77fe-a114-4405-a8cc-b1469412cd48',
        auth_user_id: userId,
        full_name: 'IT Support',
        first_name: 'IT',
        last_name: 'Support',
        email: email,
        department: 'Management',
        role: 'admin',
        employment_status: 'active',
        status: 'active'
      }
    ]);
    
  if (error) {
    console.error('Error inserting into employees:', error);
  } else {
    console.log('Successfully inserted ITSupport into employees as admin.');
  }
}

setup();
