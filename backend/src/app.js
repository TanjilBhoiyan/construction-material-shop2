const express = require('express');
const cors = require('cors');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// 1. Inventory Routes import korlam
const inventoryRoutes = require('./modules/inventory/inventory.routes');
const billingRoutes = require('./modules/billing/billing.routes');
const reportRoutes = require('./modules/reports/report.routes');
const customerRoutes = require('./modules/customers/customer.routes');
const settingsRoutes = require('./modules/settings/settings.routes');
// Home Route
app.get('/', (req, res) => {
    res.send('<h2>Rod Cement Web API is running perfectly! 🚀</h2>');
});

// 2. Inventory API Endpoint Express er sathe connect korlam
app.use('/api/inventory', inventoryRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/settings', settingsRoutes);


module.exports = app;