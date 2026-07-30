const express = require('express');
const router = express.Router();
const { SettingsController } = require('./settings.controller');

router.get('/labor', SettingsController.getSettings);
router.put('/labor', SettingsController.saveSettings);

module.exports = router;