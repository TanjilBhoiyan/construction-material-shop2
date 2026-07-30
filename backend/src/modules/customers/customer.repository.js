const supabase = require('../../config/db');

const CustomerRepository = {
    async getSalesByCustomer(phone, name) {
        let query = supabase.from('sales').select('*');
        if (phone && phone.trim() !== '') {
            // 🎯 ফোন থাকলে শুধু ফোন দিয়েই ম্যাচ করি — নাম দিয়ে না, কারণ একই নামের একাধিক
            // কাস্টমার থাকলে নাম-ম্যাচ ভুল কাস্টমারের সেল টেনে আনত।
            query = query.eq('customer_phone', phone);
        } else {
            // ফোন নেই (অনিবন্ধিত/walk-in কাস্টমার) — নাম দিয়েই ম্যাচ করতে হবে, কিন্তু
            // শুধু সেসব সেল যেগুলোরও ফোন নাম্বার খালি, নাহলে ফোন-থাকা অন্য কাস্টমারের
            // সেল ভুলভাবে চলে আসবে যদি নাম মিলে যায়।
            query = query.eq('customer_name', name).or('customer_phone.is.null,customer_phone.eq.');
        }
        return await query;
    },

    async getSaleItemsBySaleIds(saleIds) {
        return await supabase.from('sale_items').select(`sale_id, quantity, price_per_unit, total_price, products ( name, unit )`).in('sale_id', saleIds);
    },

    async getCustomerPayments(customerId) {
        return await supabase.from('customer_payments').select('*').eq('customer_id', customerId);
    },

    async getMarketDueSummary() {
        return await supabase.from('customers').select('total_due');
    },

    async getCustomers(searchQuery, from, to) {
        let query = supabase.from('customers').select('*');
        if (searchQuery && searchQuery.trim() !== '') {
            query = query.or(`name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`);
        }
        return await query.order('created_at', { ascending: false }).range(from, to);
    },

    async getCustomerById(id) {
        return await supabase.from('customers').select('*').eq('id', id).single();
    },

    async addPayment(paymentData) {
        return await supabase.from('customer_payments').insert([paymentData]);
    },

    async updateCustomerDue(customerId, newDue) {
        return await supabase.from('customers').update({ total_due: newDue }).eq('id', customerId);
    },

    // 🎯 নিচের মেথডগুলো advance booking ফিচারের জন্য যোগ করা হয়েছে
    async getCustomerByPhone(phone) {
        return await supabase.from('customers').select('*').eq('phone', phone).maybeSingle();
    },

    async getCustomerByName(name) {
        return await supabase.from('customers').select('*').eq('name', name).maybeSingle();
    },

    async insertCustomer(data) {
        return await supabase.from('customers').insert([data]).select();
    },

    async insertBooking(data) {
        return await supabase.from('advance_bookings').insert([data]).select();
    },

    // productId দিলে সেই প্রোডাক্টের বুকিং, না দিলে কাস্টমারের সব open booking (product name সহ)
    async getOpenBookingsForCustomerProduct(customerId, productId = null) {
        let query = supabase
            .from('advance_bookings')
            .select('*, products(name, unit, product_group)')
            .eq('customer_id', customerId)
            .eq('status', 'open');
        if (productId) query = query.eq('product_id', productId);
        return await query.order('created_at', { ascending: true });
    }
};

module.exports = { CustomerRepository };