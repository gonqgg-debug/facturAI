-- Migration: Fix schema mismatches between local Dexie and Supabase
-- Created: 2026-01-19
-- 
-- Fixes:
-- 1. cost_consumptions.lot_id should be nullable (for legacy data without FIFO lots)
-- 2. journal_entries schema needs to support lines array (JSONB)

-- ============================================================
-- 1. FIX cost_consumptions - make lot_id nullable
-- ============================================================

-- First drop the foreign key constraint
ALTER TABLE cost_consumptions DROP CONSTRAINT IF EXISTS cost_consumptions_lot_id_fkey;

-- Make lot_id nullable
ALTER TABLE cost_consumptions ALTER COLUMN lot_id DROP NOT NULL;

-- Also drop product_id FK constraint since product might not exist in products table yet
ALTER TABLE cost_consumptions DROP CONSTRAINT IF EXISTS cost_consumptions_product_id_fkey;
ALTER TABLE cost_consumptions ALTER COLUMN product_id TYPE TEXT;

-- Also make type nullable with a default
ALTER TABLE cost_consumptions ALTER COLUMN type DROP NOT NULL;
ALTER TABLE cost_consumptions ALTER COLUMN type SET DEFAULT 'sale';

-- Drop the CHECK constraint on type to allow any value
ALTER TABLE cost_consumptions DROP CONSTRAINT IF EXISTS cost_consumptions_type_check;

-- ============================================================
-- 2. FIX journal_entries - change to match local schema
-- ============================================================

-- The local JournalEntry has a 'lines' array instead of single debit_account/credit_account
-- Drop NOT NULL constraints and add a lines JSONB column

-- Make debit_account and credit_account nullable
ALTER TABLE journal_entries ALTER COLUMN debit_account DROP NOT NULL;
ALTER TABLE journal_entries ALTER COLUMN credit_account DROP NOT NULL;

-- Add lines column as JSONB (array of journal entry lines)
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS lines JSONB DEFAULT '[]'::jsonb;

-- Add total_debit and total_credit columns
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS total_debit DECIMAL(12,2) DEFAULT 0;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS total_credit DECIMAL(12,2) DEFAULT 0;

-- Also fix the amount column to be nullable (total is calculated from lines)
ALTER TABLE journal_entries ALTER COLUMN amount DROP NOT NULL;

-- ============================================================
-- 3. FIX inventory_lots - relax constraints for sync
-- ============================================================

-- Make product_id a TEXT field instead of UUID with FK (more flexible for sync)
ALTER TABLE inventory_lots DROP CONSTRAINT IF EXISTS inventory_lots_product_id_fkey;
ALTER TABLE inventory_lots ALTER COLUMN product_id TYPE TEXT;

-- Make invoice_id and receipt_id nullable TEXT
ALTER TABLE inventory_lots DROP CONSTRAINT IF EXISTS inventory_lots_invoice_id_fkey;
ALTER TABLE inventory_lots DROP CONSTRAINT IF EXISTS inventory_lots_receipt_id_fkey;
ALTER TABLE inventory_lots ALTER COLUMN invoice_id TYPE TEXT;
ALTER TABLE inventory_lots ALTER COLUMN receipt_id TYPE TEXT;

-- ============================================================
-- 4. Update RLS policies for these tables (use EXISTS pattern)
-- ============================================================

-- cost_consumptions
DROP POLICY IF EXISTS "cost_consumptions_all_policy" ON cost_consumptions;
CREATE POLICY "cost_consumptions_select" ON cost_consumptions FOR SELECT
    USING (EXISTS (SELECT 1 FROM stores WHERE stores.id = cost_consumptions.store_id));
CREATE POLICY "cost_consumptions_insert" ON cost_consumptions FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM stores WHERE stores.id = cost_consumptions.store_id));
CREATE POLICY "cost_consumptions_update" ON cost_consumptions FOR UPDATE
    USING (EXISTS (SELECT 1 FROM stores WHERE stores.id = cost_consumptions.store_id))
    WITH CHECK (EXISTS (SELECT 1 FROM stores WHERE stores.id = cost_consumptions.store_id));
CREATE POLICY "cost_consumptions_delete" ON cost_consumptions FOR DELETE
    USING (EXISTS (SELECT 1 FROM stores WHERE stores.id = cost_consumptions.store_id));

-- journal_entries
DROP POLICY IF EXISTS "journal_entries_all_policy" ON journal_entries;
CREATE POLICY "journal_entries_select" ON journal_entries FOR SELECT
    USING (EXISTS (SELECT 1 FROM stores WHERE stores.id = journal_entries.store_id));
CREATE POLICY "journal_entries_insert" ON journal_entries FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM stores WHERE stores.id = journal_entries.store_id));
CREATE POLICY "journal_entries_update" ON journal_entries FOR UPDATE
    USING (EXISTS (SELECT 1 FROM stores WHERE stores.id = journal_entries.store_id))
    WITH CHECK (EXISTS (SELECT 1 FROM stores WHERE stores.id = journal_entries.store_id));
CREATE POLICY "journal_entries_delete" ON journal_entries FOR DELETE
    USING (EXISTS (SELECT 1 FROM stores WHERE stores.id = journal_entries.store_id));

-- inventory_lots
DROP POLICY IF EXISTS "inventory_lots_all_policy" ON inventory_lots;
CREATE POLICY "inventory_lots_select" ON inventory_lots FOR SELECT
    USING (EXISTS (SELECT 1 FROM stores WHERE stores.id = inventory_lots.store_id));
CREATE POLICY "inventory_lots_insert" ON inventory_lots FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM stores WHERE stores.id = inventory_lots.store_id));
CREATE POLICY "inventory_lots_update" ON inventory_lots FOR UPDATE
    USING (EXISTS (SELECT 1 FROM stores WHERE stores.id = inventory_lots.store_id))
    WITH CHECK (EXISTS (SELECT 1 FROM stores WHERE stores.id = inventory_lots.store_id));
CREATE POLICY "inventory_lots_delete" ON inventory_lots FOR DELETE
    USING (EXISTS (SELECT 1 FROM stores WHERE stores.id = inventory_lots.store_id));

-- ============================================================
-- 5. FIX products - increase numeric precision to avoid overflow
-- ============================================================

-- Increase precision for decimal fields that might overflow
ALTER TABLE products ALTER COLUMN last_price TYPE DECIMAL(15,4);
ALTER TABLE products ALTER COLUMN average_cost TYPE DECIMAL(15,4);
ALTER TABLE products ALTER COLUMN selling_price TYPE DECIMAL(15,4);
ALTER TABLE products ALTER COLUMN sales_velocity TYPE DECIMAL(15,4);
ALTER TABLE products ALTER COLUMN tax_rate TYPE DECIMAL(10,6);
ALTER TABLE products ALTER COLUMN cost_tax_rate TYPE DECIMAL(10,6);
ALTER TABLE products ALTER COLUMN target_margin TYPE DECIMAL(10,6);
ALTER TABLE products ALTER COLUMN ai_suggested_price TYPE DECIMAL(15,4);
ALTER TABLE products ALTER COLUMN ai_suggested_margin TYPE DECIMAL(10,6);

-- Also fix current_stock to allow larger numbers and decimals (for fractional units)
ALTER TABLE products ALTER COLUMN current_stock TYPE DECIMAL(15,4);

-- ============================================================
-- 6. FIX other tables that might have similar issues
-- ============================================================

-- invoices
ALTER TABLE invoices ALTER COLUMN subtotal TYPE DECIMAL(15,4);
ALTER TABLE invoices ALTER COLUMN discount TYPE DECIMAL(15,4);
ALTER TABLE invoices ALTER COLUMN itbis_total TYPE DECIMAL(15,4);
ALTER TABLE invoices ALTER COLUMN total TYPE DECIMAL(15,4);

-- sales
ALTER TABLE sales ALTER COLUMN subtotal TYPE DECIMAL(15,4);
ALTER TABLE sales ALTER COLUMN discount TYPE DECIMAL(15,4);
ALTER TABLE sales ALTER COLUMN itbis_total TYPE DECIMAL(15,4);
ALTER TABLE sales ALTER COLUMN total TYPE DECIMAL(15,4);

-- purchase_orders
ALTER TABLE purchase_orders ALTER COLUMN subtotal TYPE DECIMAL(15,4);
ALTER TABLE purchase_orders ALTER COLUMN itbis_total TYPE DECIMAL(15,4);
ALTER TABLE purchase_orders ALTER COLUMN total TYPE DECIMAL(15,4);

-- receipts
ALTER TABLE receipts ALTER COLUMN total TYPE DECIMAL(15,4);

-- payments
ALTER TABLE payments ALTER COLUMN amount TYPE DECIMAL(15,4);

-- cost_consumptions
ALTER TABLE cost_consumptions ALTER COLUMN unit_cost TYPE DECIMAL(15,6);
ALTER TABLE cost_consumptions ALTER COLUMN total_cost TYPE DECIMAL(15,4);

-- journal_entries
ALTER TABLE journal_entries ALTER COLUMN amount TYPE DECIMAL(15,4);
ALTER TABLE journal_entries ALTER COLUMN total_debit TYPE DECIMAL(15,4);
ALTER TABLE journal_entries ALTER COLUMN total_credit TYPE DECIMAL(15,4);

-- ============================================================
-- Summary of changes:
-- ============================================================
-- 1. cost_consumptions.lot_id: now nullable, no FK constraint
-- 2. cost_consumptions.product_id: now TEXT, no FK constraint
-- 3. cost_consumptions.type: nullable with default, no CHECK constraint
-- 4. journal_entries: debit_account, credit_account, amount all nullable
-- 5. journal_entries: added lines JSONB, total_debit, total_credit columns
-- 6. inventory_lots: product_id, invoice_id, receipt_id are now TEXT without FK
-- 7. products: increased precision for all DECIMAL fields
-- 8. invoices, sales, purchase_orders, receipts, payments: increased DECIMAL precision
-- 9. Updated RLS policies to use EXISTS pattern for cost_consumptions, journal_entries, inventory_lots

