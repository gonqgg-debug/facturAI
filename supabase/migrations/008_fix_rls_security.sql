-- ============================================================
-- Migration: Fix RLS Security for Multi-Tenant Isolation
-- ============================================================
-- This migration replaces the permissive USING(true) policies
-- from migration 003 with proper tenant isolation using store_id.
--
-- The app must call set_store_context(store_id) before any
-- database operations to set the tenant context.
-- ============================================================

-- ============================================================
-- STEP 1: CREATE STORE CONTEXT FUNCTION
-- ============================================================

-- Function to set store context (called from app before queries)
-- This sets a session variable that RLS policies will check
CREATE OR REPLACE FUNCTION set_store_context(p_store_id UUID)
RETURNS void AS $$
BEGIN
    PERFORM set_config('app.store_id', p_store_id::text, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to anon and authenticated roles
GRANT EXECUTE ON FUNCTION set_store_context(UUID) TO anon;
GRANT EXECUTE ON FUNCTION set_store_context(UUID) TO authenticated;

-- Helper function to get current store context safely
CREATE OR REPLACE FUNCTION get_store_context()
RETURNS UUID AS $$
DECLARE
    store_id_text TEXT;
BEGIN
    store_id_text := current_setting('app.store_id', true);
    IF store_id_text IS NULL OR store_id_text = '' THEN
        RETURN NULL;
    END IF;
    RETURN store_id_text::UUID;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION get_store_context() TO anon;
GRANT EXECUTE ON FUNCTION get_store_context() TO authenticated;

-- ============================================================
-- STEP 2: DROP ALL PERMISSIVE POLICIES FROM MIGRATION 003
-- ============================================================

-- Stores table policies
DROP POLICY IF EXISTS "Allow insert stores" ON stores;
DROP POLICY IF EXISTS "Allow read own stores" ON stores;
DROP POLICY IF EXISTS "Allow update own stores" ON stores;

-- Devices table policies
DROP POLICY IF EXISTS "Allow insert devices" ON devices;
DROP POLICY IF EXISTS "Allow read devices" ON devices;
DROP POLICY IF EXISTS "Allow update devices" ON devices;

-- Business data table policies
DROP POLICY IF EXISTS "Allow all on suppliers" ON suppliers;
DROP POLICY IF EXISTS "Allow all on products" ON products;
DROP POLICY IF EXISTS "Allow all on customers" ON customers;
DROP POLICY IF EXISTS "Allow all on sales" ON sales;
DROP POLICY IF EXISTS "Allow all on invoices" ON invoices;
DROP POLICY IF EXISTS "Allow all on payments" ON payments;
DROP POLICY IF EXISTS "Allow all on returns" ON returns;
DROP POLICY IF EXISTS "Allow all on bank_accounts" ON bank_accounts;
DROP POLICY IF EXISTS "Allow all on stock_movements" ON stock_movements;
DROP POLICY IF EXISTS "Allow all on purchase_orders" ON purchase_orders;
DROP POLICY IF EXISTS "Allow all on receipts" ON receipts;
DROP POLICY IF EXISTS "Allow all on rules" ON rules;
DROP POLICY IF EXISTS "Allow all on global_context" ON global_context;
DROP POLICY IF EXISTS "Allow all on pairing_codes" ON pairing_codes;
DROP POLICY IF EXISTS "Allow all on sync_log" ON sync_log;

-- Optional tables (may not exist)
DROP POLICY IF EXISTS "Allow all on customer_segments" ON customer_segments;
DROP POLICY IF EXISTS "Allow all on weather_records" ON weather_records;

-- ============================================================
-- STEP 3: CREATE PROPER TENANT-ISOLATED POLICIES
-- ============================================================

-- ------------------------------------------------------------
-- STORES TABLE - Special handling
-- ------------------------------------------------------------
-- INSERT: Allow anyone (for new store registration)
-- SELECT: Allow reading own store (by firebase_uid) OR when context is set
-- UPDATE: Only own store

CREATE POLICY "stores_insert_policy" ON stores
    FOR INSERT
    WITH CHECK (true);  -- Anyone can create a new store

CREATE POLICY "stores_select_policy" ON stores
    FOR SELECT
    USING (
        id = get_store_context()  -- Can read if context matches
        OR firebase_uid IS NOT NULL  -- Or any store with firebase_uid (for lookup during registration)
    );

CREATE POLICY "stores_update_policy" ON stores
    FOR UPDATE
    USING (id = get_store_context())
    WITH CHECK (id = get_store_context());

CREATE POLICY "stores_delete_policy" ON stores
    FOR DELETE
    USING (id = get_store_context());

-- ------------------------------------------------------------
-- DEVICES TABLE - Special handling
-- ------------------------------------------------------------
-- Need to allow device registration before context is fully set

CREATE POLICY "devices_insert_policy" ON devices
    FOR INSERT
    WITH CHECK (
        store_id = get_store_context()
        OR get_store_context() IS NULL  -- Allow during initial registration
    );

CREATE POLICY "devices_select_policy" ON devices
    FOR SELECT
    USING (
        store_id = get_store_context()
        OR get_store_context() IS NULL  -- Allow lookup during registration
    );

CREATE POLICY "devices_update_policy" ON devices
    FOR UPDATE
    USING (store_id = get_store_context())
    WITH CHECK (store_id = get_store_context());

CREATE POLICY "devices_delete_policy" ON devices
    FOR DELETE
    USING (store_id = get_store_context());

-- ------------------------------------------------------------
-- PAIRING_CODES TABLE
-- ------------------------------------------------------------

CREATE POLICY "pairing_codes_insert_policy" ON pairing_codes
    FOR INSERT
    WITH CHECK (store_id = get_store_context());

CREATE POLICY "pairing_codes_select_policy" ON pairing_codes
    FOR SELECT
    USING (
        store_id = get_store_context()
        OR get_store_context() IS NULL  -- Allow lookup during device pairing
    );

CREATE POLICY "pairing_codes_update_policy" ON pairing_codes
    FOR UPDATE
    USING (store_id = get_store_context())
    WITH CHECK (store_id = get_store_context());

CREATE POLICY "pairing_codes_delete_policy" ON pairing_codes
    FOR DELETE
    USING (store_id = get_store_context());

-- ------------------------------------------------------------
-- SUPPLIERS TABLE
-- ------------------------------------------------------------

CREATE POLICY "suppliers_select_policy" ON suppliers
    FOR SELECT
    USING (store_id = get_store_context());

CREATE POLICY "suppliers_insert_policy" ON suppliers
    FOR INSERT
    WITH CHECK (store_id = get_store_context());

CREATE POLICY "suppliers_update_policy" ON suppliers
    FOR UPDATE
    USING (store_id = get_store_context())
    WITH CHECK (store_id = get_store_context());

CREATE POLICY "suppliers_delete_policy" ON suppliers
    FOR DELETE
    USING (store_id = get_store_context());

-- ------------------------------------------------------------
-- PRODUCTS TABLE
-- ------------------------------------------------------------

CREATE POLICY "products_select_policy" ON products
    FOR SELECT
    USING (store_id = get_store_context());

CREATE POLICY "products_insert_policy" ON products
    FOR INSERT
    WITH CHECK (store_id = get_store_context());

CREATE POLICY "products_update_policy" ON products
    FOR UPDATE
    USING (store_id = get_store_context())
    WITH CHECK (store_id = get_store_context());

CREATE POLICY "products_delete_policy" ON products
    FOR DELETE
    USING (store_id = get_store_context());

-- ------------------------------------------------------------
-- CUSTOMERS TABLE
-- ------------------------------------------------------------

CREATE POLICY "customers_select_policy" ON customers
    FOR SELECT
    USING (store_id = get_store_context());

CREATE POLICY "customers_insert_policy" ON customers
    FOR INSERT
    WITH CHECK (store_id = get_store_context());

CREATE POLICY "customers_update_policy" ON customers
    FOR UPDATE
    USING (store_id = get_store_context())
    WITH CHECK (store_id = get_store_context());

CREATE POLICY "customers_delete_policy" ON customers
    FOR DELETE
    USING (store_id = get_store_context());

-- ------------------------------------------------------------
-- SALES TABLE
-- ------------------------------------------------------------

CREATE POLICY "sales_select_policy" ON sales
    FOR SELECT
    USING (store_id = get_store_context());

CREATE POLICY "sales_insert_policy" ON sales
    FOR INSERT
    WITH CHECK (store_id = get_store_context());

CREATE POLICY "sales_update_policy" ON sales
    FOR UPDATE
    USING (store_id = get_store_context())
    WITH CHECK (store_id = get_store_context());

CREATE POLICY "sales_delete_policy" ON sales
    FOR DELETE
    USING (store_id = get_store_context());

-- ------------------------------------------------------------
-- INVOICES TABLE
-- ------------------------------------------------------------

CREATE POLICY "invoices_select_policy" ON invoices
    FOR SELECT
    USING (store_id = get_store_context());

CREATE POLICY "invoices_insert_policy" ON invoices
    FOR INSERT
    WITH CHECK (store_id = get_store_context());

CREATE POLICY "invoices_update_policy" ON invoices
    FOR UPDATE
    USING (store_id = get_store_context())
    WITH CHECK (store_id = get_store_context());

CREATE POLICY "invoices_delete_policy" ON invoices
    FOR DELETE
    USING (store_id = get_store_context());

-- ------------------------------------------------------------
-- PAYMENTS TABLE
-- ------------------------------------------------------------

CREATE POLICY "payments_select_policy" ON payments
    FOR SELECT
    USING (store_id = get_store_context());

CREATE POLICY "payments_insert_policy" ON payments
    FOR INSERT
    WITH CHECK (store_id = get_store_context());

CREATE POLICY "payments_update_policy" ON payments
    FOR UPDATE
    USING (store_id = get_store_context())
    WITH CHECK (store_id = get_store_context());

CREATE POLICY "payments_delete_policy" ON payments
    FOR DELETE
    USING (store_id = get_store_context());

-- ------------------------------------------------------------
-- RETURNS TABLE
-- ------------------------------------------------------------

CREATE POLICY "returns_select_policy" ON returns
    FOR SELECT
    USING (store_id = get_store_context());

CREATE POLICY "returns_insert_policy" ON returns
    FOR INSERT
    WITH CHECK (store_id = get_store_context());

CREATE POLICY "returns_update_policy" ON returns
    FOR UPDATE
    USING (store_id = get_store_context())
    WITH CHECK (store_id = get_store_context());

CREATE POLICY "returns_delete_policy" ON returns
    FOR DELETE
    USING (store_id = get_store_context());

-- ------------------------------------------------------------
-- BANK_ACCOUNTS TABLE
-- ------------------------------------------------------------

CREATE POLICY "bank_accounts_select_policy" ON bank_accounts
    FOR SELECT
    USING (store_id = get_store_context());

CREATE POLICY "bank_accounts_insert_policy" ON bank_accounts
    FOR INSERT
    WITH CHECK (store_id = get_store_context());

CREATE POLICY "bank_accounts_update_policy" ON bank_accounts
    FOR UPDATE
    USING (store_id = get_store_context())
    WITH CHECK (store_id = get_store_context());

CREATE POLICY "bank_accounts_delete_policy" ON bank_accounts
    FOR DELETE
    USING (store_id = get_store_context());

-- ------------------------------------------------------------
-- STOCK_MOVEMENTS TABLE
-- ------------------------------------------------------------

CREATE POLICY "stock_movements_select_policy" ON stock_movements
    FOR SELECT
    USING (store_id = get_store_context());

CREATE POLICY "stock_movements_insert_policy" ON stock_movements
    FOR INSERT
    WITH CHECK (store_id = get_store_context());

CREATE POLICY "stock_movements_update_policy" ON stock_movements
    FOR UPDATE
    USING (store_id = get_store_context())
    WITH CHECK (store_id = get_store_context());

CREATE POLICY "stock_movements_delete_policy" ON stock_movements
    FOR DELETE
    USING (store_id = get_store_context());

-- ------------------------------------------------------------
-- PURCHASE_ORDERS TABLE
-- ------------------------------------------------------------

CREATE POLICY "purchase_orders_select_policy" ON purchase_orders
    FOR SELECT
    USING (store_id = get_store_context());

CREATE POLICY "purchase_orders_insert_policy" ON purchase_orders
    FOR INSERT
    WITH CHECK (store_id = get_store_context());

CREATE POLICY "purchase_orders_update_policy" ON purchase_orders
    FOR UPDATE
    USING (store_id = get_store_context())
    WITH CHECK (store_id = get_store_context());

CREATE POLICY "purchase_orders_delete_policy" ON purchase_orders
    FOR DELETE
    USING (store_id = get_store_context());

-- ------------------------------------------------------------
-- RECEIPTS TABLE
-- ------------------------------------------------------------

CREATE POLICY "receipts_select_policy" ON receipts
    FOR SELECT
    USING (store_id = get_store_context());

CREATE POLICY "receipts_insert_policy" ON receipts
    FOR INSERT
    WITH CHECK (store_id = get_store_context());

CREATE POLICY "receipts_update_policy" ON receipts
    FOR UPDATE
    USING (store_id = get_store_context())
    WITH CHECK (store_id = get_store_context());

CREATE POLICY "receipts_delete_policy" ON receipts
    FOR DELETE
    USING (store_id = get_store_context());

-- ------------------------------------------------------------
-- RULES TABLE
-- ------------------------------------------------------------

CREATE POLICY "rules_select_policy" ON rules
    FOR SELECT
    USING (store_id = get_store_context());

CREATE POLICY "rules_insert_policy" ON rules
    FOR INSERT
    WITH CHECK (store_id = get_store_context());

CREATE POLICY "rules_update_policy" ON rules
    FOR UPDATE
    USING (store_id = get_store_context())
    WITH CHECK (store_id = get_store_context());

CREATE POLICY "rules_delete_policy" ON rules
    FOR DELETE
    USING (store_id = get_store_context());

-- ------------------------------------------------------------
-- GLOBAL_CONTEXT TABLE
-- ------------------------------------------------------------

CREATE POLICY "global_context_select_policy" ON global_context
    FOR SELECT
    USING (store_id = get_store_context());

CREATE POLICY "global_context_insert_policy" ON global_context
    FOR INSERT
    WITH CHECK (store_id = get_store_context());

CREATE POLICY "global_context_update_policy" ON global_context
    FOR UPDATE
    USING (store_id = get_store_context())
    WITH CHECK (store_id = get_store_context());

CREATE POLICY "global_context_delete_policy" ON global_context
    FOR DELETE
    USING (store_id = get_store_context());

-- ------------------------------------------------------------
-- SYNC_LOG TABLE
-- ------------------------------------------------------------

CREATE POLICY "sync_log_select_policy" ON sync_log
    FOR SELECT
    USING (store_id = get_store_context());

CREATE POLICY "sync_log_insert_policy" ON sync_log
    FOR INSERT
    WITH CHECK (store_id = get_store_context());

CREATE POLICY "sync_log_update_policy" ON sync_log
    FOR UPDATE
    USING (store_id = get_store_context())
    WITH CHECK (store_id = get_store_context());

CREATE POLICY "sync_log_delete_policy" ON sync_log
    FOR DELETE
    USING (store_id = get_store_context());

-- ------------------------------------------------------------
-- CUSTOMER_SEGMENTS TABLE (optional, may not exist)
-- ------------------------------------------------------------

DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'customer_segments') THEN
        EXECUTE 'CREATE POLICY "customer_segments_select_policy" ON customer_segments FOR SELECT USING (store_id = get_store_context())';
        EXECUTE 'CREATE POLICY "customer_segments_insert_policy" ON customer_segments FOR INSERT WITH CHECK (store_id = get_store_context())';
        EXECUTE 'CREATE POLICY "customer_segments_update_policy" ON customer_segments FOR UPDATE USING (store_id = get_store_context()) WITH CHECK (store_id = get_store_context())';
        EXECUTE 'CREATE POLICY "customer_segments_delete_policy" ON customer_segments FOR DELETE USING (store_id = get_store_context())';
    END IF;
END $$;

-- ------------------------------------------------------------
-- WEATHER_RECORDS TABLE (optional, may not exist)
-- ------------------------------------------------------------

DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'weather_records') THEN
        EXECUTE 'CREATE POLICY "weather_records_select_policy" ON weather_records FOR SELECT USING (store_id = get_store_context())';
        EXECUTE 'CREATE POLICY "weather_records_insert_policy" ON weather_records FOR INSERT WITH CHECK (store_id = get_store_context())';
        EXECUTE 'CREATE POLICY "weather_records_update_policy" ON weather_records FOR UPDATE USING (store_id = get_store_context()) WITH CHECK (store_id = get_store_context())';
        EXECUTE 'CREATE POLICY "weather_records_delete_policy" ON weather_records FOR DELETE USING (store_id = get_store_context())';
    END IF;
END $$;

-- ============================================================
-- STEP 4: UPDATE EXISTING HELPER FUNCTIONS
-- ============================================================

-- Update get_changes_since to respect RLS context
CREATE OR REPLACE FUNCTION get_changes_since(
    p_store_id UUID,
    p_since TIMESTAMPTZ,
    p_table_name TEXT DEFAULT NULL
)
RETURNS TABLE (
    table_name TEXT,
    record_id UUID,
    action TEXT,
    data JSONB,
    synced_at TIMESTAMPTZ
) AS $$
BEGIN
    -- Verify the requested store_id matches the context
    IF p_store_id != get_store_context() THEN
        RAISE EXCEPTION 'Access denied: store_id mismatch';
    END IF;
    
    RETURN QUERY
    SELECT 
        sl.table_name,
        sl.record_id,
        sl.action,
        sl.data,
        sl.synced_at
    FROM sync_log sl
    WHERE sl.store_id = p_store_id
      AND sl.synced_at > p_since
      AND (p_table_name IS NULL OR sl.table_name = p_table_name)
    ORDER BY sl.synced_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update log_sync_operation to verify context
CREATE OR REPLACE FUNCTION log_sync_operation(
    p_store_id UUID,
    p_device_id UUID,
    p_table_name TEXT,
    p_record_id UUID,
    p_action TEXT,
    p_data JSONB
)
RETURNS BIGINT AS $$
DECLARE
    v_id BIGINT;
BEGIN
    -- Verify the requested store_id matches the context
    IF p_store_id != get_store_context() THEN
        RAISE EXCEPTION 'Access denied: store_id mismatch';
    END IF;
    
    INSERT INTO sync_log (store_id, device_id, table_name, record_id, action, data)
    VALUES (p_store_id, p_device_id, p_table_name, p_record_id, p_action, p_data)
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- VERIFICATION COMMENT
-- ============================================================
-- After applying this migration:
-- 1. The app MUST call set_store_context(store_id) before any DB operations
-- 2. All business data is now isolated by store_id
-- 3. New store registration still works (stores INSERT is permissive)
-- 4. Device registration during login still works (devices has fallback)
-- ============================================================

