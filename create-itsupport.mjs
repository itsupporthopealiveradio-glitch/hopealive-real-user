const supabaseUrl = 'https://haoxttmprwepyenguvzp.supabase.co';
const supabaseKey = 'sb_publishable_CP2eHoi7jg_-BC8_trqzgw_b4CCTkoc';

const email = 'ITSupporthopealiveradio@gmail.com';
const password = 'Hope@2020';

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
