const API_BASE = 'http://localhost:5000/api/inventory';

export const InventoryAPI = {
    async getProducts() {
        const res = await fetch(API_BASE);
        if (!res.ok) throw new Error('প্রোডাক্ট লোড করতে সমস্যা হয়েছে');
        return await res.json();
    },

    async calculateUnloadingCost(stock, unit) {
        const res = await fetch(`${API_BASE}/calculate-cost`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stock, unit })
        });
        if (!res.ok) return 0;
        const data = await res.json();
        return data.cost;
    },

    async saveOrUpdateProduct(productData) {
        const res = await fetch(API_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(productData)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'সেভ করতে সমস্যা হয়েছে');
        return data;
    }
};
