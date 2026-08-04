const pool = require('../../config/pgClient');

const ReportRepository = {
    async getSalesByDate(startIso, endIso) {
        try {
            const result = await pool.query(
                'SELECT * FROM sales WHERE created_at >= $1 AND created_at <= $2 ORDER BY created_at DESC',
                [startIso, endIso]
            );
            return { data: result.rows, error: null };
        } catch (error) {
            return { data: null, error };
        }
    },
    async getInventoryLogsByDate(startIso, endIso) {
        try {
            const result = await pool.query(
                'SELECT * FROM inventory_logs WHERE created_at >= $1 AND created_at <= $2 ORDER BY created_at DESC',
                [startIso, endIso]
            );
            return { data: result.rows, error: null };
        } catch (error) {
            return { data: null, error };
        }
    },

    // 🎯 নতুন — "মাল ফেরত" এর লেবার খরচ দৈনিক রিপোর্টে যোগ করার জন্য
    async getReturnsByDate(startIso, endIso) {
        try {
            const result = await pool.query(
                'SELECT * FROM product_returns WHERE created_at >= $1 AND created_at <= $2 ORDER BY created_at DESC',
                [startIso, endIso]
            );
            return { data: result.rows, error: null };
        } catch (error) {
            return { data: null, error };
        }
    }
};

module.exports = { ReportRepository };