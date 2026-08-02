-- ============================================================
-- Module 04 (addendum): SALES.CUSTOMER_ID
-- ============================================================
-- এতদিন sales টেবিলে কোনো customer_id ছিল না — কাস্টমার চেনা হতো
-- customer_name/customer_phone টেক্সট মিলিয়ে। এই migration সেই
-- ফাঁকটা ভরাট করে — নতুন column + পুরনো ডেটা ব্যাকফিল।
--
-- অনিবন্ধিত কাস্টমার (নাম-ঠিকানা ছাড়া নগদ বিক্রি) ইচ্ছাকৃতভাবে
-- customer_id = NULL রাখা হবে — তাদের কোনো customers রেকর্ডই
-- নেই, তাই জোড়া লাগানোর কিছু নেই। এটা bug না, design।
--
-- Depends on: 002_customers.sql, 004_billing.sql, 006_customer_phones.sql
-- ============================================================

ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_id BIGINT REFERENCES customers(id);

CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON sales (customer_id);

-- ------------------------------------------------------------
-- ধাপ ১ — ফোন নাম্বার মিলিয়ে ব্যাকফিল (সবচেয়ে নির্ভরযোগ্য, কারণ
-- customer_phones.phone globally UNIQUE, তাই একাধিক কাস্টমারের
-- সাথে ভুল করে মেলার সুযোগ নেই)
-- ------------------------------------------------------------
UPDATE sales s
SET customer_id = cp.customer_id
FROM customer_phones cp
WHERE s.customer_id IS NULL
  AND s.customer_name <> 'অনিবন্ধিত কাস্টমার'
  AND s.customer_phone IS NOT NULL
  AND s.customer_phone <> ''
  AND cp.phone = s.customer_phone;

-- ------------------------------------------------------------
-- ধাপ ২ — যাদের ফোন নেই, তাদের নাম মিলিয়ে ব্যাকফিল, কিন্তু শুধু
-- তখনই যখন সেই নামে (ফোন-ছাড়া কাস্টমারদের মধ্যে) ঠিক একজনই আছে।
-- একই নামে একাধিক ফোন-ছাড়া কাস্টমার থাকলে সেটা অস্পষ্ট (ambiguous)
-- ধরে NULL-ই রেখে দেওয়া হবে — ভুল কাস্টমারের সাথে জোড়া লাগানোর
-- চেয়ে NULL রাখা নিরাপদ, পরে ম্যানুয়ালি ঠিক করা যায়।
-- ------------------------------------------------------------
UPDATE sales s
SET customer_id = c.id
FROM customers c
WHERE s.customer_id IS NULL
  AND s.customer_name <> 'অনিবন্ধিত কাস্টমার'
  AND (s.customer_phone IS NULL OR s.customer_phone = '')
  AND c.name = s.customer_name
  AND (c.phone IS NULL OR c.phone = '')
  AND (
        SELECT count(*) FROM customers c2
        WHERE c2.name = s.customer_name AND (c2.phone IS NULL OR c2.phone = '')
      ) = 1;

-- ------------------------------------------------------------
-- যাচাই — migration চালানোর পর এটা আলাদাভাবে চালিয়ে দেখুন কতগুলো
-- sale ব্যাকফিল হলো, কতগুলো বাকি রইলো (অনিবন্ধিত বাদে)।
-- অনেকগুলো "unmatched (needs review)" থাকলে সেগুলো ম্যানুয়ালি
-- চেক করা উচিত, নাহলে ওই বিলগুলো লেজারে দেখাবে না।
-- ------------------------------------------------------------
-- SELECT
--     CASE
--         WHEN customer_name = 'অনিবন্ধিত কাস্টমার' THEN 'walk-in (intentional NULL)'
--         WHEN customer_id IS NOT NULL THEN 'matched'
--         ELSE 'unmatched (needs review)'
--     END AS status,
--     count(*)
-- FROM sales
-- GROUP BY 1
-- ORDER BY 1;
