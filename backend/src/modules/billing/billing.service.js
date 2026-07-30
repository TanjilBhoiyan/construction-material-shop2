const { BillingRepository } = require('./billing.repository');

const BillingService = {
    async getLaborSettingsList() {
        const { data, error } = await BillingRepository.getLaborSettings();
        if (error) throw error;
        return data || [];
    },

    // 🎯 এটাই সবচেয়ে গুরুত্বপূর্ণ ফাংশন — স্টক চেক, কাস্টমার লেজার আপডেট, sale + sale_items সেভ
    // সবসময় server-এ চলবে, client কখনো সরাসরি এই লজিক বাইপাস করতে পারবে না
    // 🎯 এটাই সবচেয়ে গুরুত্বপূর্ণ ফাংশন — এখন পুরো checkout একটা Postgres RPC ফাংশনে
    // (process_checkout) atomic transaction হিসেবে চলে। কোনো একটা ধাপ ফেল করলে
    // Postgres নিজেই সব বাতিল (rollback) করে দেয় — আংশিক ডাটা সেভ হওয়ার সুযোগ নেই।
    async processCheckoutBusinessLogic(checkoutData) {
        const { cart, customerName, customerPhone, fatherName, customerAddress, laborCost, laborBearer, transportCost, transportBearer, subtotal, totalPayable, cashPaid, due, previousDue, discount_amount } = checkoutData;

        if (!cart || cart.length === 0) {
            throw new Error("কার্ট খালি, চেকআউট করা যাবে না।");
        }

        const rpcParams = {
            p_cart: cart.map(item => ({
                product_id: item.product_id,
                quantity: parseFloat(item.quantity) || 0,
                price_per_unit: parseFloat(item.price_per_unit) || 0,
                total_price: parseFloat(item.total_price) || 0,
                booking_id: item.bookingId || null // 🎯 নতুন — locked-price লাইন হলে booking-এর delivered_quantity আপডেট হবে
            })),
            p_customer_name: customerName,
            p_customer_phone: customerPhone,
            p_father_name: fatherName,
            p_customer_address: customerAddress,
            p_labor_cost: laborCost,
            p_labor_bearer: laborBearer,
            p_transport_cost: transportCost,
            p_transport_bearer: transportBearer,
            p_subtotal: subtotal,
            p_total_payable: totalPayable,
            p_cash_paid: cashPaid,
            p_due: due,
            p_previous_due: previousDue,
            p_discount_amount: discount_amount || 0
        };

        const { data, error } = await BillingRepository.checkoutRPC(rpcParams);
        if (error) throw new Error(error.message);

        return data; // { message, saleId }
    }
};

module.exports = { BillingService };
