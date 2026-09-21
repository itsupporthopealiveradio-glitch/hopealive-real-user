// Script to create Rafuma's account in Supabase
// Run: node create-user.mjs

const supabaseUrl = 'https://haoxttmprwepyenguvzp.supabase.co';
// Using the service role key - you need to get this from Supabase Dashboard > Settings > API > service_role
// For now using the publishable key (anon key) which can only signup via auth.signUp
const supabaseKey = 'sb_publishable_CP2eHoi7jg_-BC8_trqzgw_b4CCTkoc';

const email = 'Rafuma55@gmail.com';
const password = 'pin_3252'; // prefix "pin_" + 4-digit PIN

async function createUser() {
  const response = await fetch(`${supabaseUrl}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({ email, password }),
  });
  
  const data = await response.json();
  
  if (data.error) {
    console.error('Error:', data.error.message || data.error);
    if (data.error.message?.includes('already registered')) {
      console.log('✅ User already exists in the database. Good to go!');
    }
  } else if (data.user?.id) {
    console.log('✅ User created successfully!');
    console.log('   Email:', data.user.email);
    console.log('   ID:', data.user.id);
  } else {
    console.log('Response:', JSON.stringify(data, null, 2));
  }
}

createUser().catch(console.error);
