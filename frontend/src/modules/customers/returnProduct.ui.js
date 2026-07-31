import { InventoryAPI } from '../../api/inventory.api.js';
import { BillingAPI } from '../../api/billing.api.js';
import { CustomerAPI } from '../../api/customer.api.js';
import { populateProductSelect } from '../../shared/utils/productDropdown.js';
import { calculateAutoLaborCostLogic } from '../../shared/utils/extraCost.js';
import { ToastUI } from '../../shared/utils/toast.js';

// 🎯 "মাল ফেরত" মডালের সব লজিক — quick-booking-modal এর মতো cart-style ডিজাইন +
// লেবার/পরিবহন খরচ। হিসাবটা booking/billing এর উল্টা — লেবার/পরিবহন খরচ "কাস্টমার
// বহন করবে" হলে সেটা ফেরতের টাকা থেকে বাদ যাবে (যোগ হবে না)।

let returnProducts = [];
let returnCart = [];
let laborSettings = [];

function getReturnCostFormElements() {
    return {
        laborInput: document.getElementById('return-labor-cost'),
        laborBearerSelect: document.getElementById('return-labor-bearer'),
        transportInput: document.getElementById('return-transport-cost'),
        transportBearerSelect: document.getElementById('return-transport-bearer'),
        subtotalEl: document.getElementById('return-subtotal'),
        totalEl: document.getElementById('return-total-value'),
    };
}

function renderReturnCart() {
    const tbody = document.getElementById('return-cart-tbody');
    if (!tbody) return;

    if (returnCart.length === 0) {
        tbody.innerHTML = `<tr id="return-cart-empty-row"><td colspan="5" class="text-center py-3 text-gray-400">এখনো কোনো প্রোডাক্ট যোগ করা হয়নি</td></tr>`;
    } else {
        tbody.innerHTML = '';
        returnCart.forEach((item, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="px-4 py-2 border-b font-semibold text-gray-800">${item.name}</td>
                <td class="px-4 py-2 border-b text-blue-600">${item.quantity} ${item.unit}</td>
                <td class="px-4 py-2 border-b">৳${item.rate}</td>
                <td class="px-4 py-2 border-b font-semibold text-gray-700">৳${item.totalPrice.toFixed(2)}</td>
                <td class="px-4 py-2 border-b text-center">
                    <button data-index="${index}" class="remove-return-item text-red-500 hover:text-red-700 font-bold">❌ বাদ দিন</button>
                </td>
            `;
            tbody.appendChild(row);
        });

        tbody.querySelectorAll('.remove-return-item').forEach(btn => {
            btn.addEventListener('click', () => {
                returnCart.splice(parseInt(btn.dataset.index), 1);
                renderReturnCart();
            });
        });
    }

    calculateAutoReturnLaborCost();
}

function calculateAutoReturnLaborCost() {
    const { laborInput } = getReturnCostFormElements();
    if (!laborInput) return;

    if (returnCart.length === 0) {
        laborInput.value = 0;
        updateReturnTotal();
        return;
    }

    const totalLaborCost = calculateAutoLaborCostLogic(returnCart, laborSettings);
    laborInput.value = totalLaborCost.toFixed(2);
    updateReturnTotal();
}

function updateReturnTotal() {
    const subtotal = returnCart.reduce((sum, item) => sum + item.totalPrice, 0);

    const { laborInput, laborBearerSelect, transportInput, transportBearerSelect, subtotalEl, totalEl } = getReturnCostFormElements();

    const laborCost = parseFloat(laborInput?.value) || 0;
    const laborBearer = laborBearerSelect?.value || 'customer';
    const transportCost = parseFloat(transportInput?.value) || 0;
    const transportBearer = transportBearerSelect?.value || 'customer';

    let finalTotal = subtotal;
    if (laborBearer === 'customer') finalTotal -= laborCost;
    if (transportBearer === 'customer') finalTotal -= transportCost;
    if (finalTotal < 0) finalTotal = 0; // 🎯 ফেরতের টাকা কখনো ঋণাত্মক দেখাবে না

    if (subtotalEl) subtotalEl.innerText = subtotal.toFixed(2);
    if (totalEl) totalEl.innerText = finalTotal.toFixed(2);
}

function handleAddToReturnCart() {
    const productSelect = document.getElementById('return-product-select');
    const qtyInput = document.getElementById('return-qty');
    const rateInput = document.getElementById('return-rate');

    const prodId = productSelect ? productSelect.value : null;
    const qty = parseFloat(qtyInput ? qtyInput.value : 0) || 0;
    const rate = parseFloat(rateInput ? rateInput.value : 0) || 0;

    if (!prodId || qty <= 0 || rate <= 0) {
        ToastUI.showToast("দয়া করে সঠিক প্রোডাক্ট, পরিমাণ ও রেট দিন।", true);
        return;
    }

    const product = returnProducts.find(p => p.id == prodId);
    if (!product) return;

    returnCart.push({
        productId: product.id,
        name: product.name,
        unit: product.unit,
        quantity: qty,
        rate: rate,
        totalPrice: qty * rate
    });

    renderReturnCart();

    if (qtyInput) qtyInput.value = '';
    if (rateInput) rateInput.value = '';
    if (productSelect) productSelect.value = '';
}

// 🎯 নতুন — সাবমিট বাটনের লজিক
async function handleReturnSubmit(customer, onSuccess) {
    const submitBtn = document.getElementById('return-submit-btn');

    if (returnCart.length === 0) {
        ToastUI.showToast("অন্তত একটা প্রোডাক্ট ফেরত কার্টে যোগ করুন।", true);
        return;
    }

    const { laborInput, laborBearerSelect, transportInput, transportBearerSelect } = getReturnCostFormElements();

    const returnData = {
        customerName: customer.name,
        customerPhone: customer.phone,
        items: returnCart.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            rate: item.rate
        })),
        laborCost: parseFloat(laborInput?.value) || 0,
        laborBearer: laborBearerSelect?.value || 'customer',
        transportCost: parseFloat(transportInput?.value) || 0,
        transportBearer: transportBearerSelect?.value || 'customer'
    };

    try {
        submitBtn.disabled = true;
        submitBtn.innerText = "⏳ সেভ হচ্ছে...";

        await CustomerAPI.submitReturn(customer.id, returnData);

        ToastUI.showToast("🎉 মাল ফেরত সফলভাবে সংরক্ষিত হয়েছে!");

        const modal = document.getElementById('return-modal');
        if (modal) modal.classList.add('hidden');

        if (typeof onSuccess === 'function') onSuccess(); // 🎯 caller (customer.ui.js) ledger রিফ্রেশ করবে
    } catch (err) {
        ToastUI.showToast("সমস্যা হয়েছে: " + err.message, true);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = "↩️ ফেরত নিশ্চিত করুন";
    }
}

export async function initReturnModal(customer, onSuccess) {
    returnCart = [];
    renderReturnCart();

    const label = document.getElementById('return-cust-name-label');
    if (label) label.innerText = customer.name || '';

    const select = document.getElementById('return-product-select');
    const rateInput = document.getElementById('return-rate');

    const { laborInput, laborBearerSelect, transportInput, transportBearerSelect } = getReturnCostFormElements();
    if (laborInput) laborInput.value = '0';
    if (laborBearerSelect) laborBearerSelect.value = 'customer';
    if (transportInput) transportInput.value = '0';
    if (transportBearerSelect) transportBearerSelect.value = 'customer';

    if (select) {
        try {
            returnProducts = await InventoryAPI.getProducts();
            populateProductSelect(select, returnProducts, prod =>
                `${prod.name} (বর্তমান স্টক: ${prod.current_stock} ${prod.unit || ''})`
            );

            select.onchange = (e) => {
                const selected = returnProducts.find(p => p.id == e.target.value);
                if (selected && rateInput) rateInput.value = selected.default_selling_price;
            };

            laborSettings = await BillingAPI.getLaborSettings();
        } catch (err) {
            console.error("Return product dropdown load failed:", err.message);
        }
    }

    const addBtn = document.getElementById('return-add-to-cart-btn');
    if (addBtn) {
        addBtn.onclick = (e) => {
            e.preventDefault();
            handleAddToReturnCart();
        };
    }

    if (transportInput) transportInput.oninput = updateReturnTotal;
    if (transportBearerSelect) transportBearerSelect.onchange = updateReturnTotal;
    if (laborInput) laborInput.oninput = updateReturnTotal;
    if (laborBearerSelect) laborBearerSelect.onchange = updateReturnTotal;

    const submitBtn = document.getElementById('return-submit-btn');
    if (submitBtn) {
        submitBtn.onclick = (e) => {
            e.preventDefault();
            handleReturnSubmit(customer, onSuccess);
        };
    }
}