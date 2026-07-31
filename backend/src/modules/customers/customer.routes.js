const express = require('express');
const router = express.Router();
const { CustomerController } = require('./customer.controller');

router.get('/', CustomerController.fetchCustomersList);
router.get('/:id/ledger', CustomerController.getLedger);
router.post('/:id/payment', CustomerController.submitPayment);
router.get('/:id/open-bookings', CustomerController.getOpenBookings);
router.post('/bookings', CustomerController.createBooking);
router.post('/:id/return', CustomerController.submitReturn);

module.exports = router;