-- "isSimulated" now means "no real money moved": demo payments always, and
-- Razorpay payments made with test-mode keys. Demo payments can still never be
-- recorded as real money.
ALTER TABLE "PaymentOrder" DROP CONSTRAINT "payment_order_simulation";
ALTER TABLE "PaymentOrder" ADD CONSTRAINT "payment_order_simulation" CHECK ("provider" <> 'DEMO' OR "isSimulated");
ALTER TABLE "Transaction" DROP CONSTRAINT "transaction_simulation";
ALTER TABLE "Transaction" ADD CONSTRAINT "transaction_simulation" CHECK ("provider" <> 'DEMO' OR "isSimulated");
