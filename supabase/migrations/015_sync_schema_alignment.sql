-- ============================================================
-- Migration 015: Sync Schema Alignment
-- ============================================================
-- This migration aligns the Supabase schema with TypeScript interfaces
-- to enable full synchronization of all tables.
-- ============================================================

-- ============================================================
-- 1. SHIFTS TABLE - Add missing columns
-- ============================================================
-- TypeScript has additional fields not in base schema (migration 009)

-- Change shift_number from INTEGER to TEXT to support "2024-001" format
ALTER TABLE shifts ALTER COLUMN shift_number TYPE TEXT USING shift_number::TEXT;

-- Add missing columns
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS sales_count INTEGER DEFAULT 0;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS cogs_total DECIMAL(12,2) DEFAULT 0;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS gross_margin DECIMAL(12,2) DEFAULT 0;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS cogs_journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE SET NULL;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS cash_in DECIMAL(12,2) DEFAULT 0;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS cash_out DECIMAL(12,2) DEFAULT 0;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS cash_in_notes TEXT;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS cash_out_notes TEXT;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS closing_notes TEXT;

-- ============================================================
-- 2. SUPPLIERS TABLE - Add missing columns
-- ============================================================
-- TypeScript has address2 field not in Supabase

ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS address_2 TEXT;

-- ============================================================
-- 3. INVENTORY_LOTS TABLE - Align with TypeScript
-- ============================================================
-- TypeScript uses different field names and types

-- Add lot_number column (TypeScript: lotNumber)
ALTER TABLE inventory_lots ADD COLUMN IF NOT EXISTS lot_number TEXT;

-- Add original_quantity (TypeScript: originalQuantity) - currently 'quantity'
-- Note: Supabase has 'quantity', TypeScript uses 'originalQuantity'
-- We'll add original_quantity as alias, keeping backward compat
ALTER TABLE inventory_lots ADD COLUMN IF NOT EXISTS original_quantity INTEGER;

-- Update original_quantity from quantity if null
UPDATE inventory_lots SET original_quantity = quantity WHERE original_quantity IS NULL;

-- Add unit_cost_inc_tax (TypeScript: unitCostIncTax)
ALTER TABLE inventory_lots ADD COLUMN IF NOT EXISTS unit_cost_inc_tax DECIMAL(12,4);

-- Add depleted_at (TypeScript: depletedAt)
ALTER TABLE inventory_lots ADD COLUMN IF NOT EXISTS depleted_at TIMESTAMPTZ;

-- Fix status constraint to match TypeScript ('active' instead of 'available')
-- First drop the existing constraint
ALTER TABLE inventory_lots DROP CONSTRAINT IF EXISTS inventory_lots_status_check;
-- Add new constraint matching TypeScript
ALTER TABLE inventory_lots ADD CONSTRAINT inventory_lots_status_check 
    CHECK (status IN ('active', 'depleted', 'expired', 'returned', 'available'));

-- ============================================================
-- 4. ITBIS_SUMMARIES TABLE - Add detailed breakdown fields
-- ============================================================
-- TypeScript has detailed ITBIS breakdown by rate

-- ITBIS Collected from Sales (18% and 16% rates)
ALTER TABLE itbis_summaries ADD COLUMN IF NOT EXISTS itbis_18_collected DECIMAL(15,4) DEFAULT 0;
ALTER TABLE itbis_summaries ADD COLUMN IF NOT EXISTS itbis_16_collected DECIMAL(15,4) DEFAULT 0;
ALTER TABLE itbis_summaries ADD COLUMN IF NOT EXISTS sales_exempt DECIMAL(15,4) DEFAULT 0;
ALTER TABLE itbis_summaries ADD COLUMN IF NOT EXISTS total_itbis_collected DECIMAL(15,4) DEFAULT 0;

-- ITBIS Paid on Purchases (18% and 16% rates)
ALTER TABLE itbis_summaries ADD COLUMN IF NOT EXISTS itbis_18_paid DECIMAL(15,4) DEFAULT 0;
ALTER TABLE itbis_summaries ADD COLUMN IF NOT EXISTS itbis_16_paid DECIMAL(15,4) DEFAULT 0;
ALTER TABLE itbis_summaries ADD COLUMN IF NOT EXISTS purchases_exempt DECIMAL(15,4) DEFAULT 0;
ALTER TABLE itbis_summaries ADD COLUMN IF NOT EXISTS total_itbis_paid DECIMAL(15,4) DEFAULT 0;

-- ITBIS Retained by Third Parties
ALTER TABLE itbis_summaries ADD COLUMN IF NOT EXISTS itbis_retained_by_cards DECIMAL(15,4) DEFAULT 0;
ALTER TABLE itbis_summaries ADD COLUMN IF NOT EXISTS other_retentions DECIMAL(15,4) DEFAULT 0;
ALTER TABLE itbis_summaries ADD COLUMN IF NOT EXISTS total_itbis_retained DECIMAL(15,4) DEFAULT 0;

-- Net ITBIS Due
ALTER TABLE itbis_summaries ADD COLUMN IF NOT EXISTS net_itbis_due DECIMAL(15,4) DEFAULT 0;

-- DGII filing confirmation
ALTER TABLE itbis_summaries ADD COLUMN IF NOT EXISTS dgii_confirmation TEXT;

-- ============================================================
-- 5. CARD_SETTLEMENTS TABLE - Add missing columns
-- ============================================================
-- TypeScript has additional settlement period fields

ALTER TABLE card_settlements ADD COLUMN IF NOT EXISTS period_start TEXT;
ALTER TABLE card_settlements ADD COLUMN IF NOT EXISTS period_end TEXT;
ALTER TABLE card_settlements ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(6,4);
ALTER TABLE card_settlements ADD COLUMN IF NOT EXISTS itbis_retention_rate DECIMAL(6,4) DEFAULT 0.02;
ALTER TABLE card_settlements ADD COLUMN IF NOT EXISTS itbis_retention_amount DECIMAL(12,2) DEFAULT 0;
ALTER TABLE card_settlements ADD COLUMN IF NOT EXISTS sale_ids JSONB DEFAULT '[]'::jsonb;
ALTER TABLE card_settlements ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMPTZ;

-- Rename commission to commission_amount for clarity (if needed)
-- ALTER TABLE card_settlements RENAME COLUMN commission TO commission_amount;

-- ============================================================
-- 6. JOURNAL_ENTRIES TABLE - Add lines JSONB column and fix source_type
-- ============================================================
-- TypeScript uses 'lines' array for multi-line entries

ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS lines JSONB DEFAULT '[]'::jsonb;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS total_debit DECIMAL(12,2) DEFAULT 0;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS total_credit DECIMAL(12,2) DEFAULT 0;

-- Fix source_type constraint to match TypeScript values
-- TypeScript uses: 'sale', 'purchase', 'adjustment', 'card_settlement', 'shift_close', 'return', 'manual'
-- Original allowed: 'sale', 'purchase', 'payment', 'return', 'adjustment', 'settlement', 'manual'
ALTER TABLE journal_entries DROP CONSTRAINT IF EXISTS journal_entries_source_type_check;
ALTER TABLE journal_entries ADD CONSTRAINT journal_entries_source_type_check 
    CHECK (source_type IN ('sale', 'purchase', 'payment', 'return', 'adjustment', 'settlement', 'manual', 'card_settlement', 'shift_close'));

-- ============================================================
-- 7. COST_CONSUMPTIONS TABLE - Ensure all fields exist
-- ============================================================
-- TypeScript interface matches well, just verify columns exist

-- No changes needed - schema matches TypeScript

-- ============================================================
-- 8. NCF_RANGES TABLE - Add createdAt for TypeScript
-- ============================================================
-- TypeScript expects createdAt

-- created_at already exists in base schema

-- ============================================================
-- 9. NCF_USAGE TABLE - Ensure all fields
-- ============================================================
-- TypeScript interface matches well

-- No changes needed

-- ============================================================
-- 10. ACCOUNTING_AUDIT_LOG TABLE - Add details column
-- ============================================================
-- TypeScript uses 'details' instead of separate old_value/new_value

ALTER TABLE accounting_audit_log ADD COLUMN IF NOT EXISTS details JSONB;
ALTER TABLE accounting_audit_log ADD COLUMN IF NOT EXISTS previous_state JSONB;

-- ============================================================
-- 11. RECEIPT_SETTINGS TABLE - No changes needed
-- ============================================================
-- Schema matches TypeScript

-- ============================================================
-- 12. TRANSACTION_FEATURES TABLE - No changes needed  
-- ============================================================
-- Schema matches TypeScript

-- ============================================================
-- 13. REAL_TIME_INSIGHTS TABLE - No changes needed
-- ============================================================
-- Schema matches TypeScript

-- ============================================================
-- 14. Refresh PostgREST schema cache
-- ============================================================
-- This ensures the REST API picks up the new columns immediately
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- SUMMARY OF CHANGES
-- ============================================================
-- 
-- SHIFTS:
--   - shift_number: INTEGER → TEXT (supports "2024-001" format)
--   - Added: sales_count, cogs_total, gross_margin, cogs_journal_entry_id
--   - Added: cash_in, cash_out, cash_in_notes, cash_out_notes, closing_notes
--
-- SUPPLIERS:
--   - Added: address_2
--
-- INVENTORY_LOTS:
--   - Added: lot_number, original_quantity, unit_cost_inc_tax, depleted_at
--   - Updated status constraint to include 'active', 'returned'
--
-- ITBIS_SUMMARIES:
--   - Added: itbis_18_collected, itbis_16_collected, sales_exempt, total_itbis_collected
--   - Added: itbis_18_paid, itbis_16_paid, purchases_exempt, total_itbis_paid
--   - Added: itbis_retained_by_cards, other_retentions, total_itbis_retained
--   - Added: net_itbis_due, dgii_confirmation
--
-- CARD_SETTLEMENTS:
--   - Added: period_start, period_end, commission_rate
--   - Added: itbis_retention_rate, itbis_retention_amount, sale_ids, reconciled_at
--
-- JOURNAL_ENTRIES:
--   - Added: lines (JSONB), total_debit, total_credit
--
-- ACCOUNTING_AUDIT_LOG:
--   - Added: details, previous_state
--
