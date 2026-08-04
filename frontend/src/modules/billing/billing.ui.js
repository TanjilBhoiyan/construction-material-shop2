import { InventoryAPI } from '../../api/inventory.api.js';
import { BillingAPI } from '../../api/billing.api.js';
import { CustomerAPI } from '../../api/customer.api.js';
import { ToastUI } from '../../shared/utils/toast.js';
import { populateAddressDropdown } from '../../shared/utils/addressList.js';
import { loadLaborSettings, calculateAutoLaborCost, applyBearerCost } from '../../shared/utils/extraCost.js';
import { populateProductSelect } from '../../shared/utils/productDropdown.js';

// 🎯 কার্ট এখন frontend-এ থাকে (প্রতিটা ব্রাউজার ট্যাবের নিজস্ব state) — backend-এ গ্লোবাল ভ্যারিয়েবলে রাখলে
// সব ইউজারের কার্ট মিশে যেত। এটাই সঠিক জায়গা।
let cart = [];
let globalProducts = [];
let currentDiscountAmount = 0;
let customerOpenBookings = [];
// 🎯 নতুন — সাজেশন থেকে কাস্টমার সিলেক্ট করলে তার id এখানে "লক" হয়ে থাকে।
// checkout এর সময় এটা backend-এ পাঠানো হবে, যাতে নাম/ফোন দিয়ে না খুঁজে সরাসরি সঠিক
// কাস্টমারের সাথে বিল জোড়া লাগে (একাধিক ফোন নম্বর থাকলেও ভুল হওয়ার সুযোগ নাই)।
let selectedCustomerId = null;

// ---------- পিওর ক্যালকুলেশন লজিক (Electron সার্ভিস থেকে অপরিবর্তিত) ----------

function calculateSummary(cart, laborCost, laborBearer, transportCost, transportBearer, cashPaid) {
    const subtotal = cart.reduce((sum, item) => sum + item.total_price, 0);
    const totalPayable = applyBearerCost(subtotal, laborCost, laborBearer, transportCost, transportBearer);

    const due = totalPayable - cashPaid;
    return { subtotal, totalPayable, due };
}

// ---------- বিল সামারি ফর্মের DOM elements একসাথে নেওয়ার হেল্পার (repeat কমাতে) ----------
// calculateBillSummary(), handleCheckout(), initBillingModule() — তিনটা জায়গাতেই এই একই
// element গুলো আলাদা করে querySelect করা হতো, এখন একবারে এখান থেকে নেওয়া হয়।

function getSummaryFormElements() {
    return {
        summarySubtotal: document.getElementById('summary-subtotal'),
        summaryTotalPayable: document.getElementById('summary-total-payable'),
        summaryCashPaid: document.getElementById('summary-cash-paid'),
        summaryCalculatedDue: document.getElementById('summary-calculated-due'),
        prevDueElement: document.getElementById('summary-previous-due'),
        summaryLaborCost: document.getElementById('summary-labor-cost'),
        summaryLaborBearer: document.getElementById('summary-labor-bearer'),
        summaryTransportCost: document.getElementById('summary-transport-cost'),
        summaryTransportBearer: document.getElementById('summary-transport-bearer'),
        roundOffCheckbox: document.getElementById('chk-round-off'),
    };
}

// ---------- ড্রপডাউন / প্রোডাক্ট লোড ----------

export async function populateBillingDropdown() {
    try {
        const billProdSelect = document.getElementById('bill-prod-select');
        const billProdRate = document.getElementById('bill-prod-rate');
        const billProdQty = document.getElementById('bill-prod-qty');
        if (!billProdSelect) return;

        globalProducts = await InventoryAPI.getProducts();

        populateProductSelect(billProdSelect, globalProducts, prod =>
            `${prod.name} (স্টক: ${prod.current_stock} ${prod.unit || ''})`
        );

        if (billProdRate) billProdRate.value = '';
        if (billProdQty) billProdQty.value = '1';

        await loadLaborSettings();
    } catch (err) {
        console.error("Dropdown loading failed:", err.message);
    }
}


// 🎯 আপডেট — এখন এই প্রোডাক্টের সব open booking ফেরত দেয় (FIFO ক্রমে), একটা না —
// যাতে একাধিক booking থাকলে সবগুলো ক্রমানুসারে ব্যবহার করা যায়, শুধু প্রথমটা না।
// আরও — এখন product_group মিলিয়ে booking খোঁজে (যেমন 16mm-এ booking করে 10mm নিলেও মিলবে,
// দুইটাই "BSRM Rod" গ্রুপে থাকলে)। কোনো group সেট না থাকলে আগের মতোই exact product_id মিলিয়ে চলবে।
function getLockedBookingsInfo(productId) {
    const selectedProd = globalProducts.find(p => p.id == productId);
    const targetGroup = selectedProd ? selectedProd.product_group : null;

    const bookingsForProduct = customerOpenBookings.filter(b => {
        const bookingGroup = b.products ? b.products.product_group : null;
        if (targetGroup && bookingGroup) {
            return bookingGroup === targetGroup;
        }
        return b.product_id == productId;
    });
    if (bookingsForProduct.length === 0) return [];

    return bookingsForProduct.map(b => {
        const bookedRemaining = (parseFloat(b.booked_quantity) || 0) - (parseFloat(b.delivered_quantity) || 0);
        const alreadyInCart = cart
            .filter(item => item.bookingId === b.id)
            .reduce((sum, item) => sum + item.quantity, 0);
        return {
            bookingId: b.id,
            lockedPrice: parseFloat(b.locked_price) || 0,
            remaining: bookedRemaining - alreadyInCart
        };
    }).filter(b => b.remaining > 0);
}

function updateRateField(productId) {
    const billProdRate = document.getElementById('bill-prod-rate');

    // 🎯 নতুন: যদি প্রোডাক্ট সিলেক্ট করা না থাকে (যেমন ডিফল্ট অপশন), তাহলে রেট ফাঁকা থাকবে
    if (!productId || productId === '') {
        if (billProdRate) billProdRate.value = '';
        return;
    }

    const selectedProd = globalProducts.find(p => p.id == productId);
    if (!selectedProd || !billProdRate) return;

    const lockedBookings = getLockedBookingsInfo(productId);
    billProdRate.value = lockedBookings.length > 0 ? lockedBookings[0].lockedPrice : selectedProd.default_selling_price;
}

// ---------- বিল সামারি ----------

function calculateBillSummary() {
    const {
        summarySubtotal, summaryTotalPayable, summaryCashPaid, summaryCalculatedDue,
        prevDueElement, summaryLaborCost, summaryLaborBearer, summaryTransportCost,
        summaryTransportBearer, roundOffCheckbox
    } = getSummaryFormElements();

    if (!summarySubtotal) return;

    const laborCost = parseFloat(summaryLaborCost ? summaryLaborCost.value : 0) || 0;
    const laborBearer = summaryLaborBearer ? summaryLaborBearer.value : 'customer'; // 🎯 এখানে পরিবর্তন
    const transportCost = parseFloat(summaryTransportCost ? summaryTransportCost.value : 0) || 0;
    const transportBearer = summaryTransportBearer ? summaryTransportBearer.value : 'customer'; // 🎯 এখানে পরিবর্তন
    const cashPaid = parseFloat(summaryCashPaid ? summaryCashPaid.value : 0) || 0;
    const previousDue = parseFloat(prevDueElement ? prevDueElement.innerText : 0) || 0;

    let { subtotal, totalPayable, due } = calculateSummary(cart, laborCost, laborBearer, transportCost, transportBearer, cashPaid);

    totalPayable += previousDue;
    due = totalPayable - cashPaid;

    currentDiscountAmount = 0;

    if (roundOffCheckbox && roundOffCheckbox.checked && due > 0) {
        currentDiscountAmount = due;
        due = 0;
    }

    summarySubtotal.innerText = subtotal.toFixed(2);
    if (summaryTotalPayable) summaryTotalPayable.innerText = totalPayable.toFixed(2);
    if (summaryCalculatedDue) summaryCalculatedDue.innerText = due.toFixed(2);
}

// ---------- কার্ট ----------

function renderCart() {
    const cartTbody = document.getElementById('cart-tbody');
    if (!cartTbody) return;

    cartTbody.innerHTML = '';

    cart.forEach((item, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-4 py-2 border-b font-semibold text-gray-800">${item.name}</td>
            <td class="px-4 py-2 border-b text-blue-600">${item.quantity} ${item.unit}</td>
            <td class="px-4 py-2 border-b">৳${item.price_per_unit}</td>
            <td class="px-4 py-2 border-b font-semibold text-gray-700">৳${item.total_price.toFixed(2)}</td>
            <td class="px-4 py-2 border-b text-center">
                <button data-index="${index}" class="remove-cart-item text-red-500 hover:text-red-700 font-bold">❌ বাদ দিন</button>
            </td>
        `;
        cartTbody.appendChild(row);
    });

    cartTbody.querySelectorAll('.remove-cart-item').forEach(btn => {
        btn.addEventListener('click', () => {
            cart.splice(parseInt(btn.dataset.index), 1);
            renderCart();
        });
    });

    // 🎯 আগে এখানে calculateBillSummary() দুইবার কল হতো (একবার এখানে, একবার calculateAutoLaborCost()-এর ভেতরে) —
    // এখন calculateAutoLaborCost(cart) শুধু labor cost ফিল্ড আপডেট করে, calculateBillSummary() একবারই পরে কল হয়।
    calculateAutoLaborCost(cart);
    calculateBillSummary();
}

function addOrMergeCartLine(item, qty, rate, bookingId) {
    const existingIndex = cart.findIndex(c => c.product_id == item.id && c.price_per_unit == rate && c.bookingId === bookingId);
    if (existingIndex > -1) {
        cart[existingIndex].quantity += qty;
        cart[existingIndex].total_price = cart[existingIndex].quantity * cart[existingIndex].price_per_unit;
    } else {
        cart.push({
            product_id: item.id,
            name: item.name,
            unit: item.unit,
            quantity: qty,
            price_per_unit: rate,
            total_price: qty * rate,
            bookingId: bookingId || null
        });
    }
}

function handleAddToCart() {
    const billProdSelect = document.getElementById('bill-prod-select');
    const billProdQty = document.getElementById('bill-prod-qty');
    const billProdRate = document.getElementById('bill-prod-rate');

    const prodId = billProdSelect ? billProdSelect.value : null;
    const qty = parseFloat(billProdQty ? billProdQty.value : 0) || 0;
    const rate = parseFloat(billProdRate ? billProdRate.value : 0) || 0;

    if (!prodId || qty <= 0 || rate <= 0) {
        ToastUI.showToast("দয়া করে সঠিক প্রোডাক্ট, পরিমাণ এবং রেট দিন।", true);
        return;
    }

    const item = globalProducts.find(p => p.id == prodId);
    if (!item) return;

    // 🎯 আপডেট — এখন সব open booking ক্রমানুসারে (FIFO) খরচ হয়, একটার পরে আরেকটা, সব শেষ হলে তবেই বর্তমান দাম
    const lockedBookings = getLockedBookingsInfo(prodId);

    if (lockedBookings.length === 0) {
        // কোনো booking-ই নেই — দোকানদার রেট ফিল্ডে যা টাইপ করেছেন (ম্যানুয়াল এডিট হলেও) সেটাই ব্যবহার হবে
        addOrMergeCartLine(item, qty, rate, null);
    } else {
        let remainingQty = qty;
        const splitSummary = [];

        for (const booking of lockedBookings) {
            if (remainingQty <= 0) break;
            const qtyFromThisBooking = Math.min(remainingQty, booking.remaining);
            if (qtyFromThisBooking > 0) {
                addOrMergeCartLine(item, qtyFromThisBooking, booking.lockedPrice, booking.bookingId);
                splitSummary.push(`${qtyFromThisBooking} ${item.unit} @৳${booking.lockedPrice}`);
                remainingQty -= qtyFromThisBooking;
            }
        }

        if (remainingQty > 0) {
            addOrMergeCartLine(item, remainingQty, item.default_selling_price, null);
            splitSummary.push(`${remainingQty} ${item.unit} বর্তমান দামে (৳${item.default_selling_price})`);
        }

        if (splitSummary.length > 1) {
            ToastUI.showToast(`⚠️ স্প্লিট হয়েছে: ${splitSummary.join(' + ')}`);
        }
    }

    renderCart();
    if (billProdQty) billProdQty.value = '1';

    // 🎯 কার্টে মাল অ্যাড করার পর সিলেক্ট বক্স আগের মতো ফাঁকা করে দেওয়া (অপশনাল কিন্তু ইউজার ফ্রেন্ডলি)
    if (billProdSelect) billProdSelect.value = '';
    if (billProdRate) billProdRate.value = '';
}

// ---------- চেকআউট ----------

async function handleCheckout(checkoutBillBtn) {
    if (cart.length === 0) {
        ToastUI.showToast("কার্ট খালি! দয়া করে অন্তত একটি প্রোডাক্ট যোগ করুন।", true);
        return;
    }

    const customerName = document.getElementById('bill-cust-name')?.value.trim() || "অনিবন্ধিত কাস্টমার";
    const customerPhone = document.getElementById('bill-cust-phone')?.value.trim() || "";
    const fatherName = document.getElementById('customer-father')?.value.trim() || "";
    const customerAddress = document.getElementById('customer-address')?.value.trim() || "";

    if (customerPhone && !/^\d{11}$/.test(customerPhone)) {
        ToastUI.showToast("ফোন নম্বর অবশ্যই ১১ ডিজিটের সংখ্যা হতে হবে।", true);
        return;
    }

    const {
        summaryLaborCost, summaryLaborBearer, summaryTransportCost, summaryTransportBearer,
        summarySubtotal, summaryTotalPayable, summaryCashPaid, prevDueElement, roundOffCheckbox
    } = getSummaryFormElements();

    const laborCost = parseFloat(summaryLaborCost ? summaryLaborCost.value : 0) || 0;
    const laborBearer = summaryLaborBearer ? summaryLaborBearer.value : 'customer'; // 🎯 এখানে পরিবর্তন
    const transportCost = parseFloat(summaryTransportCost ? summaryTransportCost.value : 0) || 0;
    const transportBearer = summaryTransportBearer ? summaryTransportBearer.value : 'customer'; // 🎯 এখানে পরিবর্তন
    const subtotal = parseFloat(summarySubtotal ? summarySubtotal.innerText : 0) || 0;

    const uiTotalPayable = parseFloat(summaryTotalPayable ? summaryTotalPayable.innerText : 0) || 0;
    const cashPaid = parseFloat(summaryCashPaid ? summaryCashPaid.value : 0) || 0;
    const previousDue = parseFloat(prevDueElement ? prevDueElement.innerText : 0) || 0;

    const discountAmount = currentDiscountAmount || 0;

    const actualInvoiceTotal = uiTotalPayable - previousDue;
    const actualInvoiceDue = (actualInvoiceTotal - cashPaid) - discountAmount;

    if (checkoutBillBtn) {
        checkoutBillBtn.disabled = true;
        checkoutBillBtn.innerText = "⏳ প্রসেস হচ্ছে...";
        checkoutBillBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }

    try {
        await BillingAPI.checkout({
            cart, customerId: selectedCustomerId, customerName, customerPhone, fatherName, customerAddress,
            laborCost, laborBearer, transportCost, transportBearer,
            subtotal,
            totalPayable: actualInvoiceTotal,
            cashPaid,
            due: actualInvoiceDue,
            previousDue: previousDue,
            discount_amount: discountAmount
        });

        ToastUI.showToast("🎉 বিল এবং মালের তালিকা সফলভাবে সংরক্ষিত হয়েছে!");

        currentDiscountAmount = 0;
        cart = [];
        customerOpenBookings = [];
        selectedCustomerId = null; // 🎯 নতুন — পরের বিলের জন্য লক খুলে ফেলা
        renderCart();

        if (document.getElementById('bill-cust-name')) document.getElementById('bill-cust-name').value = '';
        if (document.getElementById('bill-cust-phone')) document.getElementById('bill-cust-phone').value = '';
        if (document.getElementById('customer-father')) document.getElementById('customer-father').value = '';
        if (document.getElementById('customer-address')) document.getElementById('customer-address').value = '';
        if (summaryLaborCost) summaryLaborCost.value = 0;
        if (summaryLaborBearer) summaryLaborBearer.value = 'customer'; // 🎯 রিসেট করার সময় পরিবর্তন
        if (summaryTransportCost) summaryTransportCost.value = 0;
        if (summaryTransportBearer) summaryTransportBearer.value = 'customer'; // 🎯 রিসেট করার সময় পরিবর্তন
        if (summaryCashPaid) summaryCashPaid.value = 0;

        if (roundOffCheckbox) roundOffCheckbox.checked = false;

        if (prevDueElement) prevDueElement.innerText = '0.00';
        const bookingNoticeBox = document.getElementById('booking-notice');
        if (bookingNoticeBox) { bookingNoticeBox.classList.add('hidden'); bookingNoticeBox.innerHTML = ''; }
        calculateBillSummary();
        populateBillingDropdown();

    } catch (err) {
        ToastUI.showToast("সমস্যা হয়েছে: " + err.message, true);
    } finally {
        if (checkoutBillBtn) {
            checkoutBillBtn.disabled = false;
            checkoutBillBtn.innerHTML = "💾 ইনভয়েস কনফার্ম করুন";
            checkoutBillBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }
}

// ---------- কাস্টমার সার্চ (অটোকমপ্লিট) ----------

let billingSearchTimeout;

// ---------- 🎯 নতুন — advance booking নোটিশ (সম্পূর্ণ আলাদা ফাংশন, existing কোড ছোঁয়া হয়নি) ----------

async function checkAndShowBookingNotice(customerId) {
    const noticeBox = document.getElementById('booking-notice');
    if (!noticeBox) return;

    if (!customerId) {
        noticeBox.classList.add('hidden');
        noticeBox.innerHTML = '';
        customerOpenBookings = []; // 🎯 নতুন
        return;
    }

    try {
        const bookings = await CustomerAPI.getOpenBookings(customerId);
        customerOpenBookings = bookings || []; // 🎯 নতুন

        if (!bookings || bookings.length === 0) {
            noticeBox.classList.add('hidden');
            noticeBox.innerHTML = '';
            return;
        }

        let html = `<div class="font-bold mb-1">🔒 এই কাস্টমারের অগ্রিম বুকিং আছে:</div><ul class="list-disc list-inside space-y-0.5">`;
        bookings.forEach(b => {
            const remaining = (parseFloat(b.booked_quantity) || 0) - (parseFloat(b.delivered_quantity) || 0);
            const productName = b.products ? b.products.name : `প্রোডাক্ট #${b.product_id}`;
            const unit = b.products ? b.products.unit : '';
            html += `<li>${productName}: <span class="font-semibold">${remaining} ${unit}</span> বাকি, লক-দাম ৳${b.locked_price}/${unit}</li>`;
        });
        html += `</ul>`;

        noticeBox.innerHTML = html;
        noticeBox.classList.remove('hidden');
    } catch (err) {
        console.error("Booking notice load failed:", err.message);
        noticeBox.classList.add('hidden');
    }
}

function initCustomerSearch() {
    if (window.billingListenersSet) return;
    window.billingListenersSet = true;

    document.addEventListener('input', (e) => {
        if (e.target && e.target.id === 'bill-cust-name') {
            const query = e.target.value.trim();
            const suggestionsBox = document.getElementById('customer-suggestions');
            if (!suggestionsBox) return;

            // 🎯 নতুন — নাম ফিল্ডে টাইপ করা মানেই আগের "লক করা" কাস্টমার আর ভরসাযোগ্য না
            // (হয়তো ভুল হয়ে গেছিল, বা অন্য কাস্টমার লেখা হচ্ছে) — তাই লক খুলে দেওয়া হলো।
            // সাজেশন থেকে ক্লিক করলে আবার নতুন করে লক হবে (নিচে suggestion-item ক্লিকে)।
            selectedCustomerId = null;

            if (query === '') {
                const phoneInput = document.getElementById('bill-cust-phone');
                if (phoneInput) phoneInput.value = '';
                const fatherInput = document.getElementById('customer-father');
                if (fatherInput) fatherInput.value = '';
                const addressSelect = document.getElementById('customer-address');
                if (addressSelect) addressSelect.value = '';
                const prevDueElement = document.getElementById('summary-previous-due');
                if (prevDueElement) prevDueElement.innerText = '0.00';

                suggestionsBox.innerHTML = '';
                suggestionsBox.classList.add('hidden');
                calculateBillSummary();
                checkAndShowBookingNotice(null); // 🎯 নতুন — নাম খালি হলে নোটিশও লুকিয়ে ফেলা
                return;
            }

            clearTimeout(billingSearchTimeout);

            if (query.length < 2) {
                suggestionsBox.innerHTML = '';
                suggestionsBox.classList.add('hidden');
                return;
            }

            billingSearchTimeout = setTimeout(() => {
                searchCustomerForBilling(query);
            }, 300);
        }
    });

    document.addEventListener('click', (e) => {
        const suggestionItem = e.target.closest('.suggestion-item');
        const suggestionsBox = document.getElementById('customer-suggestions');

        if (suggestionItem) {
            const cust = JSON.parse(suggestionItem.dataset.cust);

            // 🎯 নতুন — সাজেশন থেকে বেছে নেওয়া মানেই এই কাস্টমারের id নিশ্চিত হয়ে গেলো, লক করে দেওয়া হলো
            selectedCustomerId = cust.id;

            const nameInput = document.getElementById('bill-cust-name');
            if (nameInput) nameInput.value = cust.name || '';
            const phoneInput = document.getElementById('bill-cust-phone');
            if (phoneInput) phoneInput.value = cust.phone || '';
            const fatherInput = document.getElementById('customer-father');
            if (fatherInput) fatherInput.value = cust.father_name || '';

            const addressSelect = document.getElementById('customer-address');
            if (addressSelect) {
                const custAddress = cust.customer_address || cust.address || '';
                if (custAddress) {
                    let optionExists = false;
                    for (let i = 0; i < addressSelect.options.length; i++) {
                        if (addressSelect.options[i].value === custAddress) { optionExists = true; break; }
                    }
                    if (!optionExists) addressSelect.add(new Option(custAddress, custAddress));
                    addressSelect.value = custAddress;
                } else {
                    addressSelect.value = '';
                }
            }

            const prevDueElement = document.getElementById('summary-previous-due');
            if (prevDueElement) {
                const previousDue = parseFloat(cust.total_due) || 0;
                prevDueElement.innerText = previousDue.toFixed(2);
            }

            if (suggestionsBox) suggestionsBox.classList.add('hidden');
            calculateBillSummary();
            checkAndShowBookingNotice(cust.id); // 🎯 নতুন — এই কাস্টমারের booking আছে কিনা চেক করে নোটিশ দেখানো
        } else if (suggestionsBox && !e.target.closest('.relative')) {
            suggestionsBox.classList.add('hidden');
        }
    });
}

async function searchCustomerForBilling(query) {
    try {
        const suggestionsBox = document.getElementById('customer-suggestions');
        const customers = await BillingAPI.searchCustomers(query);

        if (!customers || customers.length === 0) {
            suggestionsBox.innerHTML = `<div class="p-3 text-sm text-gray-500 text-center font-medium">কোনো কাস্টমার পাওয়া যায়নি</div>`;
            suggestionsBox.classList.remove('hidden');
            return;
        }

        let html = '';
        customers.forEach(cust => {
            const custData = JSON.stringify(cust).replace(/'/g, "&#39;");
            const address = cust.customer_address || cust.address || '';
            html += `
            <div class="p-3 border-b hover:bg-blue-50 cursor-pointer suggestion-item transition duration-150"
                 data-cust='${custData}'>
                <div class="font-bold text-gray-800">${cust.name}</div>
                <div class="text-xs text-gray-500 mt-1">
                    📞 ${cust.phone || 'মোবাইল নেই'} ${address ? ' | 🏠 ' + address : ''}
                </div>
            </div>`;
        });

        suggestionsBox.innerHTML = html;
        suggestionsBox.classList.remove('hidden');
    } catch (error) {
        console.error("Search Error:", error);
    }
}

// ---------- init ----------

export function initBillingModule() {
    const billProdSelect = document.getElementById('bill-prod-select');
    const addToCartBtn = document.getElementById('add-to-cart-btn');
    const checkoutBillBtn = document.getElementById('checkout-bill-btn');

    const {
        summaryLaborCost, summaryLaborBearer, summaryTransportCost,
        summaryTransportBearer, summaryCashPaid, roundOffCheckbox
    } = getSummaryFormElements();

    cart = [];
    populateBillingDropdown();
    populateAddressDropdown('customer-address');
    initCustomerSearch();

        const billCustPhoneInput = document.getElementById('bill-cust-phone');
    if (billCustPhoneInput) {
        billCustPhoneInput.setAttribute('maxlength', '11');
        billCustPhoneInput.setAttribute('inputmode', 'numeric');
        billCustPhoneInput.addEventListener('input', () => {
            billCustPhoneInput.value = billCustPhoneInput.value.replace(/\D/g, '').slice(0, 11);
        });
    }

    if (billProdSelect) billProdSelect.onchange = (e) => updateRateField(e.target.value);

    if (addToCartBtn) {
        addToCartBtn.onclick = function (e) {
            e.preventDefault();
            handleAddToCart();
        };
    }

    if (summaryLaborCost) summaryLaborCost.oninput = calculateBillSummary;
    if (summaryLaborBearer) summaryLaborBearer.onchange = calculateBillSummary;
    if (summaryTransportCost) summaryTransportCost.oninput = calculateBillSummary;
    if (summaryTransportBearer) summaryTransportBearer.onchange = calculateBillSummary;
    if (summaryCashPaid) summaryCashPaid.oninput = calculateBillSummary;
    if (roundOffCheckbox) roundOffCheckbox.addEventListener('change', calculateBillSummary);

    if (checkoutBillBtn) {
        checkoutBillBtn.onclick = function (e) {
            e.preventDefault();
            handleCheckout(checkoutBillBtn);
        };
    }
}