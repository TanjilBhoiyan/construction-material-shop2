import inventoryHtml from './ui-components/inventory.html?raw';
import billingHtml from './ui-components/billing.html?raw';
import reportsHtml from './ui-components/reports.html?raw';
import customersHtml from './ui-components/customers.html?raw';
import laborSettingsHtml from './ui-components/laborSettings.html?raw';
import advanceBookingHtml from './ui-components/advanceBooking.html?raw';
import { fetchProducts, initProductForm } from './modules/inventory/inventory.ui.js';
import { initBillingModule } from './modules/billing/billing.ui.js';
import { initReportModule } from './modules/reports/report.ui.js';
import { fetchCustomers, initCustomerModule } from './modules/customers/customer.ui.js';
import { initBookingModule } from './modules/customers/booking.ui.js';
import { initLaborSettingsModule } from './modules/settings/laborSettings.ui.js';

function resetTabStyles() {
    const inactiveClass = "hover:bg-blue-500 px-4 py-2 rounded font-semibold text-gray-200 transition";
    ['tab-inventory-btn', 'tab-billing-btn', 'tab-report-btn', 'tab-customer-btn', 'menu-settings'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.className = inactiveClass;
    });
}

function setActive(id) {
    const btn = document.getElementById(id);
    if (btn) btn.className = "bg-blue-700 px-4 py-2 rounded font-semibold text-white shadow";
}

function loadInventoryScreen() {
    const container = document.getElementById('app-container');
    if (!container) return;
    resetTabStyles();
    container.innerHTML = inventoryHtml;
    initProductForm();
    fetchProducts();
    setActive('tab-inventory-btn');
}

function loadBillingScreen() {
    const container = document.getElementById('app-container');
    if (!container) return;
    resetTabStyles();
    container.innerHTML = billingHtml;
    initBillingModule();
    setActive('tab-billing-btn');
}

function loadReportsScreen() {
    const container = document.getElementById('app-container');
    if (!container) return;
    resetTabStyles();
    container.innerHTML = reportsHtml;
    initReportModule();
    setActive('tab-report-btn');
}

function loadCustomersScreen() {
    const container = document.getElementById('app-container');
    if (!container) return;
    resetTabStyles();
    container.innerHTML = customersHtml;
    initCustomerModule();
    setActive('tab-customer-btn');
}

function loadSettingsScreen() {
    const container = document.getElementById('app-container');
    if (!container) return;
    resetTabStyles();
    container.innerHTML = laborSettingsHtml;
    initLaborSettingsModule();
    setActive('menu-settings');
}

// 🎯 বুকিং স্ক্রিন — কোনো ন্যাভ ট্যাব থেকে না, customers পেজের বাটন থেকে খোলে
function loadBookingScreen() {
    const container = document.getElementById('app-container');
    if (!container) return;
    container.innerHTML = advanceBookingHtml;
    initBookingModule();
}

document.addEventListener('DOMContentLoaded', () => {
    loadInventoryScreen();

    const tabInventoryBtn = document.getElementById('tab-inventory-btn');
    if (tabInventoryBtn) tabInventoryBtn.addEventListener('click', loadInventoryScreen);

    const tabBillingBtn = document.getElementById('tab-billing-btn');
    if (tabBillingBtn) tabBillingBtn.addEventListener('click', loadBillingScreen);

    const tabReportBtn = document.getElementById('tab-report-btn');
    if (tabReportBtn) tabReportBtn.addEventListener('click', loadReportsScreen);

    const tabCustomerBtn = document.getElementById('tab-customer-btn');
    if (tabCustomerBtn) tabCustomerBtn.addEventListener('click', loadCustomersScreen);

    const menuSettingsBtn = document.getElementById('menu-settings');
    if (menuSettingsBtn) menuSettingsBtn.addEventListener('click', loadSettingsScreen);

    // customers.html আর advanceBooking.html প্রতিবার নতুন করে DOM-এ বসে,
    // তাই এই ২টা বাটনের জন্য event delegation ব্যবহার করা হচ্ছে (ডুপ্লিকেট-লিসেনার বাগ এড়াতে)
    document.addEventListener('click', (e) => {
        if (e.target.closest('#btn-add-customer-booking')) {
            loadBookingScreen();
        }
        if (e.target.closest('#btn-back-to-customers-from-booking')) {
            loadCustomersScreen();
        }
    });

    console.log("🚀 সব মডিউল (Inventory, Billing, Reports, Customers, Settings, Bookings) লোড হয়েছে (web version)");
});