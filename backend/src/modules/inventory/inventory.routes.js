const express = require('express');
const router = express.Router();
const { InventoryController } = require('./inventory.controller');

// GET /api/inventory  -> shob product list dekhabe
router.get('/', InventoryController.getProducts);

// POST /api/inventory/calculate-cost  -> unloading cost calculate korbe
router.post('/calculate-cost', InventoryController.calculateUnloadingCost);

// POST /api/inventory  -> notun product add ba existing update
router.post('/', InventoryController.saveOrUpdateProduct);

module.exports = router;