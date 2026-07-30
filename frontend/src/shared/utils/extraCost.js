import { BillingAPI } from '../../api/billing.api.js';

// 🎯 Extra cost (labor cost) সংক্রান্ত logic — billing.ui.js এবং booking.ui.js
// দুই জায়গা থেকেই ব্যবহার হয় বলে shared/utils-এ রাখা হলো।

let laborSettings = [];

// ---------- পিওর ক্যালকুলেশন লজিক — billing আর booking দুই জায়গা থেকেই কল হবে ----------

export function calculateAutoLaborCostLogic(cart, settings) {
    const rateMap = {};
    settings.forEach(s => {
        rateMap[s.category_key.trim().toLowerCase()] = parseFloat(s.rate_per_unit) || 0;
    });

    let totalLaborCost = 0;
    cart.forEach(item => {
        const qty = parseFloat(item.quantity) || 0;
        const rawUnit = (item.unit || '').trim().toLowerCase();
        let targetKey = 'others';

        if (rawUnit.includes('ব্যাগ') || rawUnit.includes('bag') || rawUnit.includes('bosta')) targetKey = 'bag';
        else if (rawUnit.includes('কেজি') || rawUnit.includes('kg')) targetKey = 'kg';
        else if (rawUnit.includes('বান্ডিল') || rawUnit.includes('bundle')) targetKey = 'bundle';
        else if (rawUnit.includes('পিস') || rawUnit.includes('pcs')) targetKey = 'pcs';

        if (rateMap[targetKey] !== undefined) totalLaborCost += qty * rateMap[targetKey];
        else totalLaborCost += qty * (rateMap['others'] || 0);
    });
    return totalLaborCost;
}

// ---------- নিচের দুইটা শুধু billing screen-এর জন্য (DOM id: summary-labor-cost) ----------
// booking.ui.js এগুলো ব্যবহার করে না — ওর নিজের laborSettings state আর DOM id
// (booking-labor-advance) আলাদা, ও শুধু উপরের calculateAutoLaborCostLogic() টাই ব্যবহার করবে।

export async function loadLaborSettings() {
    laborSettings = await BillingAPI.getLaborSettings();
}

export function calculateAutoLaborCost(cart) {
    const summaryLaborCost = document.getElementById('summary-labor-cost');
    if (!summaryLaborCost) return;

    if (cart.length === 0) {
        summaryLaborCost.value = 0;
        return;
    }

    const totalLaborCost = calculateAutoLaborCostLogic(cart, laborSettings);
    summaryLaborCost.value = totalLaborCost.toFixed(2);
}

// ---------- bearer অনুযায়ী extra cost যোগ করার লজিক — billing আর booking দুই জায়গা থেকেই কল হবে ----------
// laborBearer/transportBearer 'customer' হলে সেই খরচটা মোট টাকায় যোগ হবে, নাহলে না (shop/none হলে বাদ)
export function applyBearerCost(baseAmount, laborCost, laborBearer, transportCost, transportBearer) {
    let total = baseAmount;
    if (laborBearer === 'customer') total += laborCost;
    if (transportBearer === 'customer') total += transportCost;
    return total;
}