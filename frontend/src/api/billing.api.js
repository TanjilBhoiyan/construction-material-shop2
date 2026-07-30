const API_BASE = 'http://localhost:5000/api/billing';

export const BillingAPI = {
    async getLaborSettings() {
        const res = await fetch(`${API_BASE}/labor-settings`);
        if (!res.ok) throw new Error('লেবার রেট লোড করতে সমস্যা হয়েছে');
        return await res.json();
    },

    async searchCustomers(query) {
        const res = await fetch(`${API_BASE}/search-customers?q=${encodeURIComponent(query)}`);
        if (!res.ok) throw new Error('কাস্টমার খুঁজতে সমস্যা হয়েছে');
        return await res.json();
    },

    async checkout(checkoutData) {
        const res = await fetch(`${API_BASE}/checkout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(checkoutData)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'চেকআউট করতে সমস্যা হয়েছে');
        return data;
    }
};
