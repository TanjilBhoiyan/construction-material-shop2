const { InventoryService } = require('./inventory.service');

const InventoryController = {
    // GET /api/inventory
    async getProducts(req, res) {
        try {
            const products = await InventoryService.getFormattedProducts();
            res.status(200).json(products);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    // POST /api/inventory/calculate-cost
    async calculateUnloadingCost(req, res) {
        try {
            const { stock, unit } = req.body;
            if (stock === undefined || !unit) {
                return res.status(400).json({ message: "stock ebong unit dorkar" });
            }
            const cost = await InventoryService.calculateUnloadingCost(parseFloat(stock), unit);
            res.status(200).json({ cost });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    // POST /api/inventory  (notun product add ba existing update)
    async saveOrUpdateProduct(req, res) {
        try {
            const result = await InventoryService.saveOrUpdateProduct(req.body);
            res.status(200).json(result);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
};

module.exports = { InventoryController };