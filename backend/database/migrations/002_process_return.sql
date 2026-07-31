-- 🎯 প্রোডাক্ট রিটার্ন (মাল ফেরত) টেবিল — sales/sale_items এর মতো header + items প্যাটার্ন
CREATE TABLE IF NOT EXISTS product_returns (
    id bigserial PRIMARY KEY,
    customer_id bigint REFERENCES customers(id),
    customer_name text,
    customer_phone text,
    subtotal numeric NOT NULL DEFAULT 0,
    labor_cost numeric NOT NULL DEFAULT 0,
    labor_bearer text,
    transport_cost numeric NOT NULL DEFAULT 0,
    transport_bearer text,
    total_credited numeric NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_return_items (
    id bigserial PRIMARY KEY,
    return_id bigint REFERENCES product_returns(id) ON DELETE CASCADE,
    product_id int REFERENCES products(id),
    quantity numeric NOT NULL,
    rate numeric NOT NULL,
    total_price numeric NOT NULL
);

-- 🎯 process_checkout এর মতোই atomic ফাংশন — স্টক বাড়ানো, কাস্টমারের বাকি থেকে
-- টাকা কমানো (বা ঋণাত্মক হলে জমা/ক্রেডিট), আর রিটার্নের রেকর্ড সেভ করা — সবকিছু একটা
-- transaction এ, যাতে মাঝপথে সমস্যা হলে সব বাতিল হয়ে যায়।
CREATE OR REPLACE FUNCTION process_return(
    p_cart jsonb,
    p_customer_id bigint,
    p_customer_name text,
    p_customer_phone text,
    p_labor_cost numeric,
    p_labor_bearer text,
    p_transport_cost numeric,
    p_transport_bearer text,
    p_subtotal numeric,
    p_total_credited numeric
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    item jsonb;
    v_product_id int;
    v_qty numeric;
    v_new_return_id bigint;
    v_current_due numeric;
BEGIN
    -- ১. স্টক ফেরত যোগ করা
    FOR item IN SELECT * FROM jsonb_array_elements(p_cart)
    LOOP
        v_product_id := (item->>'product_id')::int;
        v_qty := (item->>'quantity')::numeric;

        UPDATE products SET current_stock = current_stock + v_qty
        WHERE id = v_product_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'PRODUCT_NOT_FOUND|%', v_product_id;
        END IF;
    END LOOP;

    -- ২. কাস্টমারের বাকি থেকে টাকা বাদ (row lock সহ, ঋণাত্মক হলে জমা/ক্রেডিট হয়ে যাবে)
    SELECT total_due INTO v_current_due FROM customers WHERE id = p_customer_id FOR UPDATE;

    IF v_current_due IS NULL THEN
        RAISE EXCEPTION 'CUSTOMER_NOT_FOUND|%', p_customer_id;
    END IF;

    UPDATE customers SET total_due = v_current_due - p_total_credited
    WHERE id = p_customer_id;

    -- ৩. product_returns টেবিলে হেডার সেভ
    INSERT INTO product_returns (
        customer_id, customer_name, customer_phone,
        subtotal, labor_cost, labor_bearer, transport_cost, transport_bearer, total_credited
    )
    VALUES (
        p_customer_id, p_customer_name, p_customer_phone,
        p_subtotal, p_labor_cost, p_labor_bearer, p_transport_cost, p_transport_bearer, p_total_credited
    )
    RETURNING id INTO v_new_return_id;

    -- ৪. product_return_items টেবিলে কার্টের আইটেম সেভ
    INSERT INTO product_return_items (return_id, product_id, quantity, rate, total_price)
    SELECT
        v_new_return_id,
        (i->>'product_id')::int,
        (i->>'quantity')::numeric,
        (i->>'rate')::numeric,
        (i->>'total_price')::numeric
    FROM jsonb_array_elements(p_cart) AS i;

    RETURN jsonb_build_object('message', 'মাল ফেরত সফলভাবে সংরক্ষিত হয়েছে', 'returnId', v_new_return_id);
END;
$$;