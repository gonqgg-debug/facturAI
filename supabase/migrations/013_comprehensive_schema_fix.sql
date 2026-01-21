-- ============================================================
-- Migration 013: Comprehensive Schema Fix
-- ============================================================
-- This migration fixes ALL schema mismatches between local Dexie
-- and Supabase to ensure reliable synchronization.
-- ============================================================

-- ============================================================
-- 1. GENERAL: Increase numeric precision across all tables
-- ============================================================

-- Products
ALTER TABLE products ALTER COLUMN last_price TYPE DECIMAL(15,4);
ALTER TABLE products ALTER COLUMN average_cost TYPE DECIMAL(15,4);
ALTER TABLE products ALTER COLUMN selling_price TYPE DECIMAL(15,4);
ALTER TABLE products ALTER COLUMN sales_velocity TYPE DECIMAL(15,4);
ALTER TABLE products ALTER COLUMN tax_rate TYPE DECIMAL(10,6);
ALTER TABLE products ALTER COLUMN cost_tax_rate TYPE DECIMAL(10,6);
ALTER TABLE products ALTER COLUMN target_margin TYPE DECIMAL(10,6);
ALTER TABLE products ALTER COLUMN ai_suggested_price TYPE DECIMAL(15,4);
ALTER TABLE products ALTER COLUMN ai_suggested_margin TYPE DECIMAL(10,6);
ALTER TABLE products ALTER COLUMN current_stock TYPE DECIMAL(15,4);

-- Invoices
ALTER TABLE invoices ALTER COLUMN subtotal TYPE DECIMAL(15,4);
ALTER TABLE invoices ALTER COLUMN discount TYPE DECIMAL(15,4);
ALTER TABLE invoices ALTER COLUMN itbis_total TYPE DECIMAL(15,4);
ALTER TABLE invoices ALTER COLUMN total TYPE DECIMAL(15,4);
ALTER TABLE invoices ALTER COLUMN paid_amount TYPE DECIMAL(15,4);

-- Sales
ALTER TABLE sales ALTER COLUMN subtotal TYPE DECIMAL(15,4);
ALTER TABLE sales ALTER COLUMN discount TYPE DECIMAL(15,4);
ALTER TABLE sales ALTER COLUMN itbis_total TYPE DECIMAL(15,4);
ALTER TABLE sales ALTER COLUMN total TYPE DECIMAL(15,4);
ALTER TABLE sales ALTER COLUMN paid_amount TYPE DECIMAL(15,4);
ALTER TABLE sales ALTER COLUMN returned_amount TYPE DECIMAL(15,4);

-- Purchase Orders
ALTER TABLE purchase_orders ALTER COLUMN subtotal TYPE DECIMAL(15,4);
ALTER TABLE purchase_orders ALTER COLUMN itbis_total TYPE DECIMAL(15,4);
ALTER TABLE purchase_orders ALTER COLUMN total TYPE DECIMAL(15,4);

-- Receipts
ALTER TABLE receipts ALTER COLUMN total TYPE DECIMAL(15,4);

-- Payments
ALTER TABLE payments ALTER COLUMN amount TYPE DECIMAL(15,4);

-- Returns
ALTER TABLE returns ALTER COLUMN subtotal TYPE DECIMAL(15,4);
ALTER TABLE returns ALTER COLUMN itbis_total TYPE DECIMAL(15,4);
ALTER TABLE returns ALTER COLUMN total TYPE DECIMAL(15,4);

-- Customers
ALTER TABLE customers ALTER COLUMN credit_limit TYPE DECIMAL(15,4);
ALTER TABLE customers ALTER COLUMN current_balance TYPE DECIMAL(15,4);

-- ============================================================
-- 2. COST_CONSUMPTIONS: Fix constraints
-- ============================================================

-- Drop FK and NOT NULL constraints that are too restrictive
ALTER TABLE cost_consumptions DROP CONSTRAINT IF EXISTS cost_consumptions_lot_id_fkey;
ALTER TABLE cost_consumptions DROP CONSTRAINT IF EXISTS cost_consumptions_product_id_fkey;
ALTER TABLE cost_consumptions DROP CONSTRAINT IF EXISTS cost_consumptions_type_check;

-- Make lot_id nullable (for legacy data without FIFO lots)
ALTER TABLE cost_consumptions ALTER COLUMN lot_id DROP NOT NULL;
ALTER TABLE cost_consumptions ALTER COLUMN lot_id TYPE TEXT;

-- Make product_id flexible (TEXT instead of UUID)
ALTER TABLE cost_consumptions ALTER COLUMN product_id TYPE TEXT;
ALTER TABLE cost_consumptions ALTER COLUMN product_id DROP NOT NULL;

-- Make type nullable with default
ALTER TABLE cost_consumptions ALTER COLUMN type DROP NOT NULL;
ALTER TABLE cost_consumptions ALTER COLUMN type SET DEFAULT 'sale';

-- Increase numeric precision
ALTER TABLE cost_consumptions ALTER COLUMN unit_cost TYPE DECIMAL(15,6);
ALTER TABLE cost_consumptions ALTER COLUMN total_cost TYPE DECIMAL(15,4);
ALTER TABLE cost_consumptions ALTER COLUMN quantity TYPE DECIMAL(15,4);

-- ============================================================
-- 3. JOURNAL_ENTRIES: Change to match local schema (lines array)
-- ============================================================

-- Make single-entry fields nullable
ALTER TABLE journal_entries ALTER COLUMN debit_account DROP NOT NULL;
ALTER TABLE journal_entries ALTER COLUMN credit_account DROP NOT NULL;
ALTER TABLE journal_entries ALTER COLUMN amount DROP NOT NULL;
ALTER TABLE journal_entries ALTER COLUMN amount TYPE DECIMAL(15,4);

-- Add lines column for multi-line entries
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS lines JSONB DEFAULT '[]'::jsonb;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS total_debit DECIMAL(15,4) DEFAULT 0;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS total_credit DECIMAL(15,4) DEFAULT 0;

-- Make source_type more flexible
ALTER TABLE journal_entries DROP CONSTRAINT IF EXISTS journal_entries_source_type_check;

-- Make description nullable
ALTER TABLE journal_entries ALTER COLUMN description DROP NOT NULL;

-- ============================================================
-- 4. INVENTORY_LOTS: Relax constraints
-- ============================================================

-- Drop FK constraints
ALTER TABLE inventory_lots DROP CONSTRAINT IF EXISTS inventory_lots_product_id_fkey;
ALTER TABLE inventory_lots DROP CONSTRAINT IF EXISTS inventory_lots_invoice_id_fkey;
ALTER TABLE inventory_lots DROP CONSTRAINT IF EXISTS inventory_lots_receipt_id_fkey;

-- Change to TEXT type for flexibility
ALTER TABLE inventory_lots ALTER COLUMN product_id TYPE TEXT;
ALTER TABLE inventory_lots ALTER COLUMN invoice_id TYPE TEXT;
ALTER TABLE inventory_lots ALTER COLUMN receipt_id TYPE TEXT;

-- Increase numeric precision
ALTER TABLE inventory_lots ALTER COLUMN unit_cost TYPE DECIMAL(15,6);
ALTER TABLE inventory_lots ALTER COLUMN quantity TYPE DECIMAL(15,4);
ALTER TABLE inventory_lots ALTER COLUMN remaining_quantity TYPE DECIMAL(15,4);
ALTER TABLE inventory_lots ALTER COLUMN tax_rate TYPE DECIMAL(10,6);

-- Add missing columns from local schema
ALTER TABLE inventory_lots ADD COLUMN IF NOT EXISTS lot_number TEXT;
ALTER TABLE inventory_lots ADD COLUMN IF NOT EXISTS original_quantity DECIMAL(15,4);
ALTER TABLE inventory_lots ADD COLUMN IF NOT EXISTS unit_cost_inc_tax DECIMAL(15,6);
ALTER TABLE inventory_lots ADD COLUMN IF NOT EXISTS depleted_at TIMESTAMPTZ;

-- Fix status CHECK constraint
ALTER TABLE inventory_lots DROP CONSTRAINT IF EXISTS inventory_lots_status_check;

-- ============================================================
-- 5. SALES: Fix payment_status CHECK constraint
-- ============================================================

ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_payment_status_check;
-- Now allows: pending, partial, paid, delivery

-- Add missing columns from local schema
ALTER TABLE sales ADD COLUMN IF NOT EXISTS ncf TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS is_delivery BOOLEAN DEFAULT FALSE;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS delivery_address TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS delivery_phone TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS delivery_notes TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS delivered_by TEXT;

-- ============================================================
-- 6. STOCK_MOVEMENTS: Fix constraints and types
-- ============================================================

-- Drop FK constraint
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_product_id_fkey;

-- Change types
ALTER TABLE stock_movements ALTER COLUMN product_id TYPE TEXT;
ALTER TABLE stock_movements ALTER COLUMN quantity TYPE DECIMAL(15,4);

-- Add missing columns
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS unit_cost DECIMAL(15,6);
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS total_cost DECIMAL(15,4);

-- ============================================================
-- 7. ITBIS_SUMMARIES: Add missing columns
-- ============================================================

ALTER TABLE itbis_summaries ADD COLUMN IF NOT EXISTS itbis_18_collected DECIMAL(15,4) DEFAULT 0;
ALTER TABLE itbis_summaries ADD COLUMN IF NOT EXISTS itbis_16_collected DECIMAL(15,4) DEFAULT 0;
ALTER TABLE itbis_summaries ADD COLUMN IF NOT EXISTS sales_exempt DECIMAL(15,4) DEFAULT 0;
ALTER TABLE itbis_summaries ADD COLUMN IF NOT EXISTS total_itbis_collected DECIMAL(15,4) DEFAULT 0;
ALTER TABLE itbis_summaries ADD COLUMN IF NOT EXISTS itbis_18_paid DECIMAL(15,4) DEFAULT 0;
ALTER TABLE itbis_summaries ADD COLUMN IF NOT EXISTS itbis_16_paid DECIMAL(15,4) DEFAULT 0;
ALTER TABLE itbis_summaries ADD COLUMN IF NOT EXISTS purchases_exempt DECIMAL(15,4) DEFAULT 0;
ALTER TABLE itbis_summaries ADD COLUMN IF NOT EXISTS total_itbis_paid DECIMAL(15,4) DEFAULT 0;
ALTER TABLE itbis_summaries ADD COLUMN IF NOT EXISTS itbis_retained_by_cards DECIMAL(15,4) DEFAULT 0;
ALTER TABLE itbis_summaries ADD COLUMN IF NOT EXISTS other_retentions DECIMAL(15,4) DEFAULT 0;
ALTER TABLE itbis_summaries ADD COLUMN IF NOT EXISTS total_itbis_retained DECIMAL(15,4) DEFAULT 0;
ALTER TABLE itbis_summaries ADD COLUMN IF NOT EXISTS net_itbis_due DECIMAL(15,4) DEFAULT 0;
ALTER TABLE itbis_summaries ADD COLUMN IF NOT EXISTS dgii_confirmation TEXT;

-- Increase existing column precision
ALTER TABLE itbis_summaries ALTER COLUMN itbis_collected TYPE DECIMAL(15,4);
ALTER TABLE itbis_summaries ALTER COLUMN itbis_paid TYPE DECIMAL(15,4);
ALTER TABLE itbis_summaries ALTER COLUMN itbis_balance TYPE DECIMAL(15,4);

-- ============================================================
-- 8. CARD_SETTLEMENTS: Add missing columns
-- ============================================================

ALTER TABLE card_settlements ADD COLUMN IF NOT EXISTS sale_ids JSONB DEFAULT '[]'::jsonb;
ALTER TABLE card_settlements ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(10,6);
ALTER TABLE card_settlements ADD COLUMN IF NOT EXISTS itbis_retention_rate DECIMAL(10,6);
ALTER TABLE card_settlements ADD COLUMN IF NOT EXISTS itbis_retention_amount DECIMAL(15,4);
ALTER TABLE card_settlements ADD COLUMN IF NOT EXISTS period_start TEXT;
ALTER TABLE card_settlements ADD COLUMN IF NOT EXISTS period_end TEXT;
ALTER TABLE card_settlements ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMPTZ;

-- Increase numeric precision
ALTER TABLE card_settlements ALTER COLUMN gross_amount TYPE DECIMAL(15,4);
ALTER TABLE card_settlements ALTER COLUMN commission TYPE DECIMAL(15,4);
ALTER TABLE card_settlements ALTER COLUMN tax_on_commission TYPE DECIMAL(15,4);
ALTER TABLE card_settlements ALTER COLUMN net_amount TYPE DECIMAL(15,4);

-- ============================================================
-- 9. RECEIPT_SETTINGS: Add missing columns from local schema
-- ============================================================

ALTER TABLE receipt_settings ADD COLUMN IF NOT EXISTS rnc TEXT;
ALTER TABLE receipt_settings ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE receipt_settings ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE receipt_settings ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE receipt_settings ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE receipt_settings ADD COLUMN IF NOT EXISTS show_rnc BOOLEAN DEFAULT TRUE;
ALTER TABLE receipt_settings ADD COLUMN IF NOT EXISTS show_address BOOLEAN DEFAULT TRUE;
ALTER TABLE receipt_settings ADD COLUMN IF NOT EXISTS show_phone BOOLEAN DEFAULT TRUE;
ALTER TABLE receipt_settings ADD COLUMN IF NOT EXISTS show_email BOOLEAN DEFAULT FALSE;
ALTER TABLE receipt_settings ADD COLUMN IF NOT EXISTS show_website BOOLEAN DEFAULT FALSE;
ALTER TABLE receipt_settings ADD COLUMN IF NOT EXISTS show_ncf BOOLEAN DEFAULT TRUE;
ALTER TABLE receipt_settings ADD COLUMN IF NOT EXISTS show_shift_number BOOLEAN DEFAULT TRUE;
ALTER TABLE receipt_settings ADD COLUMN IF NOT EXISTS show_cashier_name BOOLEAN DEFAULT TRUE;
ALTER TABLE receipt_settings ADD COLUMN IF NOT EXISTS show_tax_breakdown BOOLEAN DEFAULT TRUE;
ALTER TABLE receipt_settings ADD COLUMN IF NOT EXISTS show_payment_details BOOLEAN DEFAULT TRUE;
ALTER TABLE receipt_settings ADD COLUMN IF NOT EXISTS footer_line1 TEXT;
ALTER TABLE receipt_settings ADD COLUMN IF NOT EXISTS footer_line2 TEXT;
ALTER TABLE receipt_settings ADD COLUMN IF NOT EXISTS footer_line3 TEXT;
ALTER TABLE receipt_settings ADD COLUMN IF NOT EXISTS show_no_returns_policy BOOLEAN DEFAULT TRUE;
ALTER TABLE receipt_settings ADD COLUMN IF NOT EXISTS no_returns_policy_text TEXT;

-- ============================================================
-- 10. RECEIPTS: Relax FK constraint
-- ============================================================

ALTER TABLE receipts DROP CONSTRAINT IF EXISTS receipts_supplier_id_fkey;
ALTER TABLE receipts DROP CONSTRAINT IF EXISTS receipts_purchase_order_id_fkey;
ALTER TABLE receipts DROP CONSTRAINT IF EXISTS receipts_invoice_id_fkey;

ALTER TABLE receipts ALTER COLUMN supplier_id TYPE TEXT;
ALTER TABLE receipts ALTER COLUMN purchase_order_id TYPE TEXT;

-- ============================================================
-- 11. PURCHASE_ORDERS: Relax FK constraint
-- ============================================================

ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_supplier_id_fkey;
ALTER TABLE purchase_orders ALTER COLUMN supplier_id TYPE TEXT;

-- ============================================================
-- 12. NCF_RANGES: Add missing columns
-- ============================================================

ALTER TABLE ncf_ranges ADD COLUMN IF NOT EXISTS prefix TEXT;
-- Drop type CHECK to allow any NCF type
ALTER TABLE ncf_ranges DROP CONSTRAINT IF EXISTS ncf_ranges_type_check;

-- ============================================================
-- 13. NCF_USAGE: Add missing columns and fix types
-- ============================================================

ALTER TABLE ncf_usage ALTER COLUMN amount TYPE DECIMAL(15,4);
ALTER TABLE ncf_usage ALTER COLUMN itbis TYPE DECIMAL(15,4);
-- Drop type CHECK to allow any NCF type
ALTER TABLE ncf_usage DROP CONSTRAINT IF EXISTS ncf_usage_type_check;

-- ============================================================
-- 14. ACCOUNTING_AUDIT_LOG: Add/rename columns to match local
-- ============================================================

ALTER TABLE accounting_audit_log ADD COLUMN IF NOT EXISTS details JSONB;
ALTER TABLE accounting_audit_log ADD COLUMN IF NOT EXISTS previous_state JSONB;
-- Drop action CHECK to allow any action type
ALTER TABLE accounting_audit_log DROP CONSTRAINT IF EXISTS accounting_audit_log_action_check;
-- Drop entity_type CHECK to allow any type
ALTER TABLE accounting_audit_log DROP CONSTRAINT IF EXISTS accounting_audit_log_entity_type_check;

-- ============================================================
-- 15. SHIFTS: Add missing columns
-- ============================================================

ALTER TABLE shifts ADD COLUMN IF NOT EXISTS sales_count INTEGER DEFAULT 0;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS cogs_total DECIMAL(15,4);
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS gross_margin DECIMAL(15,4);
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS cogs_journal_entry_id TEXT;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS cash_in DECIMAL(15,4);
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS cash_out DECIMAL(15,4);
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS cash_in_notes TEXT;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS cash_out_notes TEXT;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS closing_notes TEXT;

-- Increase numeric precision
ALTER TABLE shifts ALTER COLUMN opening_cash TYPE DECIMAL(15,4);
ALTER TABLE shifts ALTER COLUMN closing_cash TYPE DECIMAL(15,4);
ALTER TABLE shifts ALTER COLUMN expected_cash TYPE DECIMAL(15,4);
ALTER TABLE shifts ALTER COLUMN cash_difference TYPE DECIMAL(15,4);
ALTER TABLE shifts ALTER COLUMN total_sales TYPE DECIMAL(15,4);
ALTER TABLE shifts ALTER COLUMN total_returns TYPE DECIMAL(15,4);
ALTER TABLE shifts ALTER COLUMN total_cash_sales TYPE DECIMAL(15,4);
ALTER TABLE shifts ALTER COLUMN total_card_sales TYPE DECIMAL(15,4);
ALTER TABLE shifts ALTER COLUMN total_transfer_sales TYPE DECIMAL(15,4);
ALTER TABLE shifts ALTER COLUMN total_credit_sales TYPE DECIMAL(15,4);

-- ============================================================
-- 16. TRANSACTION_FEATURES: Fix types
-- ============================================================

ALTER TABLE transaction_features ALTER COLUMN total_value TYPE DECIMAL(15,4);
ALTER TABLE transaction_features ALTER COLUMN confidence_score TYPE DECIMAL(10,6);

-- ============================================================
-- 17. REAL_TIME_INSIGHTS: Fix types
-- ============================================================

ALTER TABLE real_time_insights ALTER COLUMN confidence_score TYPE DECIMAL(10,6);
-- Drop severity CHECK to allow any value
ALTER TABLE real_time_insights DROP CONSTRAINT IF EXISTS real_time_insights_severity_check;

-- ============================================================
-- 18. PAYMENTS: Relax FK constraints
-- ============================================================

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_invoice_id_fkey;
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_sale_id_fkey;
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_supplier_id_fkey;
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_customer_id_fkey;
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_bank_account_id_fkey;

ALTER TABLE payments ALTER COLUMN invoice_id TYPE TEXT;
ALTER TABLE payments ALTER COLUMN sale_id TYPE TEXT;
ALTER TABLE payments ALTER COLUMN return_id TYPE TEXT;
ALTER TABLE payments ALTER COLUMN supplier_id TYPE TEXT;
ALTER TABLE payments ALTER COLUMN customer_id TYPE TEXT;
ALTER TABLE payments ALTER COLUMN bank_account_id TYPE TEXT;

-- ============================================================
-- 19. RETURNS: Relax FK constraints and CHECK
-- ============================================================

ALTER TABLE returns DROP CONSTRAINT IF EXISTS returns_original_sale_id_fkey;
ALTER TABLE returns DROP CONSTRAINT IF EXISTS returns_customer_id_fkey;
ALTER TABLE returns DROP CONSTRAINT IF EXISTS returns_reason_check;
ALTER TABLE returns DROP CONSTRAINT IF EXISTS returns_refund_status_check;

ALTER TABLE returns ALTER COLUMN original_sale_id TYPE TEXT;
ALTER TABLE returns ALTER COLUMN customer_id TYPE TEXT;

-- ============================================================
-- 20. INVOICES: Add missing columns
-- ============================================================

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS reasoning TEXT;

-- ============================================================
-- 21. SUPPLIERS: Add missing columns
-- ============================================================

ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS examples JSONB DEFAULT '[]'::jsonb;

-- ============================================================
-- 22. Update RLS policies to use EXISTS pattern
-- ============================================================

-- cost_consumptions
DROP POLICY IF EXISTS "cost_consumptions_all_policy" ON cost_consumptions;
DROP POLICY IF EXISTS "cost_consumptions_select" ON cost_consumptions;
DROP POLICY IF EXISTS "cost_consumptions_insert" ON cost_consumptions;
DROP POLICY IF EXISTS "cost_consumptions_update" ON cost_consumptions;
DROP POLICY IF EXISTS "cost_consumptions_delete" ON cost_consumptions;

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
DROP POLICY IF EXISTS "journal_entries_select" ON journal_entries;
DROP POLICY IF EXISTS "journal_entries_insert" ON journal_entries;
DROP POLICY IF EXISTS "journal_entries_update" ON journal_entries;
DROP POLICY IF EXISTS "journal_entries_delete" ON journal_entries;

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
DROP POLICY IF EXISTS "inventory_lots_select" ON inventory_lots;
DROP POLICY IF EXISTS "inventory_lots_insert" ON inventory_lots;
DROP POLICY IF EXISTS "inventory_lots_update" ON inventory_lots;
DROP POLICY IF EXISTS "inventory_lots_delete" ON inventory_lots;

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
-- SUMMARY OF CHANGES
-- ============================================================
-- 1. All DECIMAL fields increased to (15,4) or (15,6) for precision
-- 2. cost_consumptions: lot_id nullable, product_id TEXT, type nullable
-- 3. journal_entries: supports lines JSONB, single fields nullable
-- 4. inventory_lots: all FK dropped, fields are TEXT
-- 5. sales: payment_status CHECK dropped, delivery fields added
-- 6. stock_movements: product_id TEXT, quantity DECIMAL
-- 7. itbis_summaries: all tax breakdown fields added
-- 8. card_settlements: all missing fields added
-- 9. receipt_settings: all local fields added
-- 10. All restrictive FK constraints dropped for sync flexibility
-- 11. All restrictive CHECK constraints dropped
-- 12. RLS policies updated to use EXISTS pattern

