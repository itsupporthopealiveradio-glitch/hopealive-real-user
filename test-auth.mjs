import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://haoxttmprwepyenguvzp.supabase.co', 'sb_publishable_CP2eHoi7jg_-BC8_trqzgw_b4CCTkoc');
async function test() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'itsupporthopealiveradio@gmail.com',
    password: 'Hope@2020'
  });
  if (error) {
    console.log('Result: Error:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
  } else {
    console.log('Result: Success! User ID: ' + data.user.id);
  }
}
test();
