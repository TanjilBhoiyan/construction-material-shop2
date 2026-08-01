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

    // 🎯 returnRPC — আগে এটা Postgres এর process_return() ফাংশনকে RPC call করতো।
    // এখন থেকে পুরো লজিক এখানে সরাসরি JavaScript এ, কিন্তু নিরাপত্তার জন্য পুরো কাজটা
    // BEGIN...COMMIT/ROLLBACK এর ভিতরে wrap করা — যাতে মাঝপথে কোনো ধাপ fail করলে
    // স্টক ফেরত যোগ হওয়া, কাস্টমারের বাকি কমা, রিটার্ন রেকর্ড সেভ হওয়া ইত্যাদির
    // কোনোটাই আংশিকভাবে সেভ না থেকে যায়। ফাংশনের নাম আর return shape ({data, error})
    // আগের মতোই রাখা হয়েছে, তাই customer.service.js / customer.controller.js এ
    // কিছু বদলাতে হয়নি।
    async returnRPC(params) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const cart = params.p_cart;

            // ১. স্টক ফেরত যোগ করা
            for (const item of cart) {
                const productId = item.product_id;
                const qty = parseFloat(item.quantity);

                const updateRes = await client.query(
                    'UPDATE products SET current_stock = current_stock + $1 WHERE id = $2',
                    [qty, productId]
                );

                if (updateRes.rowCount === 0) {
                    throw new Error(`PRODUCT_NOT_FOUND|${productId}`);
                }
            }

            // ২. কাস্টমারের বাকি থেকে টাকা বাদ (row lock সহ, ঋণাত্মক হলে জমা/ক্রেডিট হয়ে যাবে)
            const custRes = await client.query(
                'SELECT total_due FROM customers WHERE id = $1 FOR UPDATE',
                [params.p_customer_id]
            );

            if (custRes.rows.length === 0) {
                throw new Error(`CUSTOMER_NOT_FOUND|${params.p_customer_id}`);
            }

            const currentDue = parseFloat(custRes.rows[0].total_due);

            await client.query(
                'UPDATE customers SET total_due = $1 WHERE id = $2',
                [currentDue - params.p_total_credited, params.p_customer_id]
            );

            // ৩. product_returns টেবিলে হেডার সেভ
            const returnRes = await client.query(
                `INSERT INTO product_returns (
                    customer_id, customer_name, customer_phone,
                    subtotal, labor_cost, labor_bearer, transport_cost, transport_bearer, total_credited
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING id`,
                [
                    params.p_customer_id,
                    params.p_customer_name,
                    params.p_customer_phone,
                    params.p_subtotal,
                    params.p_labor_cost,
                    params.p_labor_bearer,
                    params.p_transport_cost,
                    params.p_transport_bearer,
                    params.p_total_credited
                ]
            );
            const newReturnId = returnRes.rows[0].id;

            // ৪. product_return_items টেবিলে কার্টের আইটেম সেভ
            for (const item of cart) {
                await client.query(
                    `INSERT INTO product_return_items (return_id, product_id, quantity, rate, total_price)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [newReturnId, item.product_id, item.quantity, item.rate, item.total_price]
                );
            }

            await client.query('COMMIT');

            return {
                data: { message: 'মাল ফেরত সফলভাবে সংরক্ষিত হয়েছে', returnId: newReturnId },
                error: null
            };

        } catch (error) {
            await client.query('ROLLBACK');
            return { data: null, error };
        } finally {
            client.release();
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