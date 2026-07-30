import { SettingsAPI } from '../../api/settings.api.js';
import { ToastUI } from '../../shared/utils/toast.js';

async function loadLaborSettings() {
    try {
        const container = document.getElementById('labor-rates-container');
        if (!container) return;

        const settings = await SettingsAPI.getLaborSettings();

        if (!settings || settings.length === 0) {
            container.innerHTML = `<div class="col-span-2 text-center py-4 text-amber-600 font-medium">⚠️ কোনো সেটিংস পাওয়া যায়নি!</div>`;
            return;
        }

        container.innerHTML = '';
        settings.forEach(s => {
            const card = document.createElement('div');
            card.className = "bg-gray-50 p-5 rounded-lg border border-gray-200 shadow-sm flex flex-col gap-4";

            card.innerHTML = `
                <div class="text-base font-bold text-gray-800 border-b pb-2">${s.category_name_bn || s.category_key}</div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-semibold text-gray-500 mb-1">🛒 লোডিং রেট:</label>
                        <input type="text" data-key="${s.category_key}" data-type="loading" value="${s.rate_per_unit || 0}" class="labor-loading-input w-full p-2 border rounded">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-blue-600 mb-1">🚛 আনলোডিং রেট:</label>
                        <input type="text" data-key="${s.category_key}" data-type="unloading" value="${s.unloading_rate_per_unit || 0}" class="labor-unloading-input w-full p-2 border rounded">
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    } catch (err) {
        console.error("সেটিংস লোড এরর:", err.message);
    }
}

function setupSettingsEvents() {
    const btnSave = document.getElementById('btn-save-labor-settings');
    if (!btnSave) return;

    btnSave.onclick = async function (e) {
        e.preventDefault();
        const loadingInputs = document.querySelectorAll('.labor-loading-input');
        const unloadingInputs = document.querySelectorAll('.labor-unloading-input');

        try {
            btnSave.innerText = "⏳ আপডেট হচ্ছে...";
            btnSave.disabled = true;

            const updateMap = {};
            loadingInputs.forEach(i => {
                const key = i.getAttribute('data-key');
                if (!updateMap[key]) updateMap[key] = {};
                updateMap[key].rate_per_unit = parseFloat(i.value) || 0;
            });
            unloadingInputs.forEach(i => {
                const key = i.getAttribute('data-key');
                if (!updateMap[key]) updateMap[key] = {};
                updateMap[key].unloading_rate_per_unit = parseFloat(i.value) || 0;
            });

            await SettingsAPI.saveLaborSettings(updateMap);
            ToastUI.showToast("🎉 সফলভাবে আপডেট হয়েছে!", false);
        } catch (err) {
            ToastUI.showToast("❌ সমস্যা হয়েছে: " + err.message, true);
        } finally {
            btnSave.innerText = "💾 রেট সেটিংস আপডেট করুন";
            btnSave.disabled = false;
        }
    };
}

export function initLaborSettingsModule() {
    loadLaborSettings();
    setupSettingsEvents();
}