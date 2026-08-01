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

    // 🎯 checkoutRPC — আগে এটা Postgres এর process_checkout() ফাংশনকে RPC call করতো।
    // এখন থেকে পুরো লজিক এখানে সরাসরি JavaScript এ, কিন্তু নিরাপত্তার জন্য পুরো কাজটা
    // BEGIN...COMMIT/ROLLBACK এর ভিতরে wrap করা — যাতে মাঝপথে কোনো ধাপ fail করলে
    // স্টক কমে যাওয়া, বিল সেভ হওয়া ইত্যাদির কোনোটাই আংশিকভাবে সেভ না থেকে যায়।
    // ফাংশনের নাম আর return shape ({data, error}) আগের মতোই রাখা হয়েছে, তাই
    // billing.service.js / billing.controller.js এ কিছু বদলাতে হয়নি।
    async checkoutRPC(params) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const cart = params.p_cart;

            // ১. স্টক চেক ও মাইনাস (FOR UPDATE দিয়ে row lock, ঠিক আগের PL/pgSQL এর মতোই)
            for (const item of cart) {
                const productId = item.product_id;
                const qty = parseFloat(item.quantity);

                const stockRes = await client.query(
                    'SELECT current_stock, name FROM products WHERE id = $1 FOR UPDATE',
                    [productId]
                );

                if (stockRes.rows.length === 0) {
                    throw new Error(`PRODUCT_NOT_FOUND|${productId}`);
                }

                const currentStock = parseFloat(stockRes.rows[0].current_stock);
                const productName = stockRes.rows[0].name;

                if (currentStock < qty) {
                    throw new Error(`INSUFFICIENT_STOCK|${productName}|${currentStock}`);
                }

                await client.query(
                    'UPDATE products SET current_stock = current_stock - $1 WHERE id = $2',
                    [qty, productId]
                );
            }

            // ২. কাস্টমার লেজার সিঙ্ক
            const customerName = params.p_customer_name;
            const customerPhone = params.p_customer_phone;

            if (customerName && customerName.trim() !== '' && customerName !== 'অনিবন্ধিত কাস্টমার') {
                let existingCustomerId = null;
                let existingDue = 0;

                if (customerPhone && customerPhone.trim() !== '') {
                    const res = await client.query(
                        'SELECT id, total_due FROM customers WHERE phone = $1 LIMIT 1',
                        [customerPhone]
                    );
                    if (res.rows.length > 0) {
                        existingCustomerId = res.rows[0].id;
                        existingDue = parseFloat(res.rows[0].total_due);
                    }
                } else {
                    const res = await client.query(
                        `SELECT id, total_due FROM customers WHERE name = $1 AND (phone IS NULL OR phone = '') LIMIT 1`,
                        [customerName]
                    );
                    if (res.rows.length > 0) {
                        existingCustomerId = res.rows[0].id;
                        existingDue = parseFloat(res.rows[0].total_due);
                    }
                }

                if (existingCustomerId !== null) {
                    await client.query(
                        `UPDATE customers
                         SET total_due = $1,
                             name = $2,
                             father_name = COALESCE(NULLIF($3, ''), father_name),
                             customer_address = COALESCE(NULLIF($4, ''), customer_address)
                         WHERE id = $5`,
                        [
                            existingDue + params.p_due,
                            customerName,
                            params.p_father_name ?? '',
                            params.p_customer_address ?? '',
                            existingCustomerId
                        ]
                    );
                } else {
                    await client.query(
                        `INSERT INTO customers (name, phone, father_name, customer_address, total_due)
                         VALUES ($1, $2, $3, $4, $5)`,
                        [
                            customerName,
                            customerPhone || null,
                            params.p_father_name || null,
                            params.p_customer_address || null,
                            params.p_due
                        ]
                    );
                }
            }

            // ৩. sales টেবিলে মেমো সেভ
            const saleRes = await client.query(
                `INSERT INTO sales (
                    customer_name, customer_phone, father_name, customer_address,
                    subtotal, labor_cost, labor_bearer, carrying_cost, carrying_bearer,
                    total_payable, cash_paid, due_amount, "previousDue", discount_amount
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                RETURNING id`,
                [
                    params.p_customer_name,
                    params.p_customer_phone,
                    params.p_father_name,
                    params.p_customer_address,
                    params.p_subtotal,
                    params.p_labor_cost,
                    params.p_labor_bearer,
                    params.p_transport_cost,
                    params.p_transport_bearer,
                    params.p_total_payable,
                    params.p_cash_paid,
                    params.p_due,
                    params.p_previous_due,
                    params.p_discount_amount
                ]
            );
            const newSaleId = saleRes.rows[0].id;

            // ৪. sale_items টেবিলে কার্টের আইটেম সেভ
            for (const item of cart) {
                await client.query(
                    `INSERT INTO sale_items (sale_id, product_id, quantity, price_per_unit, total_price)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [newSaleId, item.product_id, item.quantity, item.price_per_unit, item.total_price]
                );
            }

            // ৫. booking consumption — locked-price লাইনের delivered_quantity বাড়ানো
            for (const item of cart) {
                if (item.booking_id) {
                    const qty = parseFloat(item.quantity);
                    await client.query(
                        `UPDATE advance_bookings
                         SET delivered_quantity = delivered_quantity + $1,
                             status = CASE
                                 WHEN (delivered_quantity + $1) >= booked_quantity THEN 'completed'
                                 ELSE 'open'
                             END
                         WHERE id = $2`,
                        [qty, item.booking_id]
                    );
                }
            }

            await client.query('COMMIT');

            return {
                data: { message: 'বিল সফলভাবে সংরক্ষিত হয়েছে', saleId: newSaleId },
                error: null
            };

        } catch (error) {
            await client.query('ROLLBACK');
            return { data: null, error };
        } finally {
            client.release();
        }
    }
};

module.exports = { BillingRepository };