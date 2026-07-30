const { SettingsRepository } = require('./settings.repository');

const SettingsService = {
    async fetchLaborSettings() {
        return await SettingsRepository.getLaborSettings();
    },

    async updateMultipleSettings(updateMap) {
        for (let key in updateMap) {
            const { error } = await SettingsRepository.updateLaborSetting(key, {
                rate_per_unit: updateMap[key].rate_per_unit,
                unloading_rate_per_unit: updateMap[key].unloading_rate_per_unit,
                updated_at: new Date().toISOString()
            });
            if (error) throw error;
        }
    }
};

module.exports = { SettingsService };