const { ReportRepository } = require('./report.repository');
const { ReportService } = require('./report.service');

const ReportController = {
    async getReport(req, res) {
        try {
            const targetDate = req.query.date || null;
            const data = await ReportService.getFullReport(targetDate, ReportRepository);
            res.status(200).json(data);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
};

module.exports = { ReportController };