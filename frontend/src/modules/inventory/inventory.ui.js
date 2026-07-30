import { InventoryAPI } from '../../api/inventory.api.js';

window.cachedProducts = [];

export async function fetchProducts() {
    const productTbody = document.getElementById('product-tbody') || document.querySelector('tbody');
    const productSelect = document.getElementById('product-select');

    try {
        const products = await InventoryAPI.getProducts();
        window.cachedProducts = products;

        if (productTbody) {
            productTbody.innerHTML = '';
            if (window.cachedProducts.length === 0) {
                productTbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-gray-500">কোনো প্রোডাক্ট পাওয়া যায়নি।</td></tr>`;
            } else {
                window.cachedProducts.forEach(prod => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td class="px-4 py-2 border-b text-gray-800">${prod.name}</td>
                        <td class="px-4 py-2 border-b text-blue-600 font-semibold">${prod.current_stock} ${prod.unit}</td>
                        <td class="px-4 py-2 border-b text-gray-600">৳${prod.buying_price.toFixed(2)}</td>
                        <td class="px-4 py-2 border-b text-green-600 font-medium">৳${prod.default_selling_price.toFixed(2)}</td>
                    `;
                    productTbody.appendChild(row);
                });
            }
        }

        if (productSelect) {
            productSelect.innerHTML = '<option value="">-- নতুন প্রোডাক্ট (নিচে নাম লিখুন) --</option>';
            window.cachedProducts.forEach(prod => {
                const option = document.createElement('option');
                option.value = prod.id;
                option.text = `${prod.name} (স্টক: ${prod.current_stock} ${prod.unit})`;
                productSelect.appendChild(option);
            });
        }

        // 🎯 আগে থেকে ব্যবহৃত product_group-গুলো datalist-এ দেখানো (টাইপো এড়াতে, রিইউজ সহজ করতে)
        const groupList = document.getElementById('product-group-suggestions');
        if (groupList) {
            const uniqueGroups = [...new Set(window.cachedProducts.map(p => p.product_group).filter(g => g))];
            groupList.innerHTML = '';
            uniqueGroups.forEach(group => {
                const option = document.createElement('option');
                option.value = group;
                groupList.appendChild(option);
            });
        }
    } catch (err) {
        console.error("Product loading failed:", err.message);
    }
}

async function calculateLiveUnloadingCost(prodStockInput, prodUnitInput, unloadingCostInput) {
    if (!prodStockInput || !prodUnitInput || !unloadingCostInput) return;
    const stock = parseFloat(prodStockInput.value) || 0;
    const unit = prodUnitInput.value || '';
    const cost = await InventoryAPI.calculateUnloadingCost(stock, unit);
    unloadingCostInput.value = cost;
}

async function handleProductSubmit(e, productForm, inputs) {
    e.preventDefault();
    const { productSelect, prodNameInput, prodUnitInput, prodStockInput, prodBuyingInput, prodSellingInput, prodGroupInput } = inputs;
    const unloadingCostInput = document.getElementById('prod-unloading-cost');
    const submitBtn = productForm.querySelector('button[type="submit"]');

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = "⏳ ডাটা সেভ হচ্ছে...";
        submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }

    const productData = {
        selectedId: productSelect ? productSelect.value : "",
        name: prodNameInput ? prodNameInput.value.trim() : "",
        unit: prodUnitInput ? prodUnitInput.value.trim() : "",
        newStock: parseFloat(prodStockInput ? prodStockInput.value : 0) || 0,
        buyingPrice: parseFloat(prodBuyingInput ? prodBuyingInput.value : 0) || 0,
        sellingPrice: parseFloat(prodSellingInput ? prodSellingInput.value : 0) || 0,
        unloadingLaborCost: parseFloat(unloadingCostInput ? unloadingCostInput.value : 0) || 0,
        productGroup: prodGroupInput ? prodGroupInput.value.trim() : ""
    };

    if (!productData.name || productData.newStock <= 0 || productData.buyingPrice <= 0 || productData.sellingPrice <= 0) {
        alert("দয়া করে সব ঘর সঠিকভাবে পূরণ করুন!");
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = "💾 ডাটাবেজে সেভ করুন";
            submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
        return;
    }

    try {
        await InventoryAPI.saveOrUpdateProduct(productData);
        alert(productData.selectedId ? "🎉 স্টক সফলভাবে আপডেট হয়েছে!" : `🎉 নতুন প্রোডাক্ট "${productData.name}" সেভ হয়েছে!`);

        if (prodNameInput) { prodNameInput.disabled = false; prodNameInput.value = ''; }
        productForm.reset();
        if (prodStockInput) prodStockInput.placeholder = "0";
        if (unloadingCostInput) unloadingCostInput.value = "0";

        await fetchProducts();
    } catch (err) {
        alert("ডাটা সেভ করতে সমস্যা হয়েছে: " + err.message);
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = "💾 ডাটাবেজে সেভ করুন";
            submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }
}

export function initProductForm() {
    const productForm = document.getElementById('product-form') || document.querySelector('form');
    const productSelect = document.getElementById('product-select');
    const prodNameInput = document.getElementById('prod-name');
    const prodUnitInput = document.getElementById('prod-unit');
    const prodStockInput = document.getElementById('prod-stock');
    const unloadingCostInput = document.getElementById('prod-unloading-cost');
    const prodBuyingInput = document.getElementById('prod-buying');
    const prodSellingInput = document.getElementById('prod-selling');
    const prodGroupInput = document.getElementById('prod-group');

    if (!productForm) return console.error("Form element could not be resolved!");

    const inputFields = { productSelect, prodNameInput, prodUnitInput, prodStockInput, prodBuyingInput, prodSellingInput, prodGroupInput };

    if (prodStockInput && prodUnitInput && unloadingCostInput) {
        prodStockInput.addEventListener('input', () => calculateLiveUnloadingCost(prodStockInput, prodUnitInput, unloadingCostInput));
        prodUnitInput.addEventListener('change', () => calculateLiveUnloadingCost(prodStockInput, prodUnitInput, unloadingCostInput));
    }

    if (productSelect) {
        productSelect.onchange = function () {
            const prod = window.cachedProducts.find(p => p.id === parseInt(this.value));

            if (prod) {
                if (prodNameInput) { prodNameInput.value = prod.name; prodNameInput.disabled = true; }
                if (prodUnitInput) prodUnitInput.value = prod.unit;
                if (prodBuyingInput) prodBuyingInput.value = prod.buying_price;
                if (prodSellingInput) prodSellingInput.value = prod.default_selling_price;
                if (prodStockInput) { prodStockInput.value = ''; prodStockInput.placeholder = "নতুন চালানের স্টক লিখুন"; }
                if (unloadingCostInput) unloadingCostInput.value = '0';
                if (prodGroupInput) prodGroupInput.value = prod.product_group || '';
            } else {
                if (prodNameInput) { prodNameInput.value = ''; prodNameInput.disabled = false; }
                if (prodUnitInput) prodUnitInput.selectedIndex = 0;
                if (prodBuyingInput) prodBuyingInput.value = '';
                if (prodSellingInput) prodSellingInput.value = '';
                if (prodStockInput) { prodStockInput.value = ''; prodStockInput.placeholder = "0"; }
                if (unloadingCostInput) unloadingCostInput.value = '0';
                if (prodGroupInput) prodGroupInput.value = '';
            }
        };
    }

    productForm.onsubmit = function (e) { handleProductSubmit(e, productForm, inputFields); };
}