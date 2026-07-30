const API_BASE = 'http://localhost:5000/api/settings';

export const SettingsAPI = {
    async getLaborSettings() {
        const res = await fetch(`${API_BASE}/labor`);
        if (!res.ok) throw new Error('সেটিংস লোড করতে সমস্যা হয়েছে');
        return await res.json();
    },

    async saveLaborSettings(updateMap) {
        const res = await fetch(`${API_BASE}/labor`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ updateMap })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'সেটিংস সেভ করতে সমস্যা হয়েছে');
        return data;
    }
};