const supabaseUrl = 'https://haoxttmprwepyenguvzp.supabase.co';
const supabaseKey = 'sb_publishable_CP2eHoi7jg_-BC8_trqzgw_b4CCTkoc';

async function loginUser() {
  const response = await fetch(supabaseUrl + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': 'Bearer ' + supabaseKey,
    },
    body: JSON.stringify({ email: 'Rafuma55@gmail.com', password: 'Rafuma3252565' }),
  });
  const data = await response.json();
  console.log(data);
}
loginUser();
