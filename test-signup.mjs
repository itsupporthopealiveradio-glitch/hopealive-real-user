import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://haoxttmprwepyenguvzp.supabase.co', 'sb_publishable_CP2eHoi7jg_-BC8_trqzgw_b4CCTkoc');

async function test() {
  console.log('Attempting sign in...');
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: 'itsupporthopealiveradio@gmail.com',
    password: 'Hope@2020'
  });
  
  if (signInError) {
    console.log('Sign in failed:', signInError.message);
    if (signInError.message.includes('Invalid login credentials')) {
      console.log('Attempting sign up instead...');
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: 'itsupporthopealiveradio@gmail.com',
        password: 'Hope@2020'
      });
      if (signUpError) {
        console.log('Sign up failed:', signUpError.message);
      } else {
        console.log('Sign up successful! ID:', signUpData.user?.id);
      }
    }
  } else {
    console.log('Sign in successful! ID:', signInData.user.id);
  }
  process.exit(0);
}
test();
