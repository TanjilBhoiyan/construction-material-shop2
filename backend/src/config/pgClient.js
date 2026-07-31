const { Pool, types } = require('pg');
require('dotenv').config();

// 🎯 পোস্টগ্রেসের NUMERIC/DECIMAL কলাম ডিফল্টভাবে স্ট্রিং হিসেবে আসে (pg লাইব্রেরির নিয়ম),
// কিন্তু Supabase client আগে এগুলো সরাসরি নাম্বার হিসেবে দিত। এখানে গ্লোবালি ঠিক করে দিলাম
// যাতে সব মডিউলেই (reports, billing, customers...) এই কলামগুলো সবসময় নাম্বার হিসেবেই আসে,
// আর ফ্রন্টএন্ডের .toFixed() এর মতো ফাংশন আগের মতোই কাজ করে।
types.setTypeParser(1700, (val) => parseFloat(val)); // numeric/decimal
types.setTypeParser(20, (val) => parseInt(val, 10)); // bigint

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.log("❌ Error: DATABASE_URL paowa jacche na! .env file check koro.");
}

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

pool.on('error', (err) => {
    console.error('❌ Unexpected database pool error:', err.message);
});

console.log('✅ PostgreSQL pool initialized successfully!');

module.exports = pool;