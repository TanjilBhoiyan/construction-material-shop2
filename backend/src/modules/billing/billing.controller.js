const { BillingService } = require('./billing.service');
const { CustomerRepository } = require('../customers/customer.repository');

const BillingController = {
    // GET /api/billing/labor-settings
    async getLaborSettings(req, res) {
        try {
            const settings = await BillingService.getLaborSettingsList();
            res.status(200).json(settings);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    // GET /api/billing/search-customers?q=...
    async searchCustomers(req, res) {
        try {
            const query = req.query.q || '';
            const { data, error } = await CustomerRepository.getCustomers(query, 0, 4);
            if (error) throw error;
            res.status(200).json(data || []);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    // POST /api/billing/checkout
    async checkout(req, res) {
        try {
            const result = await BillingService.processCheckoutBusinessLogic(req.body);
            res.status(200).json(result);
        } catch (error) {
            if (error.message && error.message.startsWith('INSUFFICIENT_STOCK')) {
                const parts = error.message.split('|');
                return res.status(409).json({
                    message: `পর্যাপ্ত স্টক নেই: ${parts[1]} (বর্তমান স্টক: ${parts[2]})`,
                    code: 'INSUFFICIENT_STOCK'
                });
            }
            res.status(500).json({ message: error.message });
        }
    }
};

module.exports = { BillingController };
