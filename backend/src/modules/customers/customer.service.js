const { CustomerRepository } = require('./customer.repository');

const CustomerService = {
    formatBanglaDateTime(dateStr) {
        if (!dateStr) return '—';
        const date = new Date(dateStr);
        const months = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন", "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"];
        const day = date.getDate(), monthName = months[date.getMonth()], year = date.getFullYear();
        let hours = date.getHours();
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        return `${day} ${monthName} ${year}, ${hours.toString().padStart(2, '0')}:${minutes} ${ampm}`;
    },

    calculateLedgerSummary(transactions) {
        let runningDue = 0;
        let totalBought = 0;
        let totalPaid = 0;
        let totalReturned = 0;

        const processedData = transactions.map(row => {
            if (row.type === 'sale') {
                const saleDiscount = row.discount_amount || 0;
                const netDueForThisSale = (row.total_payable || 0) - (row.cash_paid || 0) - saleDiscount;

                runningDue += netDueForThisSale;
                totalBought += (row.total_payable || 0);

                if (row.cash_paid > 0) {
                    totalPaid += row.cash_paid;
                }
            } else if (row.type === 'return') {
                // 🎯 নতুন — রিটার্নের ফলে কাস্টমারের বাকি কমে যায় (total_credited এর সমান)
                runningDue -= (row.total_credited || 0);
                totalReturned += (row.total_credited || 0);
            } else {
                runningDue -= (row.cash_paid || 0);
                totalPaid += (row.cash_paid || 0);
            }

            row.current_due = runningDue;
            return row;
        });

        return { processedData, summary: { totalBought, totalPaid, totalReturned, runningDue } };
    },

    // 🎯 নতুন — আগে {id, name, phone} নিয়ে phone/name দিয়ে sale খুঁজতো, এখন শুধু customerId
    // দিয়ে সরাসরি sales.customer_id ম্যাচ করে খোঁজে। নাম/ফোন যতই আলাদা থাকুক, id দিয়েই সব বিল পাওয়া যাবে।
    async generateLedgerData(customerId) {
        const { data: salesData, error: salesErr } = await CustomerRepository.getSalesByCustomerId(customerId);
        if (salesErr) throw salesErr;
        const sales = salesData || [];

        let allSaleItems = [];
        if (sales.length > 0) {
            const saleIds = sales.map(s => s.id);
            const { data: itemsData, error: itemsErr } = await CustomerRepository.getSaleItemsBySaleIds(saleIds);
            if (!itemsErr && itemsData) allSaleItems = itemsData;
        }

        const { data: payData, error: payErr } = await CustomerRepository.getCustomerPayments(customerId);
        if (payErr) throw payErr;
        const payments = payData || [];

        // 🎯 নতুন — এই কাস্টমারের রিটার্ন হিস্ট্রি
        const { data: returnsData, error: returnsErr } = await CustomerRepository.getReturnsByCustomer(customerId);
        if (returnsErr) throw returnsErr;
        const returns = returnsData || [];

        let allReturnItems = [];
        if (returns.length > 0) {
            const returnIds = returns.map(r => r.id);
            const { data: retItemsData, error: retItemsErr } = await CustomerRepository.getReturnItemsByReturnIds(returnIds);
            if (!retItemsErr && retItemsData) allReturnItems = retItemsData;
        }

        let mergedData = [];

        sales.forEach(s => {
            const currentItems = allSaleItems.filter(item => item.sale_id === s.id);
            mergedData.push({
                id: s.id, date: new Date(s.created_at), type: 'sale',
                items: currentItems,
                labor_cost: parseFloat(s.labor_cost || 0), labor_bearer: s.labor_bearer,
                carrying_cost: parseFloat(s.carrying_cost || 0), carrying_bearer: s.carrying_bearer,
                males_dam: parseFloat(s.subtotal || 0), total_payable: parseFloat(s.total_payable || 0),
                cash_paid: parseFloat(s.cash_paid || 0),
                discount_amount: parseFloat(s.discount_amount || 0),
                raw_date: s.created_at,
                formattedDate: this.formatBanglaDateTime(s.created_at)
            });
        });

        payments.forEach(p => {
            mergedData.push({
                id: p.id, date: new Date(p.payment_date || p.created_at), type: 'payment',
                cash_paid: parseFloat(p.amount_paid || 0), raw_date: p.payment_date || p.created_at,
                formattedDate: this.formatBanglaDateTime(p.payment_date || p.created_at),
                note: p.note || null // 🎯 নতুন
            });
        });

        // 🎯 নতুন — রিটার্ন এন্ট্রি মার্জ করা
        returns.forEach(r => {
            const currentItems = allReturnItems.filter(item => item.return_id === r.id);
            mergedData.push({
                id: r.id, date: new Date(r.created_at), type: 'return',
                items: currentItems,
                labor_cost: parseFloat(r.labor_cost || 0), labor_bearer: r.labor_bearer,
                transport_cost: parseFloat(r.transport_cost || 0), transport_bearer: r.transport_bearer,
                subtotal: parseFloat(r.subtotal || 0),
                total_credited: parseFloat(r.total_credited || 0),
                raw_date: r.created_at,
                formattedDate: this.formatBanglaDateTime(r.created_at)
            });
        });

        mergedData.sort((a, b) => (a.date.getTime() !== b.date.getTime()) ? a.date - b.date : a.id - b.id);

        const { processedData, summary } = this.calculateLedgerSummary(mergedData);

        return { mergedData: processedData, summary };
    },

    // 🎯 currentDue এখন client থেকে নেওয়া হচ্ছে না — সবসময় DB থেকে ফ্রেশ পড়া হয়, নাহলে
    // পুরনো/stale ভ্যালু দিয়ে total_due ভুলভাবে ওভাররাইট হয়ে যেতে পারত।
    async processPayment(custId, payAmount) {
        if (payAmount <= 0) throw new Error("দয়া করে সঠিক জমার পরিমাণ লিখুন।");

        const { data: customer, error: custErr } = await CustomerRepository.getCustomerById(custId);
        if (custErr) throw custErr;
        if (!customer) throw new Error("কাস্টমার পাওয়া যায়নি।");

        const currentDue = parseFloat(customer.total_due) || 0;
        if (payAmount > currentDue) throw new Error(`বকেয়ার চেয়ে বেশি টাকা জমা নেওয়া যাবে না। বর্তমান বকেয়া: ৳${currentDue.toFixed(2)}`);

        const { error: paymentErr } = await CustomerRepository.addPayment({ customer_id: custId, amount_paid: payAmount });
        if (paymentErr) throw paymentErr;

        const updatedDue = currentDue - payAmount;
        const { error: custUpdateErr } = await CustomerRepository.updateCustomerDue(custId, updatedDue);
        if (custUpdateErr) throw custUpdateErr;

        return { updatedDue };
    },
    // 🎯 advance booking তৈরির লজিক — একাধিক প্রোডাক্ট (items array) সাপোর্ট করে
    // existingCustomerId দেওয়া থাকলে (কাস্টমার লেজার পেজ থেকে "quick booking") নাম/ফোন দিয়ে
    // খোঁজার ধাপ সম্পূর্ণ স্কিপ হবে — ডুপ্লিকেট কাস্টমার তৈরির ঝুঁকিই থাকে না।
    async createBooking(bookingData) {
        const { customerName, customerPhone, fatherName, customerAddress, items, advancePaid, existingCustomerId } = bookingData;

        if ((!existingCustomerId && !customerName) || !items || items.length === 0) {
            throw new Error("কাস্টমারের নাম আর অন্তত একটা প্রোডাক্ট দিন।");
        }
        for (const item of items) {
            if (!item.productId || item.quantity <= 0 || item.lockedPrice <= 0) {
                throw new Error("প্রতিটা প্রোডাক্টের পরিমাণ ও লক-দাম সঠিকভাবে দিন।");
            }
        }

        const totalAdvance = parseFloat(advancePaid) || 0;
        const advanceCredit = totalAdvance > 0 ? -totalAdvance : 0;

        let customerId;

        if (existingCustomerId) {
            const { data: existingCustomer, error: fetchErr } = await CustomerRepository.getCustomerById(existingCustomerId);
            if (fetchErr) throw fetchErr;
            if (!existingCustomer) throw new Error("কাস্টমার পাওয়া যায়নি।");

            customerId = existingCustomer.id;
            if (advanceCredit !== 0) {
                const newDue = (parseFloat(existingCustomer.total_due) || 0) + advanceCredit;
                const { error: updateErr } = await CustomerRepository.updateCustomerDue(customerId, newDue);
                if (updateErr) throw updateErr;
            }
        } else {
            let existingCustomer = null;
            if (customerPhone) {
                const { data, error } = await CustomerRepository.getCustomerByPhone(customerPhone);
                if (error) throw error;
                existingCustomer = data;
            } else {
                const { data, error } = await CustomerRepository.getCustomerByName(customerName);
                if (error) throw error;
                existingCustomer = data;
            }

            if (existingCustomer) {
                customerId = existingCustomer.id;
                if (advanceCredit !== 0) {
                    const newDue = (parseFloat(existingCustomer.total_due) || 0) + advanceCredit;
                    const { error: updateErr } = await CustomerRepository.updateCustomerDue(customerId, newDue);
                    if (updateErr) throw updateErr;
                }
            } else {
                const { data: newCustomer, error: insertErr } = await CustomerRepository.insertCustomer({
                    name: customerName,
                    phone: customerPhone || null,
                    father_name: fatherName || null,
                    customer_address: customerAddress || null,
                    total_due: advanceCredit
                });
                if (insertErr) throw insertErr;
                customerId = newCustomer[0].id;
            }
        }

        const noteText = items.map((i, idx) => `${idx + 1}. ${i.productName || 'প্রোডাক্ট'} ${i.quantity}${i.unit || ''}`).join('\n');

        if (totalAdvance > 0) {
            const { error: paymentErr } = await CustomerRepository.addPayment({
                customer_id: customerId,
                amount_paid: totalAdvance,
                note: `অগ্রিম বুকিং:\n${noteText}`
            });
            if (paymentErr) throw paymentErr;
        }

        const bookingIds = [];
        for (const item of items) {
            const { data: booking, error: bookingErr } = await CustomerRepository.insertBooking({
                customer_id: customerId,
                product_id: item.productId,
                locked_price: item.lockedPrice,
                booked_quantity: item.quantity,
                delivered_quantity: 0,
                status: 'open'
            });
            if (bookingErr) throw bookingErr;
            bookingIds.push(booking[0].id);
        }

        return { message: "বুকিং সফলভাবে সংরক্ষিত হয়েছে", bookingIds, customerId };
    },

    // 🎯 নতুন — "মাল ফেরত" প্রসেস করার লজিক। subtotal আর total_credited এখানে সার্ভার-সাইডে
    // আবার হিসাব করা হচ্ছে (frontend এর পাঠানো ভ্যালু সরাসরি বিশ্বাস না করে), কারণ এটা টাকার হিসাব।
    async processReturn(returnData) {
        const { customerId, customerName, customerPhone, items, laborCost, laborBearer, transportCost, transportBearer } = returnData;

        if (!customerId || !items || items.length === 0) {
            throw new Error("কাস্টমার এবং অন্তত একটা প্রোডাক্ট দিন।");
        }
        for (const item of items) {
            if (!item.productId || item.quantity <= 0 || item.rate <= 0) {
                throw new Error("প্রতিটা প্রোডাক্টের পরিমাণ ও রেট সঠিকভাবে দিন।");
            }
        }

        const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
        const finalLaborCost = parseFloat(laborCost) || 0;
        const finalTransportCost = parseFloat(transportCost) || 0;
        const finalLaborBearer = laborBearer || 'customer';
        const finalTransportBearer = transportBearer || 'customer';

        let totalCredited = subtotal;
        if (finalLaborBearer === 'customer') totalCredited -= finalLaborCost;
        if (finalTransportBearer === 'customer') totalCredited -= finalTransportCost;
        if (totalCredited < 0) totalCredited = 0;

        const cartForRPC = items.map(item => ({
            product_id: item.productId,
            quantity: item.quantity,
            rate: item.rate,
            total_price: item.quantity * item.rate
        }));

        const { data, error } = await CustomerRepository.returnRPC({
            p_cart: cartForRPC,
            p_customer_id: customerId,
            p_customer_name: customerName || null,
            p_customer_phone: customerPhone || null,
            p_labor_cost: finalLaborCost,
            p_labor_bearer: finalLaborBearer,
            p_transport_cost: finalTransportCost,
            p_transport_bearer: finalTransportBearer,
            p_subtotal: subtotal,
            p_total_credited: totalCredited
        });

        if (error) throw error;
        return data;
    }
};

module.exports = { CustomerService };