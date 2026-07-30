import { InventoryAPI } from '../../api/inventory.api.js';
import { CustomerAPI } from '../../api/customer.api.js';
import { BillingAPI } from '../../api/billing.api.js';
import { ToastUI } from '../../shared/utils/toast.js';
import { populateAddressDropdown } from '../../shared/utils/addressList.js';

import { calculateAutoLaborCostLogic, applyBearerCost } from '../../shared/utils/extraCost.js';
import { populateProductSelect } from '../../shared/utils/productDropdown.js';

let bookingProducts = [];
let bookingCart = [];
let laborSettings = [];

// ---------- extra-cost ফর্মের DOM elements একসাথে নেওয়ার হেল্পার (repeat কমাতে) ----------
// updateTotals(), resetBookingForm(), initBookingModule(), initQuickBookingModal(),
// calculateAutoLaborAdvance() — সবগুলো জায়গাতেই এই একই element গুলো আলাদা করে
// querySelect করা হতো, এখন একবারে এখান থেকে নেওয়া হয়। event listener attach করার
// পদ্ধতি (addEventListener বনাম .onclick=) অপরিবর্তিত রাখা হয়েছে — শুধু element lookup
// একজায়গায় আনা হয়েছে।

function getBookingCostFormElements() {
    return {
        laborInput: document.getElementById('booking-labor-advance'),
        laborBearerSelect: document.getElementById('booking-labor-bearer'),
        transportInput: document.getElementById('booking-transport-cost'),
        transportBearerSelect: document.getElementById('booking-transport-bearer'),
        advanceInput: document.getElementById('booking-advance-paid'),
        totalEl: document.getElementById('booking-total-value'),
        grandTotalEl: document.getElementById('booking-grand-total-advance'),
    };
}

async function populateBookingProductDropdown() {
    const select = document.getElementById('booking-product-select');
    const priceInput = document.getElementById('booking-locked-price');
    const qtyInput = document.getElementById('booking-qty');
    if (!select) return;

    try {
        bookingProducts = await InventoryAPI.getProducts();

        populateProductSelect(select, bookingProducts, prod =>
            `${prod.name} (বর্তমান স্টক: ${prod.current_stock} ${prod.unit || ''})`
        );

        if (priceInput) priceInput.value = '';
        if (qtyInput) qtyInput.value = '1';

        laborSettings = await BillingAPI.getLaborSettings();
    } catch (err) {
        console.error("Product dropdown load failed:", err.message);
    }
}

function updateLockedPriceField(productId) {
    const priceInput = document.getElementById('booking-locked-price');
    
    // 🎯 নতুন: যদি কোনো প্রোডাক্ট সিলেক্ট করা না থাকে (ডিফল্ট অপশন), তবে রেট ফাঁকা থাকবে
    if (!productId || productId === '') {
        if (priceInput) priceInput.value = '';
        return;
    }

    const selected = bookingProducts.find(p => p.id == productId);
    if (selected && priceInput) priceInput.value = selected.default_selling_price;
}

// ---------- কার্ট ----------

function renderBookingCart() {
    const tbody = document.getElementById('booking-cart-tbody');
    if (!tbody) return;

    if (bookingCart.length === 0) {
        tbody.innerHTML = `<tr id="booking-cart-empty-row"><td colspan="5" class="text-center py-3 text-gray-400">এখনো কোনো প্রোডাক্ট যোগ করা হয়নি</td></tr>`;
    } else {
        tbody.innerHTML = '';
        bookingCart.forEach((item, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="px-4 py-2 border-b font-semibold text-gray-800">${item.name}</td>
                <td class="px-4 py-2 border-b text-blue-600">${item.quantity} ${item.unit}</td>
                <td class="px-4 py-2 border-b">৳${item.lockedPrice}</td>
                <td class="px-4 py-2 border-b font-semibold text-gray-700">৳${item.totalPrice.toFixed(2)}</td>
                <td class="px-4 py-2 border-b text-center">
                    <button data-index="${index}" class="remove-booking-item text-red-500 hover:text-red-700 font-bold">❌ বাদ দিন</button>
                </td>
            `;
            tbody.appendChild(row);
        });

        tbody.querySelectorAll('.remove-booking-item').forEach(btn => {
            btn.addEventListener('click', () => {
                bookingCart.splice(parseInt(btn.dataset.index), 1);
                renderBookingCart();
            });
        });
    }

    updateTotals();
    calculateAutoLaborAdvance();
}

function calculateAutoLaborAdvance() {
    const { laborInput } = getBookingCostFormElements();
    if (!laborInput) return;

    if (bookingCart.length === 0) {
        laborInput.value = 0;
        updateTotals();
        return;
    }

    const totalLaborCost = calculateAutoLaborCostLogic(bookingCart, laborSettings);
    laborInput.value = totalLaborCost.toFixed(2);
    updateTotals();
}

function handleAddToBookingCart() {
    const productSelect = document.getElementById('booking-product-select');
    const qtyInput = document.getElementById('booking-qty');
    const priceInput = document.getElementById('booking-locked-price');

    const prodId = productSelect ? productSelect.value : null;
    const qty = parseFloat(qtyInput ? qtyInput.value : 0) || 0;
    const lockedPrice = parseFloat(priceInput ? priceInput.value : 0) || 0;

    if (!prodId || qty <= 0 || lockedPrice <= 0) {
        ToastUI.showToast("দয়া করে সঠিক প্রোডাক্ট, পরিমাণ ও লক-দাম দিন।", true);
        return;
    }

    const product = bookingProducts.find(p => p.id == prodId);
    if (!product) return;

    bookingCart.push({
        productId: product.id,
        name: product.name,
        unit: product.unit,
        quantity: qty,
        lockedPrice: lockedPrice,
        totalPrice: qty * lockedPrice
    });

    renderBookingCart();
    if (qtyInput) qtyInput.value = '1';

    // 🎯 কার্টে অ্যাড করার পর ড্রপডাউন ও রেট রিসেট করে দেওয়া
    if (productSelect) productSelect.value = '';
    if (priceInput) priceInput.value = '';
}

// ---------- টোটাল ক্যালকুলেশন ----------

function updateTotals() {
    const productTotal = bookingCart.reduce((sum, item) => sum + item.totalPrice, 0);

    const {
        laborInput, laborBearerSelect, transportInput, transportBearerSelect,
        advanceInput, totalEl, grandTotalEl
    } = getBookingCostFormElements();

    const laborCost = parseFloat(laborInput?.value) || 0;
    const laborBearer = laborBearerSelect?.value || 'customer';
    const transportCost = parseFloat(transportInput?.value) || 0;
    const transportBearer = transportBearerSelect?.value || 'customer';

    const totalBookingValue = applyBearerCost(productTotal, laborCost, laborBearer, transportCost, transportBearer);

    if (totalEl) totalEl.innerText = totalBookingValue.toFixed(2);

    const advancePaid = parseFloat(advanceInput?.value) || 0;
    if (grandTotalEl) grandTotalEl.innerText = advancePaid.toFixed(2);
}

// ---------- ফর্ম রিসেট ----------

function resetBookingForm() {
    bookingCart = [];
    renderBookingCart();

    const ids = ['booking-cust-name', 'booking-cust-phone', 'booking-cust-father', 'booking-cust-address', 'booking-qty', 'booking-locked-price'];
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

    const productSelect = document.getElementById('booking-product-select');
    if (productSelect) productSelect.value = ''; 

    const { laborInput, laborBearerSelect, transportInput, transportBearerSelect, advanceInput } = getBookingCostFormElements();
    if (advanceInput) advanceInput.value = '0';
    if (laborInput) laborInput.value = '0';
    if (laborBearerSelect) laborBearerSelect.value = 'customer'; // 🎯 'none' এর বদলে 'customer'
    if (transportInput) transportInput.value = '0';
    if (transportBearerSelect) transportBearerSelect.value = 'customer'; // 🎯 'none' এর বদলে 'customer'

    updateTotals();
}

// ---------- সাবমিট ----------

async function handleBookingSubmit() {
    const submitBtn = document.getElementById('booking-submit-btn');

    if (bookingCart.length === 0) {
        ToastUI.showToast("অন্তত একটা প্রোডাক্ট বুকিং কার্টে যোগ করুন।", true);
        return;
    }

    const customerName = document.getElementById('booking-cust-name')?.value.trim() || '';
    if (!customerName) {
        ToastUI.showToast("কাস্টমারের নাম দিন।", true);
        return;
    }

    const bookingData = {
        customerName,
        customerPhone: document.getElementById('booking-cust-phone')?.value.trim() || '',
        fatherName: document.getElementById('booking-cust-father')?.value.trim() || '',
        customerAddress: document.getElementById('booking-cust-address')?.value.trim() || '',
        items: bookingCart.map(item => ({
            productId: item.productId,
            productName: item.name,
            unit: item.unit,
            quantity: item.quantity,
            lockedPrice: item.lockedPrice
        })),
        advancePaid: parseFloat(document.getElementById('booking-advance-paid')?.value) || 0
    };

    try {
        submitBtn.disabled = true;
        submitBtn.innerText = "⏳ সেভ হচ্ছে...";

        await CustomerAPI.createBooking(bookingData);

        ToastUI.showToast(`🎉 "${customerName}"-এর বুকিং সফলভাবে সংরক্ষিত হয়েছে!`);
        resetBookingForm();
    } catch (err) {
        ToastUI.showToast("সমস্যা হয়েছে: " + err.message, true);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = "🔒 বুকিং কনফার্ম করুন";
    }
}

// ---------- init ----------

export function initBookingModule() {
    bookingCart = [];
    populateBookingProductDropdown();
    populateAddressDropdown('booking-cust-address');
    renderBookingCart();

    const productSelect = document.getElementById('booking-product-select');
    if (productSelect) {
        productSelect.addEventListener('change', (e) => updateLockedPriceField(e.target.value));
    }

    const addBtn = document.getElementById('booking-add-to-cart-btn');
    if (addBtn) {
        addBtn.addEventListener('click', (e) => {
            e.preventDefault();
            handleAddToBookingCart();
        });
    }

    const { laborInput, laborBearerSelect, transportInput, transportBearerSelect, advanceInput } = getBookingCostFormElements();

    if (advanceInput) advanceInput.addEventListener('input', updateTotals);
    if (laborInput) laborInput.addEventListener('input', updateTotals);
    if (laborBearerSelect) laborBearerSelect.addEventListener('change', updateTotals);
    if (transportInput) transportInput.addEventListener('input', updateTotals);
    if (transportBearerSelect) transportBearerSelect.addEventListener('change', updateTotals);

    const submitBtn = document.getElementById('booking-submit-btn');
    if (submitBtn) {
        submitBtn.addEventListener('click', (e) => {
            e.preventDefault();
            handleBookingSubmit();
        });
    }
}

// ---------- 🎯 নতুন — existing কাস্টমারের জন্য "quick booking" মডাল (customers.html-এ) ----------
// কোনো নাম/ফোন/ঠিকানা ফিল্ড নেই — customerId আগে থেকেই জানা, তাই সরাসরি সেটাই পাঠানো হয়

async function handleQuickBookingSubmit(existingCustomerId, onSuccess) {
    const submitBtn = document.getElementById('booking-submit-btn');

    if (bookingCart.length === 0) {
        ToastUI.showToast("অন্তত একটা প্রোডাক্ট বুকিং কার্টে যোগ করুন।", true);
        return;
    }

    const bookingData = {
        existingCustomerId, // 🎯 নাম/ফোন দিয়ে খোঁজার দরকার নেই, backend সরাসরি এই আইডি ব্যবহার করবে
        items: bookingCart.map(item => ({
            productId: item.productId,
            productName: item.name,
            unit: item.unit,
            quantity: item.quantity,
            lockedPrice: item.lockedPrice
        })),
        advancePaid: parseFloat(document.getElementById('booking-advance-paid')?.value) || 0
    };

    try {
        submitBtn.disabled = true;
        submitBtn.innerText = "⏳ সেভ হচ্ছে...";

        await CustomerAPI.createBooking(bookingData);

        ToastUI.showToast("🎉 নতুন বুকিং সফলভাবে সংরক্ষিত হয়েছে!");
        resetBookingForm();

        const modal = document.getElementById('quick-booking-modal');
        if (modal) modal.classList.add('hidden');

        if (typeof onSuccess === 'function') onSuccess(); // 🎯 caller (customer.ui.js) ledger রিফ্রেশ করবে
    } catch (err) {
        ToastUI.showToast("সমস্যা হয়েছে: " + err.message, true);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = "🔒 বুকিং কনফার্ম করুন";
    }
}

export function initQuickBookingModal(existingCustomerId, customerName, onSuccess) {
    bookingCart = [];
    populateBookingProductDropdown();
    renderBookingCart();

    const label = document.getElementById('quick-booking-cust-name-label');
    if (label) label.innerText = customerName || '';

    const productSelect = document.getElementById('booking-product-select');
    if (productSelect) {
        productSelect.onchange = (e) => updateLockedPriceField(e.target.value);
    }

    const addBtn = document.getElementById('booking-add-to-cart-btn');
    if (addBtn) {
        addBtn.onclick = (e) => {
            e.preventDefault();
            handleAddToBookingCart();
        };
    }

    const { laborInput, laborBearerSelect, transportInput, transportBearerSelect, advanceInput } = getBookingCostFormElements();

    if (advanceInput) advanceInput.oninput = updateTotals;
    if (laborInput) laborInput.oninput = updateTotals;
    if (laborBearerSelect) laborBearerSelect.onchange = updateTotals;
    if (transportInput) transportInput.oninput = updateTotals;
    if (transportBearerSelect) transportBearerSelect.onchange = updateTotals;

    const submitBtn = document.getElementById('booking-submit-btn');
    if (submitBtn) {
        submitBtn.onclick = (e) => {
            e.preventDefault();
            handleQuickBookingSubmit(existingCustomerId, onSuccess);
        };
    }
}