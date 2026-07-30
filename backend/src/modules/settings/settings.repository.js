const supabase = require('../../config/db');

const SettingsRepository = {
    async getLaborSettings() {
        return await supabase
            .from('labor_settings')
            .select('*')
            .order('category_key', { ascending: true });
    },
    async updateLaborSetting(key, updates) {
        return await supabase
            .from('labor_settings')
            .update(updates)
            .eq('category_key', key);
    }
};

module.exports = { SettingsRepository };