const { SettingsService } = require('./settings.service');

const SettingsController = {
    async getSettings(req, res) {
        try {
            const { data, error } = await SettingsService.fetchLaborSettings();
            if (error) throw error;
            res.status(200).json(data);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    async saveSettings(req, res) {
        try {
            await SettingsService.updateMultipleSettings(req.body.updateMap || {});
            res.status(200).json({ message: "সেটিংস সফলভাবে আপডেট হয়েছে" });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
};

module.exports = { SettingsController };