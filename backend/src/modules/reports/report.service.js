const ReportService = {
    getDateRange(targetDate) {
        let start, end;
        if (targetDate) {
            start = new Date(`${targetDate}T00:00:00`).toISOString();
            end = new Date(`${targetDate}T23:59:59.999`).toISOString();
        } else {
            const now = new Date();
            start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString();
            end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();
        }
        return { start, end };
    },

    calculateSummary(sales, products) {
        let totalSales = 0;
        let cashReceived = 0;
        let totalDue = 0;
        let totalProfitFromSales = 0;
        let totalLaborCost = 0;

        sales.forEach(sale => {
            totalSales += sale.total_payable || 0;
            cashReceived += sale.cash_paid || 0;
            totalDue += sale.due_amount || 0;
            totalProfitFromSales += ((sale.subtotal || 0) * 0.15);
            totalLaborCost += parseFloat(sale.labor_cost || 0);
        });

        products.forEach(product => {
            totalLaborCost += parseFloat(product.labor_cost || 0);
        });

        const finalNetProfit = totalProfitFromSales - totalLaborCost;

        return { totalSales, cashReceived, totalDue, totalNetProfit: finalNetProfit, totalLaborCost };
    },

    generateLaborLedger(sales, products) {
        let laborItems = [];
        let grandTotalLabor = 0;

        sales.forEach(sale => {
            const laborCost = parseFloat(sale.labor_cost || 0);
            if (laborCost > 0) {
                grandTotalLabor += laborCost;
                const customerName = sale.customer_name && sale.customer_name !== 'EMPTY' ? sale.customer_name : 'অনিবন্ধিত কাস্টমার';
                laborItems.push({
                    date: new Date(sale.created_at).toLocaleDateString('bn-BD'),
                    description: `পণ্য বিক্রি (${customerName})`,
                    cost: laborCost,
                    type: 'sale'
                });
            }
        });

        products.forEach(product => {
            const unloadingCost = parseFloat(product.labor_cost || 0);
            if (unloadingCost > 0) {
                grandTotalLabor += unloadingCost;
                laborItems.push({
                    date: new Date(product.created_at).toLocaleDateString('bn-BD'),
                    description: `মালামাল আনলোডিং: ${product.product_name}`,
                    cost: unloadingCost,
                    type: 'inventory'
                });
            }
        });

        return { laborItems, grandTotalLabor };
    },

    async getFullReport(targetDate, repository) {
        const { start, end } = this.getDateRange(targetDate);

        const [salesRes, inventoryRes] = await Promise.all([
            repository.getSalesByDate(start, end),
            repository.getInventoryLogsByDate(start, end)
        ]);

        if (salesRes.error) throw salesRes.error;
        if (inventoryRes.error) throw inventoryRes.error;

        const sales = salesRes.data || [];
        const products = inventoryRes.data || [];

        return {
            sales,
            summary: this.calculateSummary(sales, products),
            laborLedger: this.generateLaborLedger(sales, products)
        };
    }
};

module.exports = { ReportService };