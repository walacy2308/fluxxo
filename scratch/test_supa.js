require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function test() {
  const { data, error } = await supabase
    .from('users')
    .select('*');
    
  console.log('All Users:', data);
  console.log('Error:', error);
}

test();
