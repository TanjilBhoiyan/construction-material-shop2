const API_BASE = 'http://localhost:5000/api/reports';

export const ReportAPI = {
    async getReport(targetDate = null) {
        const url = targetDate ? `${API_BASE}?date=${targetDate}` : API_BASE;
        const res = await fetch(url);
        if (!res.ok) throw new Error('রিপোর্ট লোড করতে সমস্যা হয়েছে');
        return await res.json();
    }
};