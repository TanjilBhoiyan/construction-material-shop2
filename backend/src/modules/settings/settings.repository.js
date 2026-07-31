const pool = require('../../config/pgClient');

const SettingsRepository = {
    async getLaborSettings() {
        try {
            const result = await pool.query(
                'SELECT * FROM labor_settings ORDER BY category_key ASC'
            );
            return { data: result.rows, error: null };
        } catch (error) {
            return { data: null, error };
        }
    },
    async updateLaborSetting(key, updates) {
        try {
            await pool.query(
                'UPDATE labor_settings SET rate_per_unit = $1, unloading_rate_per_unit = $2, updated_at = $3 WHERE category_key = $4',
                [updates.rate_per_unit, updates.unloading_rate_per_unit, updates.updated_at, key]
            );
            return { error: null };
        } catch (error) {
            return { error };
        }
    }
};

module.exports = { SettingsRepository };