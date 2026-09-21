import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.from('employees').select('id, full_name, profile_image_data').not('profile_image_data', 'is', null);
  if (error) console.error(error);
  console.log("Employees with images:", data?.length);
  if (data?.length) {
    console.log("Sample image length:", data[0].profile_image_data.length);
  }
}
check();
