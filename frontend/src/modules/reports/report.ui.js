import { ReportAPI } from '../../api/report.api.js';

function updateSummaryCards(summary) {
    const updateEl = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.innerText = val.toFixed(2);
    };
    updateEl('rep-total-sales', summary.totalSales);
    updateEl('rep-cash-received', summary.cashReceived);
    updateEl('rep-total-due', summary.totalDue);
    updateEl('rep-net-profit', summary.totalNetProfit);
    updateEl('rep-labor-cost', summary.totalLaborCost);
}

function renderSalesTable(sales) {
    const tbody = document.getElementById('report-sales-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    sales.forEach(sale => {
        const row = document.createElement('tr');
        row.className = "hover:bg-gray-50 text-sm text-gray-700";

        const saleDateTime = new Date(sale.created_at).toLocaleString('bn-BD', {
            year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true
        });

        const todaysTotalBill = sale.total_payable || 0;
        const previousDue = sale.previousDue || 0;
        const totalBillWithPrevious = todaysTotalBill + previousDue;
        const cashPaid = sale.cash_paid || 0;

        const totalDue = totalBillWithPrevious - cashPaid - sale.discount_amount;

        const dueColor = totalDue > 0 ? 'text-red-600 font-bold' : 'text-gray-500';

        row.innerHTML = `
            <td class="px-4 py-3 border-b text-gray-600">${saleDateTime}</td>
            <td class="px-4 py-3 border-b font-medium text-gray-900">
                <div class="font-semibold">${sale.customer_name || 'অনিবন্ধিত কাস্টমার'}</div>
            </td>
            <td class="px-4 py-3 border-b text-gray-600">${(sale.customer_phone && sale.customer_phone !== 'EMPTY') ? sale.customer_phone : '—'}</td>
            <td class="px-4 py-3 border-b text-gray-600">${(sale.customer_address && sale.customer_address !== 'EMPTY') ? sale.customer_address : '—'}</td>
            <td class="px-4 py-3 border-b font-semibold text-gray-900">৳${todaysTotalBill.toFixed(2)}</td>
            <td class="px-4 py-3 border-b font-semibold text-blue-700">৳${totalBillWithPrevious.toFixed(2)}</td>
            <td class="px-4 py-3 border-b text-green-600 font-semibold">৳${cashPaid.toFixed(2)}</td>
            <td class="px-4 py-3 border-b ${dueColor}">৳${totalDue.toFixed(2)}</td>
        `;
        tbody.appendChild(row);
    });
}

function renderLaborLedgerTable(laborLedger) {
    const laborTbody = document.querySelector('#labor-ledger-sub-screen tbody');
    if (!laborTbody) return;
    laborTbody.innerHTML = '';

    if (laborLedger.laborItems.length === 0) {
        laborTbody.innerHTML = `<tr><td colspan="4" class="px-4 py-3 text-center text-gray-500">আজকের কোনো লেবার খরচ নেই</td></tr>`;
        return;
    }

    laborLedger.laborItems.forEach(item => {
        const row = document.createElement('tr');
        row.className = "hover:bg-gray-50 text-sm text-gray-700";
        const colorClass = item.type === 'sale' ? 'text-blue-600' : 'text-purple-600';

        row.innerHTML = `
            <td class="px-4 py-3 border-b">${item.date}</td>
            <td class="px-4 py-3 border-b ${colorClass} font-medium">${item.description}</td>
            <td class="px-4 py-3 border-b">৳${item.cost.toFixed(2)}</td>
            <td class="px-4 py-3 border-b font-bold">৳${item.cost.toFixed(2)}</td>
        `;
        laborTbody.appendChild(row);
    });

    const totalRow = document.createElement('tr');
    totalRow.className = "bg-gray-100 font-bold";
    totalRow.innerHTML = `
        <td colspan="3" class="px-4 py-3 text-right">সর্বমোট লেবার খরচ:</td>
        <td class="px-4 py-3 text-red-600">৳${laborLedger.grandTotalLabor.toFixed(2)}</td>
    `;
    laborTbody.appendChild(totalRow);
}

async function loadReportsUI(targetDate = null) {
    try {
        const data = await ReportAPI.getReport(targetDate);
        renderSalesTable(data.sales);
        updateSummaryCards(data.summary);
        renderLaborLedgerTable(data.laborLedger);
    } catch (error) {
        console.error("Failed to update reports UI:", error);
    }
}

export function initReportModule() {
    const btnFilter = document.getElementById('btn-filter-report');
    const btnReset = document.getElementById('btn-reset-report');
    const dateInput = document.getElementById('report-single-date');

    if (btnFilter) {
        btnFilter.addEventListener('click', async (e) => {
            e.preventDefault();
            const selectedDate = dateInput ? dateInput.value : null;
            btnFilter.innerText = "⏳ হিসাব আসছে...";
            btnFilter.disabled = true;

            await loadReportsUI(selectedDate);

            btnFilter.innerHTML = "🔍 হিসাব দেখুন";
            btnFilter.disabled = false;
        });
    }

    if (btnReset) {
        btnReset.addEventListener('click', async (e) => {
            e.preventDefault();
            if (dateInput) dateInput.value = '';
            await loadReportsUI();
        });
    }

    document.addEventListener('click', (e) => {
        const laborCard = e.target.closest('#btn-open-labor-ledger');
        if (laborCard) {
            e.preventDefault();
            document.getElementById('report-main-table-container')?.classList.add('hidden');
            document.getElementById('labor-ledger-sub-screen')?.classList.remove('hidden');
        }

        const backBtn = e.target.closest('#btn-back-to-report');
        if (backBtn) {
            e.preventDefault();
            document.getElementById('labor-ledger-sub-screen')?.classList.add('hidden');
            document.getElementById('report-main-table-container')?.classList.remove('hidden');
        }
    });

    loadReportsUI();
}