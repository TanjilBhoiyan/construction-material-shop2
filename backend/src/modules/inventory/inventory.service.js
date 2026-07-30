const { InventoryRepository } = require('./inventory.repository');

const InventoryService = {
    async getFormattedProducts() {
        const { data, error } = await InventoryRepository.getProducts();
        if (error) throw error;

        return (data || []).map(prod => ({
            ...prod,
            current_stock: prod.current_stock ?? 0,
            buying_price: parseFloat(prod.buying_price || 0),
            default_selling_price: parseFloat(prod.default_selling_price || 0),
            unit: prod.unit || ''
        }));
    },
    
    async calculateUnloadingCost(stock, unit) {
        let dbCategoryKey = 'others';
        const rawUnitLower = unit.toLowerCase();
        if (rawUnitLower.includes('ব্যাগ') || rawUnitLower.includes('bag')) dbCategoryKey = 'bag';
        else if (rawUnitLower.includes('কেজি') || rawUnitLower.includes('kg')) dbCategoryKey = 'kg';
        else if (rawUnitLower.includes('বান্ডিল') || rawUnitLower.includes('bundle')) dbCategoryKey = 'bundle';
        else if (rawUnitLower.includes('পিস') || rawUnitLower.includes('pcs')) dbCategoryKey = 'pcs';

        const { data, error } = await InventoryRepository.getLaborRate(dbCategoryKey);
        if (error || !data) return 0;
        
        return (stock * parseFloat(data.unloading_rate_per_unit || 0)).toFixed(2);
    },

    // তোমার handleProductSubmit লজিকটা API এর জন্য রেডি করা হলো
    async saveOrUpdateProduct(productData) {
        const { selectedId, name, unit, newStock, buyingPrice, sellingPrice, unloadingLaborCost, productGroup } = productData;

        if (selectedId) {
            // পুরানো প্রোডাক্ট আপডেট (স্টক যোগ হবে)
            const { data: existingData } = await InventoryRepository.getProducts();
            const existingProd = existingData.find(p => p.id === parseInt(selectedId));
            const finalStock = parseFloat(existingProd?.current_stock || 0) + newStock;

            await InventoryRepository.updateProduct(selectedId, {
                current_stock: finalStock, 
                buying_price: buyingPrice,
                default_selling_price: sellingPrice, 
                unit, 
                unloading_labor_cost: unloadingLaborCost,
                product_group: productGroup || null
            });

            if (unloadingLaborCost > 0) {
                await InventoryRepository.insertLog({ product_id: parseInt(selectedId), product_name: name, labor_cost: unloadingLaborCost });
            }
            return { message: "স্টক সফলভাবে আপডেট হয়েছে!" };

        } else {
            // নতুন প্রোডাক্ট সেভ
            const { data, error } = await InventoryRepository.insertProduct({
                name, unit, current_stock: newStock, buying_price: buyingPrice,
                default_selling_price: sellingPrice, unloading_labor_cost: unloadingLaborCost,
                product_group: productGroup || null
            });
            if (error) throw error;

            if (unloadingLaborCost > 0 && data && data.length > 0) {
                await InventoryRepository.insertLog({ product_id: data[0].id, product_name: name, labor_cost: unloadingLaborCost });
            }
            return { message: "নতুন প্রোডাক্ট সফলভাবে যুক্ত হয়েছে!", data };
        }
    }
};

module.exports = { InventoryService };