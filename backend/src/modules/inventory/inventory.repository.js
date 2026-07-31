const pool = require('../../config/pgClient');

const InventoryRepository = {
    async getProducts() {
        try {
            const result = await pool.query('SELECT * FROM products ORDER BY name ASC');
            return { data: result.rows, error: null };
        } catch (error) {
            return { data: null, error };
        }
    },
    async getLaborRate(categoryKey) {
        try {
            const result = await pool.query(
                'SELECT unloading_rate_per_unit FROM labor_settings WHERE category_key = $1',
                [categoryKey]
            );
            if (result.rows.length !== 1) {
                return { data: null, error: new Error('Labor rate not found') };
            }
            return { data: result.rows[0], error: null };
        } catch (error) {
            return { data: null, error };
        }
    },
    async updateProduct(id, updates) {
        try {
            await pool.query(
                'UPDATE products SET current_stock = $1, buying_price = $2, default_selling_price = $3, unit = $4, unloading_labor_cost = $5, product_group = $6 WHERE id = $7',
                [updates.current_stock, updates.buying_price, updates.default_selling_price, updates.unit, updates.unloading_labor_cost, updates.product_group, id]
            );
            return { error: null };
        } catch (error) {
            return { error };
        }
    },
    async insertProduct(data) {
        try {
            const result = await pool.query(
                `INSERT INTO products (name, unit, current_stock, buying_price, default_selling_price, unloading_labor_cost, product_group)
                 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
                [data.name, data.unit, data.current_stock, data.buying_price, data.default_selling_price, data.unloading_labor_cost, data.product_group]
            );
            return { data: result.rows, error: null };
        } catch (error) {
            return { data: null, error };
        }
    },
    async insertLog(logData) {
        try {
            await pool.query(
                'INSERT INTO inventory_logs (product_id, product_name, labor_cost) VALUES ($1, $2, $3)',
                [logData.product_id, logData.product_name, logData.labor_cost]
            );
            return { error: null };
        } catch (error) {
            return { error };
        }
    },
    async checkLaborSettingExists(categoryKey) {
        try {
            const result = await pool.query(
                'SELECT id FROM labor_settings WHERE category_key = $1',
                [categoryKey]
            );
            return { data: result.rows, error: null };
        } catch (error) {
            return { data: null, error };
        }
    },
    async insertLaborSetting(data) {
        try {
            const result = await pool.query(
                'INSERT INTO labor_settings (category_key, rate_per_unit, unloading_rate_per_unit) VALUES ($1, $2, $3) RETURNING *',
                [data.category_key, data.rate_per_unit, data.unloading_rate_per_unit]
            );
            return { data: result.rows, error: null };
        } catch (error) {
            return { data: null, error };
        }
    }
};

module.exports = { InventoryRepository };