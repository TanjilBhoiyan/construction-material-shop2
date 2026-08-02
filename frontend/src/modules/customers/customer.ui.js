import { CustomerAPI } from '../../api/customer.api.js';
import { InventoryAPI } from '../../api/inventory.api.js';
import { ToastUI } from '../../shared/utils/toast.js';
import { initQuickBookingModal } from './booking.ui.js';
import { initReturnModal } from './returnProduct.ui.js';

// 🎯 পেজিনেশন স্টেট এখানে (frontend-এ) — backend-এ গ্লোবাল ভ্যারিয়েবলে রাখলে
// একজনের পেজ-নাম্বার আরেকজনের রিকোয়েস্টে মিশে যেত।
let currentPage = 1;
let isSearching = false;
const ITEMS_PER_PAGE = 20;
window.cachedCustomers = [];

// ---------------------------------------------------------
// 🛠️ UI HELPER FUNCTIONS
// ---------------------------------------------------------
function updateSummaryCards(bought, paid, due) {
    const elBought = document.getElementById('ledger-total-bought');
    const elPaid = document.getElementById('ledger-total-paid');
    const elDue = document.getElementById('ledger-current-due');
    if (elBought) elBought.innerText = `৳${bought.toFixed(2)}`;
    if (elPaid) elPaid.innerText = `৳${paid.toFixed(2)}`;
    if (elDue) elDue.innerText = `৳${due.toFixed(2)}`;
}

function setupBackButton(detailsView, mainListArea) {
    const backBtn = document.getElementById('btn-back-to-customer-list');
    if (backBtn) {
        backBtn.onclick = (e) => {
            e.preventDefault();
            if (detailsView) detailsView.style.display = 'none';
            if (mainListArea) mainListArea.style.display = 'block';
        };
    }
}

function setupPaginationButtons(hasNextPage) {
    const prevBtn = document.getElementById('customer-prev-btn');
    const nextBtn = document.getElementById('customer-next-btn');
    if (prevBtn) prevBtn.disabled = isSearching ? true : currentPage === 1;
    if (nextBtn) nextBtn.disabled = isSearching ? true : !hasNextPage;
}

// ---------------------------------------------------------
// 👤 CUSTOMER LEDGER LOGIC
// ---------------------------------------------------------
async function openCustomerLedger(customer) {
    try {
        const { name, phone, father_name } = customer;
        const mainListArea = document.getElementById('customer-main-list-area');
        const detailsView = document.getElementById('customer-ledger-details-view');
        const tbody = document.getElementById('customer-ledger-tbody');

        if (mainListArea) mainListArea.style.display = 'none';
        if (detailsView) detailsView.style.display = 'block';

        document.getElementById('ledger-cust-name').innerText = name || 'অজানা কাস্টমার';
        document.getElementById('ledger-cust-father').innerText = father_name || '—';
        document.getElementById('ledger-cust-phone').innerText = phone || '—';
        tbody.innerHTML = `<tr><td colspan="9" class="text-center py-4">⏳ খাতা খোলা হচ্ছে, দয়া করে অপেক্ষা করুন...</td></tr>`;

        const { mergedData, summary } = await CustomerAPI.getLedger(customer.id);
        renderLedgerTable(mergedData, summary, tbody, detailsView, mainListArea);

        // 🎯 নতুন — "নতুন আইটেম বুকিং করুন" বাটন, এই কাস্টমারের জন্য (ডুপ্লিকেট-লিসেনার এড়াতে .onclick ব্যবহার)
        const quickBookingBtn = document.getElementById('btn-open-quick-booking');
        if (quickBookingBtn) {
            quickBookingBtn.onclick = () => {
                const modal = document.getElementById('quick-booking-modal');
                if (modal) modal.classList.remove('hidden');
                initQuickBookingModal(customer.id, name, () => openCustomerLedger(customer)); // সফল হলে ledger রিফ্রেশ
            };
        }

        const closeQuickBookingBtn = document.getElementById('btn-close-quick-booking');
        if (closeQuickBookingBtn) {
            closeQuickBookingBtn.onclick = () => {
                const modal = document.getElementById('quick-booking-modal');
                if (modal) modal.classList.add('hidden');
            };
        }

        // 🎯 নতুন — "মাল ফেরত নিন" বাটন
        const returnBtn = document.getElementById('btn-open-return-modal');
        if (returnBtn) {
            returnBtn.onclick = () => {
                const modal = document.getElementById('return-modal');
                if (modal) modal.classList.remove('hidden');
                initReturnModal(customer, () => openCustomerLedger(customer)); // সফল হলে ledger রিফ্রেশ
            };
        }

        const closeReturnBtn = document.getElementById('btn-close-return-modal');
        if (closeReturnBtn) {
            closeReturnBtn.onclick = () => {
                const modal = document.getElementById('return-modal');
                if (modal) modal.classList.add('hidden');
            };
        }

    } catch (err) {
        console.error("Ledger Load Error:", err.message);
        ToastUI.showToast("খাতা লোড করতে সমস্যা হয়েছে ভাই!", true);
    }
}

function renderLedgerTable(mergedData, summary, tbody, detailsView, mainListArea) {
    tbody.innerHTML = '';
    if (mergedData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="text-center py-4 text-muted">এই কাস্টমারের কোনো লেনদেনের ইতিহাস পাওয়া যায়নি।</td></tr>`;
        updateSummaryCards(0, 0, 0);
        setupBackButton(detailsView, mainListArea);
        return;
    }

    let html = '';
    mergedData.forEach(row => {
        let dueColor = row.current_due > 0 ? 'text-red-600' : 'text-gray-800';

        if (row.type === 'sale') {
            let rowSpan = (row.items && row.items.length > 0) ? row.items.length + 1 : 2;
            let laborText = row.labor_cost > 0 ? `৳${row.labor_cost}<br><span class="text-xs text-gray-500">(${row.labor_bearer})</span>` : '—';
            let transportText = row.carrying_cost > 0 ? `৳${row.carrying_cost}<br><span class="text-xs text-gray-500">(${row.carrying_bearer || 'none'})</span>` : '—';
            let cashPaidText = row.cash_paid > 0 ? `৳${row.cash_paid.toFixed(2)}` : '—';

            html += `
            <tr class="bg-blue-50/20 border-t-[3px] border-gray-400">
                <td class="border border-gray-300 px-2 py-3 align-top whitespace-nowrap text-xs text-gray-700 bg-gray-50" rowspan="${rowSpan}">${row.formattedDate}</td>
                <td class="border border-gray-300 px-4 py-2 font-bold text-left text-gray-800 bg-orange-50/50" colspan="4">মেমো #${row.id}</td>
                <td class="border border-gray-300 px-2 py-2 align-middle text-purple-700 font-medium bg-purple-50/30" rowspan="${rowSpan}">${laborText}</td>
                <td class="border border-gray-300 px-2 py-2 align-middle text-indigo-700 font-medium bg-indigo-50/30" rowspan="${rowSpan}">${transportText}</td>
                <td class="border border-gray-300 px-2 py-2 align-middle font-bold text-teal-700 bg-teal-50/30" rowspan="${rowSpan}">৳${row.total_payable.toFixed(2)}</td>
                <td class="border border-gray-300 px-2 py-2 align-middle text-green-700 font-bold bg-orange-50/50" rowspan="${rowSpan}">${cashPaidText}</td>
                <td class="border border-gray-300 px-2 py-2 align-middle font-bold bg-gray-100 ${dueColor}" rowspan="${rowSpan}">৳${row.current_due.toFixed(2)}</td>
            </tr>`;

            if (row.items && row.items.length > 0) {
                row.items.forEach((item, idx) => {
                    let prodName = item.products ? item.products.name : 'মাল';
                    let rate = item.price_per_unit || 0;
                    let qty = item.quantity || 0;
                    let unit = item.products ? item.products.unit : '';
                    let totalPrice = rate * qty;

                    html += `
                    <tr class="hover:bg-gray-50">
                        <td class="border border-gray-300 px-4 py-2 text-left text-sm text-gray-700">${idx + 1}. ${prodName}</td>
                        <td class="border border-gray-300 px-2 py-2 text-sm text-gray-700">${qty} ${unit}</td>
                        <td class="border border-gray-300 px-2 py-2 text-sm bg-yellow-50/40">৳${rate}</td>
                        <td class="border border-gray-300 px-2 py-2 text-sm bg-pink-50/40">৳${totalPrice}</td>
                    </tr>`;
                });
            } else {
                html += `<tr><td class="border border-gray-300 px-4 py-2 text-left text-sm text-gray-400 italic" colspan="4">কোনো মালের তালিকা নেই</td></tr>`;
            }
        } else if (row.type === 'return') {
            // 🎯 নতুন — "মাল ফেরত" এন্ট্রি, মেমোর মতোই দেখতে কিন্তু rose রঙে
            let rowSpan = (row.items && row.items.length > 0) ? row.items.length + 1 : 2;
            let laborText = row.labor_cost > 0 ? `৳${row.labor_cost}<br><span class="text-xs text-gray-500">(${row.labor_bearer})</span>` : '—';
            let transportText = row.transport_cost > 0 ? `৳${row.transport_cost}<br><span class="text-xs text-gray-500">(${row.transport_bearer})</span>` : '—';

            html += `
            <tr class="bg-rose-50/30 border-t-[3px] border-gray-400">
                <td class="border border-gray-300 px-2 py-3 align-top whitespace-nowrap text-xs text-gray-700 bg-gray-50" rowspan="${rowSpan}">${row.formattedDate}</td>
                <td class="border border-gray-300 px-4 py-2 font-bold text-left text-rose-700 bg-rose-100/50" colspan="4">↩️ মাল ফেরত #${row.id}</td>
                <td class="border border-gray-300 px-2 py-2 align-middle text-purple-700 font-medium bg-purple-50/30" rowspan="${rowSpan}">${laborText}</td>
                <td class="border border-gray-300 px-2 py-2 align-middle text-indigo-700 font-medium bg-indigo-50/30" rowspan="${rowSpan}">${transportText}</td>
                <td class="border border-gray-300 px-2 py-2 align-middle font-bold text-rose-700 bg-rose-50/50" rowspan="${rowSpan}">-৳${row.subtotal.toFixed(2)}</td>
                <td class="border border-gray-300 px-2 py-2 align-middle text-green-700 font-bold bg-green-50/50" rowspan="${rowSpan}">৳${row.total_credited.toFixed(2)}</td>
                <td class="border border-gray-300 px-2 py-2 align-middle font-bold bg-gray-100 ${dueColor}" rowspan="${rowSpan}">৳${row.current_due.toFixed(2)}</td>
            </tr>`;

            if (row.items && row.items.length > 0) {
                row.items.forEach((item, idx) => {
                    let prodName = item.products ? item.products.name : 'মাল';
                    let rate = item.rate || 0;
                    let qty = item.quantity || 0;
                    let unit = item.products ? item.products.unit : '';
                    let totalPrice = item.total_price || (rate * qty);

                    html += `
                    <tr class="hover:bg-gray-50">
                        <td class="border border-gray-300 px-4 py-2 text-left text-sm text-gray-700">${idx + 1}. ${prodName}</td>
                        <td class="border border-gray-300 px-2 py-2 text-sm text-gray-700">${qty} ${unit}</td>
                        <td class="border border-gray-300 px-2 py-2 text-sm bg-yellow-50/40">৳${rate}</td>
                        <td class="border border-gray-300 px-2 py-2 text-sm bg-pink-50/40">৳${totalPrice}</td>
                    </tr>`;
                });
            } else {
                html += `<tr><td class="border border-gray-300 px-4 py-2 text-left text-sm text-gray-400 italic" colspan="4">কোনো মালের তালিকা নেই</td></tr>`;
            }
        } else {
            const paymentLabel = row.note
                ? `💵 বকেয়া টাকা জমা<br><span class="text-xs font-normal text-gray-500">${row.note.replace(/\n/g, '<br>')}</span>`
                : `💵 বকেয়া টাকা জমা`;
            html += `
            <tr class="bg-green-50 border-t-[3px] border-gray-400">
                <td class="border border-gray-300 px-2 py-3 align-middle text-xs text-gray-700 bg-gray-50">${row.formattedDate}</td>
                <td class="border border-gray-300 px-4 py-3 font-bold text-left text-green-700" colspan="7">${paymentLabel}</td>
                <td class="border border-gray-300 px-2 py-3 align-middle text-green-700 font-bold text-base">৳${row.cash_paid.toFixed(2)}</td>
                <td class="border border-gray-300 px-2 py-3 align-middle font-bold bg-gray-100 ${dueColor}">৳${row.current_due.toFixed(2)}</td>
            </tr>`;
        }
    });

    tbody.innerHTML = html;
    updateSummaryCards(summary.totalBought, summary.totalPaid, summary.runningDue);
    setupBackButton(detailsView, mainListArea);
}

// ---------------------------------------------------------
// 💵 PAYMENT LOGIC
// ---------------------------------------------------------
function setupPaymentLogics() {
    window.triggerPaymentModal = (id) => {
        const cust = window.cachedCustomers?.find(c => c.id === id);
        if (cust) {
            const paymentModal = document.getElementById('payment-modal');
            document.getElementById('modal-cust-id').value = cust.id;
            document.getElementById('modal-cust-due').innerText = `৳${parseFloat(cust.total_due).toFixed(2)}`;
            document.getElementById('modal-pay-amount').value = '';

            const fStr = cust.father_name ? ` <span class="text-sm font-normal text-gray-600">(পিতা: ${cust.father_name})</span>` : '';
            const aStr = (cust.customer_address || cust.address) ? `<div class="text-xs text-gray-500 font-normal mt-1">🏠 ঠিকানা: ${cust.customer_address || cust.address}</div>` : '';
            document.getElementById('modal-cust-name').innerHTML = `<span class="font-bold text-base">${cust.name}</span>${fStr}${aStr}`;

            paymentModal.classList.remove('hidden');
        }
    };

    if (!window.customerListenersSet) {
        document.addEventListener('click', async (e) => {
            if (e.target?.id === 'close-modal-btn') document.getElementById('payment-modal')?.classList.add('hidden');
            if (e.target?.id === 'submit-payment-btn') {
                const submitBtn = e.target;
                const custId = document.getElementById('modal-cust-id').value;
                const payAmount = parseFloat(document.getElementById('modal-pay-amount').value) || 0;

                try {
                    submitBtn.disabled = true;
                    submitBtn.innerText = "⏳ প্রসেস হচ্ছে...";

                    await CustomerAPI.submitPayment(custId, payAmount);

                    ToastUI.showToast(`🎉 ৳${payAmount.toFixed(2)} সফলভাবে জমা নেওয়া হয়েছে!`);
                    document.getElementById('payment-modal')?.classList.add('hidden');
                    await fetchCustomers(document.getElementById('customer-search-input')?.value || '');
                } catch (err) {
                    ToastUI.showToast(err.message, true);
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = "জমা নিশ্চিত করুন";
                }
            }
        });
        window.customerListenersSet = true;
    }
}

// ---------------------------------------------------------
// 📦 CUSTOMER DATA FETCHING
// ---------------------------------------------------------
export async function fetchCustomers(searchQuery = '') {
    const customerTbody = document.getElementById('customer-tbody');
    const pageInfo = document.getElementById('customer-page-info');
    const marketDueEl = document.getElementById('total-market-due'); // 🎯 নতুন — আগেই ধরে রাখা হলো, যাতে পরে স্ক্রিন বদলে গেলেও ক্র্যাশ না করে
    if (!customerTbody) return;

    try {
        isSearching = searchQuery.trim() !== '';
        const { customers, totalMarketDue } = await CustomerAPI.getCustomers(searchQuery, currentPage);

        customerTbody.innerHTML = '';
        if (!customers || customers.length === 0) {
            customerTbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-gray-500">কোনো কাস্টমার পাওয়া যায়নি।</td></tr>`;
            if (marketDueEl) marketDueEl.innerText = totalMarketDue.toFixed(2);
            setupPaginationButtons(false);
            return;
        }

        window.cachedCustomers = customers;

        customers.forEach(cust => {
            const row = document.createElement('tr');
            row.style.cursor = 'pointer';
            row.innerHTML = `
                <td class="px-4 py-3 border-b font-medium text-gray-800">${cust.name}</td>
                <td class="px-4 py-3 border-b text-gray-600">${cust.father_name || '—'}</td>
                <td class="px-4 py-3 border-b text-gray-600">${cust.phone || 'N/A'}</td>
                <td class="px-4 py-3 border-b text-gray-600">${cust.customer_address || cust.address || '—'}</td>
                <td class="px-4 py-3 border-b ${cust.total_due > 0 ? 'text-red-600 font-bold' : 'text-gray-500'}">৳${cust.total_due.toFixed(2)}</td>
                <td class="px-4 py-3 border-b text-center">
                    <button class="btn-collect-payment bg-green-500 hover:bg-green-600 text-white text-xs px-3 py-1 rounded shadow-sm font-medium" onclick="triggerPaymentModal(${cust.id})">
                        💵 টাকা জমা নিন
                    </button>
                </td>
            `;
            row.addEventListener('click', (e) => {
                if (!e.target.closest('.btn-collect-payment')) openCustomerLedger(cust);
            });
            customerTbody.appendChild(row);
        });

        if (marketDueEl) marketDueEl.innerText = totalMarketDue.toFixed(2);
        pageInfo.innerText = isSearching ? `সার্চ রেজাল্ট: ${customers.length} জন` : `পেজ: ${currentPage}`;
        setupPaginationButtons(!isSearching && customers.length === ITEMS_PER_PAGE);

    } catch (err) {
        console.error("Customer loading failed:", err.message);
    }
}
// ---------------------------------------------------------
// 🚀 INITIALIZER
// ---------------------------------------------------------
export function initCustomerModule() {
    currentPage = 1;
    isSearching = false;

    setupPaymentLogics();
    const searchInput = document.getElementById('customer-search-input');
    if (searchInput) {
        let timer;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(timer);
            timer = setTimeout(() => { currentPage = 1; fetchCustomers(e.target.value); }, 150);
        });
    }

    const prevBtn = document.getElementById('customer-prev-btn');
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1 && !isSearching) {
                currentPage -= 1;
                fetchCustomers();
            }
        });
    }

    const nextBtn = document.getElementById('customer-next-btn');
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (!isSearching) {
                currentPage += 1;
                fetchCustomers();
            }
        });
    }

    fetchCustomers();
}