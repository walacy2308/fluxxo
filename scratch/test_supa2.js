require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function test() {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_chat_id', 7629189731)
    .maybeSingle();
    
  console.log('Single User:', data);
  console.log('Error:', error);
}

test();
