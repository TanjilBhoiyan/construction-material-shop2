const supabase = require('../../config/db'); // ওয়েব অ্যাপের ডাটাবেস লোকেশন

const InventoryRepository = {
    async getProducts() {
        return await supabase.from('products').select('*').order('name', { ascending: true });
    },
    async getLaborRate(categoryKey) {
        return await supabase.from('labor_settings').select('unloading_rate_per_unit').eq('category_key', categoryKey).single();
    },
    async updateProduct(id, updates) {
        return await supabase.from('products').update(updates).eq('id', id);
    },
    async insertProduct(data) {
        return await supabase.from('products').insert([data]).select();
    },
    async insertLog(logData) {
        return await supabase.from('inventory_logs').insert([logData]);
    },
    async checkLaborSettingExists(categoryKey) {
        return await supabase.from('labor_settings').select('id').eq('category_key', categoryKey);
    },
    async insertLaborSetting(data) {
        return await supabase.from('labor_settings').insert([data]).select();
    }
};

module.exports = { InventoryRepository };