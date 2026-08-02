const { CustomerService } = require('./customer.service');
const { CustomerRepository } = require('./customer.repository');

const ITEMS_PER_PAGE = 20;

const CustomerController = {
    async fetchCustomersList(req, res) {
        try {
            const searchQuery = req.query.search || '';
            const page = parseInt(req.query.page) || 1;

            const { data: dueSummary } = await CustomerRepository.getMarketDueSummary();
            const totalMarketDue = dueSummary ? dueSummary.reduce((sum, item) => sum + (item.total_due || 0), 0) : 0;

            const from = (page - 1) * ITEMS_PER_PAGE;
            const to = from + ITEMS_PER_PAGE - 1;

            const { data: customers, error } = await CustomerRepository.getCustomers(searchQuery, from, to);
            if (error) throw error;

            res.status(200).json({
                customers: customers || [],
                totalMarketDue,
                page,
                itemsPerPage: ITEMS_PER_PAGE,
                isSearching: searchQuery.trim() !== ''
            });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    // 🎯 নতুন — আগে req.query.name/phone ও পাঠাতে হতো, এখন শুধু id দিয়েই চলবে
    async getLedger(req, res) {
        try {
            const customerId = parseInt(req.params.id);
            const result = await CustomerService.generateLedgerData(customerId);
            res.status(200).json(result);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    async submitPayment(req, res) {
        try {
            const custId = parseInt(req.params.id);
            const payAmount = parseFloat(req.body.payAmount) || 0;
            const result = await CustomerService.processPayment(custId, payAmount);
            res.status(200).json(result);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    },
    async createBooking(req, res) {
        try {
            const result = await CustomerService.createBooking(req.body);
            res.status(200).json(result);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    },
    // GET /api/customers/:id/open-bookings — productId দিলে সেই প্রোডাক্টের, না দিলে সব বুকিং
    async getOpenBookings(req, res) {
        try {
            const customerId = parseInt(req.params.id);
            const productId = req.query.productId ? parseInt(req.query.productId) : null;

            const { data, error } = await CustomerRepository.getOpenBookingsForCustomerProduct(customerId, productId);
            if (error) throw error;
            res.status(200).json(data || []);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    // 🎯 নতুন — POST /api/customers/:id/return
    async submitReturn(req, res) {
        try {
            const customerId = parseInt(req.params.id);
            const result = await CustomerService.processReturn({ ...req.body, customerId });
            res.status(200).json(result);
        } catch (error) {
            res.status(400).json({ message: error.message });
        }
    }
};

module.exports = { CustomerController };