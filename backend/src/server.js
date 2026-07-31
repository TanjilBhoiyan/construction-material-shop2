require('dotenv').config();
const app = require('./app'); 
const pool = require('./config/pgClient');

const PORT = process.env.PORT || 5000;

// Database connection check korar function
async function checkDatabaseConnection() {
    try {
        await pool.query('SELECT 1');
        console.log("✅ Database 100% CONNECTED SUCCESSFULLY! 🎉");
    } catch (err) {
        console.log("❌ Fatal Connection Error:", err.message);
    }
}

// সার্ভার রান করছি
app.listen(PORT, () => {
    console.log(`🚀 Server is LIVE on http://localhost:${PORT}`);
    checkDatabaseConnection();
});