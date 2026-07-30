const express = require('express');
const router = express.Router();
const { BillingController } = require('./billing.controller');

router.get('/labor-settings', BillingController.getLaborSettings);
router.get('/search-customers', BillingController.searchCustomers);
router.post('/checkout', BillingController.checkout);

module.exports = router;
