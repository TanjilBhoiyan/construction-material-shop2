const supabase = require('../../config/db');

const BillingRepository = {
    async getLaborSettings() {
        return await supabase.from('labor_settings').select('*');
    },
    async getProductStock(productId) {
        return await supabase.from('products').select('current_stock, name').eq('id', productId).single();
    },
    async updateProductStock(productId, newStock) {
        return await supabase.from('products').update({ current_stock: newStock }).eq('id', productId);
    },
    async getCustomerByPhone(phone) {
        return await supabase.from('customers').select('*').eq('phone', phone).maybeSingle();
    },
    async getCustomerByName(name) {
        return await supabase.from('customers').select('*').eq('name', name).maybeSingle();
    },
    async updateCustomer(id, data) {
        return await supabase.from('customers').update(data).eq('id', id);
    },
    async insertCustomer(data) {
        return await supabase.from('customers').insert([data]).select();
    },
    async insertSale(data) {
        return await supabase.from('sales').insert([data]).select();
    },
    async insertSaleItems(data) {
        return await supabase.from('sale_items').insert(data);
    },
    async insertSaleItems(data) {
        return await supabase.from('sale_items').insert(data);
    },

    // 🎯 নতুন — পুরো checkout একটা atomic transaction হিসেবে চলে (process_checkout SQL ফাংশন)
    async checkoutRPC(params) {
        return await supabase.rpc('process_checkout', params);
    }
};

module.exports = { BillingRepository };
