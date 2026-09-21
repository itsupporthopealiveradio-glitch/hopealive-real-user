import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.rpc('add_profile_image_column');
  if (error) console.error(error);
  else console.log('Column check/add RPC completed.');
}
check();
