require('dotenv').config();
const app = require('./app'); 
const supabase = require('./config/db');

const PORT = process.env.PORT || 5000;

// Database connection check korar function
async function checkDatabaseConnection() {
    try {
       // এখানে 'inventory' এর বদলে তোমার আসল টেবিল 'products' দেওয়া হলো 
        const { error } = await supabase.from('products').select('*').limit(1);
        
        if (error && error.code === '42P01') { 
            console.log("✅ Database 100% CONNECTED SUCCESSFULLY! 🎉");
            console.log("⚠️  (Kintu Supabase e ekhono 'products' table ta banano hoy nai)");
        } else if (error) {
            console.log("❌ Database Error:", error.message);
        } else {
            console.log("✅ Database 100% CONNECTED SUCCESSFULLY! 🎉");
        }
    } catch (err) {
        console.log("❌ Fatal Connection Error:", err.message);
    }
}

// সার্ভার রান করছি
app.listen(PORT, () => {
    console.log(`🚀 Server is LIVE on http://localhost:${PORT}`);
    checkDatabaseConnection();
});