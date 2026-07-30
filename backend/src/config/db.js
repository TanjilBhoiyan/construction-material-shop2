const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.log("❌ Error: Supabase URL ba Key paowa jacche na! .env file check koro.");
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('✅ Supabase client initialized successfully!');

module.exports = supabase;