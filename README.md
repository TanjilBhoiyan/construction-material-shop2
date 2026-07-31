# Database Migrations

এই ফোল্ডারে Supabase-এ ম্যানুয়ালি রান করা SQL ফাংশন/মাইগ্রেশনগুলো রাখা হয়।
এগুলো কোডে অটোমেটিক্যালি রান হয় না — নতুন environment সেটাপ করার সময়
Supabase SQL Editor-এ গিয়ে এই ফাইলগুলো একে একে (নাম্বার অনুযায়ী) রান করতে হবে।

## 001_process_checkout.sql
Billing checkout-এর পুরো লজিক (স্টক চেক, কাস্টমার লেজার আপডেট, sale + sale_items সেভ)
একটা atomic transaction হিসেবে চালানোর জন্য। ব্যবহার হয়:
`backend/src/modules/billing/billing.repository.js` → `checkoutRPC()` থেকে,
`billing.service.js` → `processCheckoutBusinessLogic()` এই ফাংশনটা কল করে।

কেন DB-তে রাখা হয়েছে (JS-এ না): checkout-এ ৪টা আলাদা ধাপ (স্টক কমানো, কাস্টমার
due আপডেট, sale insert, sale_items insert) — একটা ফেল করলে বাকিগুলো যেন
স্বয়ংক্রিয়ভাবে বাতিল হয়ে যায়, সেই গ্যারান্টি শুধু ডাটাবেজ-লেভেল transaction
দিয়েই সম্ভব।



# Inventory (ইনভেন্টরি)- kaj baki ase
    1.
    2.
    3.
    4.Invoice print korar functionality
    5.
    6.
    7.
    8.
    9.
    10.
# Noton Bill(Bikroy) নতুন বিল (বিক্রয়)- kaj baki ase
    1.
    2.
    3.
    4.Mobile number 11 digit er kom ba besi hoite parbe na 
    5.Ekadik mobile number add korte parbo 
    6.
    7.Mal kinar por firok neyar feature 
    8. 
    9.
    10.
# Hisab o Report (হিসাব ও রিপোর্ট)- kaj baki ase
    1. 
    2.
    3.
    4.
    5.
    6.
    7.
    8.
    9.
    10.
# Customer Khotiyan (কাস্টমার খতিয়ান)- kaj baki ase
    1.
    2.
    3.
    4.
    5.
    6.
    7.
    8. প্রিন্ট বা পিডিএফ ডাউনলোড বাটন (Print/PDF): কাস্টমার যখন দোকানে এসে তার পুরো খাতার হিসাব চাবে, তখন তাকে একটা প্রিন্ট কপি বা হোয়াটসঅ্যাপে পাঠানোর জন্য পিডিএফ (PDF) দেওয়ার কোনো অপশন      রাখবেন কিনা।
    9.
    10.