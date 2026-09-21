// Run: node list-users.mjs
// Lists all registered users from Supabase Auth
// NOTE: You need to replace SERVICE_ROLE_KEY below with your actual service_role key
// Get it from: Supabase Dashboard → Settings → API → service_role (secret)

const supabaseUrl = 'https://haoxttmprwepyenguvzp.supabase.co';

// ⚠️ This requires the SERVICE ROLE key (not the publishable key)
// Go to Supabase Dashboard > Settings > API > Copy "service_role" key
const SERVICE_ROLE_KEY = 'PASTE_YOUR_SERVICE_ROLE_KEY_HERE';

async function listUsers() {
  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    headers: {
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });

  const data = await response.json();

  if (data.error) {
    console.error('Error:', data.error);
    return;
  }

  const users = data.users || [];
  console.log(`\n📋 Total Users: ${users.length}\n`);
  users.forEach((u, i) => {
    console.log(`${i + 1}. Email: ${u.email}`);
    console.log(`   ID: ${u.id}`);
    console.log(`   Created: ${new Date(u.created_at).toLocaleString()}`);
    console.log(`   Last Sign In: ${u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString() : 'Never'}`);
    console.log('');
  });
}

listUsers().catch(console.error);
