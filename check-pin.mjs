import { createClient } from '@supabase/supabase-js';
const supabaseUrl = 'https://haoxttmprwepyenguvzp.supabase.co';
const supabaseKey = 'sb_publishable_CP2eHoi7jg_-BC8_trqzgw_b4CCTkoc';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const pins = ['0000','1111','1234','2222','3333','4444','5555','6666','7777','8888','9999','1212','5566','1996','5555','2024','2026'];
  for (let pin of pins) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'rafuma55@gmail.com',
      password: `pin_${pin}`
    });
    if (!error) {
      console.log('FOUND PIN:', pin);
      return;
    }
  }
  console.log('PIN not found in common list.');
}
check();
