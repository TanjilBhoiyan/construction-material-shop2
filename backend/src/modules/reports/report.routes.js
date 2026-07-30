const express = require('express');
const router = express.Router();
const { ReportController } = require('./report.controller');

router.get('/', ReportController.getReport);

module.exports = router;