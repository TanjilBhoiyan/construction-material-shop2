const pool = require('../../config/pgClient');

const BillingRepository = {
    async getLaborSettings() {
        try {
            const result = await pool.query('SELECT * FROM labor_settings');
            return { data: result.rows, error: null };
        } catch (error) {
            return { data: null, error };
        }
    },
    async checkoutRPC(params) {
        try {
            const result = await pool.query(
                `SELECT process_checkout(
                    p_cart := $1::jsonb,
                    p_customer_name := $2,
                    p_customer_phone := $3,
                    p_father_name := $4,
                    p_customer_address := $5,
                    p_labor_cost := $6,
                    p_labor_bearer := $7,
                    p_transport_cost := $8,
                    p_transport_bearer := $9,
                    p_subtotal := $10,
                    p_total_payable := $11,
                    p_cash_paid := $12,
                    p_due := $13,
                    p_previous_due := $14,
                    p_discount_amount := $15
                ) AS result`,
                [
                    JSON.stringify(params.p_cart),
                    params.p_customer_name,
                    params.p_customer_phone,
                    params.p_father_name,
                    params.p_customer_address,
                    params.p_labor_cost,
                    params.p_labor_bearer,
                    params.p_transport_cost,
                    params.p_transport_bearer,
                    params.p_subtotal,
                    params.p_total_payable,
                    params.p_cash_paid,
                    params.p_due,
                    params.p_previous_due,
                    params.p_discount_amount
                ]
            );
            return { data: result.rows[0].result, error: null };
        } catch (error) {
            return { data: null, error };
        }
    }
};

module.exports = { BillingRepository };