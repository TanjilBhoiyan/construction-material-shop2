const API_BASE = 'http://localhost:5000/api/customers';

export const CustomerAPI = {
    async getCustomers(searchQuery = '', page = 1) {
        const url = `${API_BASE}?search=${encodeURIComponent(searchQuery)}&page=${page}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('কাস্টমার লোড করতে সমস্যা হয়েছে');
        return await res.json();
    },

    async getLedger(customer) {
        const { id, name, phone } = customer;
        const url = `${API_BASE}/${id}/ledger?name=${encodeURIComponent(name || '')}&phone=${encodeURIComponent(phone || '')}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('খাতা লোড করতে সমস্যা হয়েছে');
        return await res.json();
    },

    async submitPayment(custId, payAmount) {
        const res = await fetch(`${API_BASE}/${custId}/payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payAmount })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'পেমেন্ট প্রসেস করতে সমস্যা হয়েছে');
        return data;
    },

    // 🎯 advance booking (আগে booking.api.js-এ ছিল, এখানে মার্জ করা হলো)
    // ব্যাকএন্ড এন্ডপয়েন্ট: POST /api/customers/bookings
    async createBooking(bookingData) {
        const res = await fetch(`${API_BASE}/bookings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bookingData)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'বুকিং সেভ করতে সমস্যা হয়েছে');
        return data;
    },
    async getOpenBookings(customerId, productId = null) {
    const url = productId
        ? `${API_BASE}/${customerId}/open-bookings?productId=${productId}`
        : `${API_BASE}/${customerId}/open-bookings`;
    const res = await fetch(url);
    if (!res.ok) return [];
    return await res.json();
}
};