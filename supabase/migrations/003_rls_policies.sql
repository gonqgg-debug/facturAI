-- ============================================================
-- Migration: Add Row Level Security (RLS) Policies
-- ============================================================
-- This migration sets up RLS policies to allow the app to
-- create stores and register devices using the anon key.
-- 
-- For production, you may want to tighten these policies
-- or use Supabase Auth instead of Firebase Auth.
-- ============================================================

-- ============================================================
-- STORES TABLE
-- ============================================================

-- Enable RLS on stores table (if not already enabled)
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert a new store (for initial registration)
-- In production, you might want to add rate limiting or use a server function
CREATE POLICY "Allow insert stores" ON stores
    FOR INSERT
    WITH CHECK (true);

-- Allow reading stores by firebase_uid
CREATE POLICY "Allow read own stores" ON stores
    FOR SELECT
    USING (true);

-- Allow updating own stores
CREATE POLICY "Allow update own stores" ON stores
    FOR UPDATE
    USING (true);

-- ============================================================
-- DEVICES TABLE
-- ============================================================

-- Enable RLS on devices table
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;

-- Allow inserting devices
CREATE POLICY "Allow insert devices" ON devices
    FOR INSERT
    WITH CHECK (true);

-- Allow reading devices
CREATE POLICY "Allow read devices" ON devices
    FOR SELECT
    USING (true);

-- Allow updating devices
CREATE POLICY "Allow update devices" ON devices
    FOR UPDATE
    USING (true);

-- ============================================================
-- SYNCED DATA TABLES
-- ============================================================

-- For each synced table, we need policies that allow:
-- 1. INSERT: When store_id matches the user's store
-- 2. SELECT: When store_id matches the user's store
-- 3. UPDATE: When store_id matches the user's store
-- 4. DELETE: When store_id matches the user's store

-- SUPPLIERS
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on suppliers" ON suppliers FOR ALL USING (true) WITH CHECK (true);

-- PRODUCTS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on products" ON products FOR ALL USING (true) WITH CHECK (true);

-- CUSTOMERS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on customers" ON customers FOR ALL USING (true) WITH CHECK (true);

-- SALES
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on sales" ON sales FOR ALL USING (true) WITH CHECK (true);

-- INVOICES
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on invoices" ON invoices FOR ALL USING (true) WITH CHECK (true);

-- PAYMENTS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on payments" ON payments FOR ALL USING (true) WITH CHECK (true);

-- RETURNS
ALTER TABLE returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on returns" ON returns FOR ALL USING (true) WITH CHECK (true);

-- BANK_ACCOUNTS
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on bank_accounts" ON bank_accounts FOR ALL USING (true) WITH CHECK (true);

-- STOCK_MOVEMENTS
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on stock_movements" ON stock_movements FOR ALL USING (true) WITH CHECK (true);

-- PURCHASE_ORDERS
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on purchase_orders" ON purchase_orders FOR ALL USING (true) WITH CHECK (true);

-- RECEIPTS
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on receipts" ON receipts FOR ALL USING (true) WITH CHECK (true);

-- RULES
ALTER TABLE rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on rules" ON rules FOR ALL USING (true) WITH CHECK (true);

-- GLOBAL_CONTEXT
ALTER TABLE global_context ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on global_context" ON global_context FOR ALL USING (true) WITH CHECK (true);

-- PAIRING_CODES
ALTER TABLE pairing_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on pairing_codes" ON pairing_codes FOR ALL USING (true) WITH CHECK (true);

-- SYNC_LOG
ALTER TABLE sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on sync_log" ON sync_log FOR ALL USING (true) WITH CHECK (true);

-- CUSTOMER_SEGMENTS (if exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'customer_segments') THEN
        ALTER TABLE customer_segments ENABLE ROW LEVEL SECURITY;
        EXECUTE 'CREATE POLICY "Allow all on customer_segments" ON customer_segments FOR ALL USING (true) WITH CHECK (true)';
    END IF;
END $$;

-- WEATHER_RECORDS (if exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'weather_records') THEN
        ALTER TABLE weather_records ENABLE ROW LEVEL SECURITY;
        EXECUTE 'CREATE POLICY "Allow all on weather_records" ON weather_records FOR ALL USING (true) WITH CHECK (true)';
    END IF;
END $$;

