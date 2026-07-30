CREATE OR REPLACE FUNCTION process_checkout(
    p_cart jsonb,
    p_customer_name text,
    p_customer_phone text,
    p_father_name text,
    p_customer_address text,
    p_labor_cost numeric,
    p_labor_bearer text,
    p_transport_cost numeric,
    p_transport_bearer text,
    p_subtotal numeric,
    p_total_payable numeric,
    p_cash_paid numeric,
    p_due numeric,
    p_previous_due numeric,
    p_discount_amount numeric
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    item jsonb;
    v_product_id int;
    v_qty numeric;
    v_booking_id bigint;
    v_current_stock numeric;
    v_product_name text;
    v_existing_customer_id bigint;
    v_existing_due numeric;
    v_new_sale_id int;
BEGIN
    -- ১. স্টক চেক ও মাইনাস (FOR UPDATE দিয়ে row lock করা হচ্ছে)
    FOR item IN SELECT * FROM jsonb_array_elements(p_cart)
    LOOP
        v_product_id := (item->>'product_id')::int;
        v_qty := (item->>'quantity')::numeric;

        SELECT current_stock, name INTO v_current_stock, v_product_name
        FROM products WHERE id = v_product_id FOR UPDATE;

        IF v_current_stock IS NULL THEN
            RAISE EXCEPTION 'PRODUCT_NOT_FOUND|%', v_product_id;
        END IF;

        IF v_current_stock < v_qty THEN
            RAISE EXCEPTION 'INSUFFICIENT_STOCK|%|%', v_product_name, v_current_stock;
        END IF;

        UPDATE products SET current_stock = current_stock - v_qty WHERE id = v_product_id;
    END LOOP;

    -- ২. কাস্টমার লেজার সিঙ্ক
    IF p_customer_name IS NOT NULL AND p_customer_name <> '' AND p_customer_name <> 'অনিবন্ধিত কাস্টমার' THEN
        IF p_customer_phone IS NOT NULL AND p_customer_phone <> '' THEN
            SELECT id, total_due INTO v_existing_customer_id, v_existing_due
            FROM customers WHERE phone = p_customer_phone LIMIT 1;
        ELSE
            SELECT id, total_due INTO v_existing_customer_id, v_existing_due
            FROM customers WHERE name = p_customer_name AND (phone IS NULL OR phone = '') LIMIT 1;
        END IF;

        IF v_existing_customer_id IS NOT NULL THEN
            UPDATE customers
            SET total_due = v_existing_due + p_due,
                name = p_customer_name,
                father_name = COALESCE(NULLIF(p_father_name, ''), father_name),
                customer_address = COALESCE(NULLIF(p_customer_address, ''), customer_address)
            WHERE id = v_existing_customer_id;
        ELSE
            INSERT INTO customers (name, phone, father_name, customer_address, total_due)
            VALUES (p_customer_name, NULLIF(p_customer_phone, ''), NULLIF(p_father_name, ''), NULLIF(p_customer_address, ''), p_due);
        END IF;
    END IF;

    -- ৩. sales টেবিলে মেমো সেভ
    INSERT INTO sales (
        customer_name, customer_phone, father_name, customer_address,
        subtotal, labor_cost, labor_bearer, carrying_cost, carrying_bearer,
        total_payable, cash_paid, due_amount, "previousDue", discount_amount
    )
    VALUES (
        p_customer_name, p_customer_phone, p_father_name, p_customer_address,
        p_subtotal, p_labor_cost, p_labor_bearer, p_transport_cost, p_transport_bearer,
        p_total_payable, p_cash_paid, p_due, p_previous_due, p_discount_amount
    )
    RETURNING id INTO v_new_sale_id;

    -- ৪. sale_items টেবিলে কার্টের আইটেম সেভ
    INSERT INTO sale_items (sale_id, product_id, quantity, price_per_unit, total_price)
    SELECT
        v_new_sale_id,
        (i->>'product_id')::int,
        (i->>'quantity')::numeric,
        (i->>'price_per_unit')::numeric,
        (i->>'total_price')::numeric
    FROM jsonb_array_elements(p_cart) AS i;

    -- ৫. 🎯 নতুন — booking consumption: যে কার্ট-লাইনে booking_id ট্যাগ আছে, সেই বুকিং-এর
    --    delivered_quantity বাড়ানো, আর পুরোটা ডেলিভারি হয়ে গেলে status = 'completed'
    FOR item IN SELECT * FROM jsonb_array_elements(p_cart)
    LOOP
        v_booking_id := NULLIF(item->>'booking_id', '')::bigint;
        IF v_booking_id IS NOT NULL THEN
            v_qty := (item->>'quantity')::numeric;

            UPDATE advance_bookings
            SET delivered_quantity = delivered_quantity + v_qty,
                status = CASE
                    WHEN (delivered_quantity + v_qty) >= booked_quantity THEN 'completed'
                    ELSE 'open'
                END
            WHERE id = v_booking_id;
        END IF;
    END LOOP;

    RETURN jsonb_build_object('message', 'বিল সফলভাবে সংরক্ষিত হয়েছে', 'saleId', v_new_sale_id);
END;
$$;