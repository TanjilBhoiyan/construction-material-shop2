const pool = require('../../config/pgClient');

const CustomerRepository = {
    async getSalesByCustomer(phone, name) {
        try {
            let result;
            if (phone && phone.trim() !== '') {
                result = await pool.query(
                    'SELECT * FROM sales WHERE customer_phone = $1',
                    [phone]
                );
            } else {
                result = await pool.query(
                    `SELECT * FROM sales WHERE customer_name = $1 AND (customer_phone IS NULL OR customer_phone = '')`,
                    [name]
                );
            }
            return { data: result.rows, error: null };
        } catch (error) {
            return { data: null, error };
        }
    },

    async getSaleItemsBySaleIds(saleIds) {
        try {
            const result = await pool.query(
                `SELECT si.sale_id, si.quantity, si.price_per_unit, si.total_price,
                        p.name AS product_name, p.unit AS product_unit
                 FROM sale_items si
                 LEFT JOIN products p ON p.id = si.product_id
                 WHERE si.sale_id = ANY($1::int[])`,
                [saleIds]
            );
            const data = result.rows.map(row => ({
                sale_id: row.sale_id,
                quantity: row.quantity,
                price_per_unit: row.price_per_unit,
                total_price: row.total_price,
                products: { name: row.product_name, unit: row.product_unit }
            }));
            return { data, error: null };
        } catch (error) {
            return { data: null, error };
        }
    },

    async getCustomerPayments(customerId) {
        try {
            const result = await pool.query(
                'SELECT * FROM customer_payments WHERE customer_id = $1',
                [customerId]
            );
            return { data: result.rows, error: null };
        } catch (error) {
            return { data: null, error };
        }
    },

    async getMarketDueSummary() {
        try {
            const result = await pool.query('SELECT total_due FROM customers');
            return { data: result.rows, error: null };
        } catch (error) {
            return { data: null, error };
        }
    },

    async getCustomers(searchQuery, from, to) {
        try {
            const limit = to - from + 1;
            const offset = from;
            let result;
            if (searchQuery && searchQuery.trim() !== '') {
                const likeParam = `%${searchQuery}%`;
                result = await pool.query(
                    `SELECT * FROM customers WHERE name ILIKE $1 OR phone ILIKE $1
                     ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
                    [likeParam, limit, offset]
                );
            } else {
                result = await pool.query(
                    `SELECT * FROM customers ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
                    [limit, offset]
                );
            }
            return { data: result.rows, error: null };
        } catch (error) {
            return { data: null, error };
        }
    },

    async getCustomerById(id) {
        try {
            const result = await pool.query('SELECT * FROM customers WHERE id = $1', [id]);
            if (result.rows.length !== 1) {
                return { data: null, error: new Error('Customer not found') };
            }
            return { data: result.rows[0], error: null };
        } catch (error) {
            return { data: null, error };
        }
    },

    async addPayment(paymentData) {
        try {
            await pool.query(
                'INSERT INTO customer_payments (customer_id, amount_paid, note) VALUES ($1, $2, $3)',
                [paymentData.customer_id, paymentData.amount_paid, paymentData.note || null]
            );
            return { error: null };
        } catch (error) {
            return { error };
        }
    },

    async updateCustomerDue(customerId, newDue) {
        try {
            await pool.query('UPDATE customers SET total_due = $1 WHERE id = $2', [newDue, customerId]);
            return { error: null };
        } catch (error) {
            return { error };
        }
    },

    async getCustomerByPhone(phone) {
        try {
            const result = await pool.query('SELECT * FROM customers WHERE phone = $1', [phone]);
            return { data: result.rows[0] || null, error: null };
        } catch (error) {
            return { data: null, error };
        }
    },

    async getCustomerByName(name) {
        try {
            const result = await pool.query('SELECT * FROM customers WHERE name = $1', [name]);
            return { data: result.rows[0] || null, error: null };
        } catch (error) {
            return { data: null, error };
        }
    },

    async insertCustomer(data) {
        try {
            const result = await pool.query(
                `INSERT INTO customers (name, phone, father_name, customer_address, total_due)
                 VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                [data.name, data.phone, data.father_name, data.customer_address, data.total_due]
            );
            return { data: result.rows, error: null };
        } catch (error) {
            return { data: null, error };
        }
    },

    async insertBooking(data) {
        try {
            const result = await pool.query(
                `INSERT INTO advance_bookings (customer_id, product_id, locked_price, booked_quantity, delivered_quantity, status)
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                [data.customer_id, data.product_id, data.locked_price, data.booked_quantity, data.delivered_quantity, data.status]
            );
            return { data: result.rows, error: null };
        } catch (error) {
            return { data: null, error };
        }
    },

    async getOpenBookingsForCustomerProduct(customerId, productId = null) {
        try {
            let result;
            if (productId) {
                result = await pool.query(
                    `SELECT ab.*, p.name AS product_name, p.unit AS product_unit, p.product_group AS product_group
                     FROM advance_bookings ab
                     LEFT JOIN products p ON p.id = ab.product_id
                     WHERE ab.customer_id = $1 AND ab.status = 'open' AND ab.product_id = $2
                     ORDER BY ab.created_at ASC`,
                    [customerId, productId]
                );
            } else {
                result = await pool.query(
                    `SELECT ab.*, p.name AS product_name, p.unit AS product_unit, p.product_group AS product_group
                     FROM advance_bookings ab
                     LEFT JOIN products p ON p.id = ab.product_id
                     WHERE ab.customer_id = $1 AND ab.status = 'open'
                     ORDER BY ab.created_at ASC`,
                    [customerId]
                );
            }
            const data = result.rows.map(row => {
                const { product_name, product_unit, product_group, ...booking } = row;
                return { ...booking, products: { name: product_name, unit: product_unit, product_group } };
            });
            return { data, error: null };
        } catch (error) {
            return { data: null, error };
        }
    },

    async returnRPC(params) {
        try {
            const result = await pool.query(
                `SELECT process_return(
                    p_cart := $1::jsonb,
                    p_customer_id := $2,
                    p_customer_name := $3,
                    p_customer_phone := $4,
                    p_labor_cost := $5,
                    p_labor_bearer := $6,
                    p_transport_cost := $7,
                    p_transport_bearer := $8,
                    p_subtotal := $9,
                    p_total_credited := $10
                ) AS result`,
                [
                    JSON.stringify(params.p_cart),
                    params.p_customer_id,
                    params.p_customer_name,
                    params.p_customer_phone,
                    params.p_labor_cost,
                    params.p_labor_bearer,
                    params.p_transport_cost,
                    params.p_transport_bearer,
                    params.p_subtotal,
                    params.p_total_credited
                ]
            );
            return { data: result.rows[0].result, error: null };
        } catch (error) {
            return { data: null, error };
        }
    },

    async getReturnsByCustomer(customerId) {
        try {
            const result = await pool.query(
                'SELECT * FROM product_returns WHERE customer_id = $1',
                [customerId]
            );
            return { data: result.rows, error: null };
        } catch (error) {
            return { data: null, error };
        }
    },

    async getReturnItemsByReturnIds(returnIds) {
        try {
            const result = await pool.query(
                `SELECT pri.return_id, pri.product_id, pri.quantity, pri.rate, pri.total_price,
                        p.name AS product_name, p.unit AS product_unit
                 FROM product_return_items pri
                 LEFT JOIN products p ON p.id = pri.product_id
                 WHERE pri.return_id = ANY($1::bigint[])`,
                [returnIds]
            );
            const data = result.rows.map(row => ({
                return_id: row.return_id,
                product_id: row.product_id,
                quantity: row.quantity,
                rate: row.rate,
                total_price: row.total_price,
                products: { name: row.product_name, unit: row.product_unit }
            }));
            return { data, error: null };
        } catch (error) {
            return { data: null, error };
        }
    }
};

module.exports = { CustomerRepository };