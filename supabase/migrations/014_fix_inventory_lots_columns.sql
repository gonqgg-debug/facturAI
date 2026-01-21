-- Migration: Fix inventory_lots columns to match local schema
-- Created: 2026-01-21
-- 
-- Fixes the mismatch between local Dexie schema and Supabase:
-- - Add original_quantity column (was 'quantity' in original migration)
-- - Add depleted_at column
-- - Add lot_number column
-- - Add unit_cost_inc_tax column
-- - Update status CHECK constraint to include 'active' and 'returned'

-- ============================================================
-- 1. Add missing columns to inventory_lots
-- ============================================================

-- Add original_quantity column (copy from quantity if exists)
ALTER TABLE inventory_lots ADD COLUMN IF NOT EXISTS original_quantity INTEGER;

-- Update original_quantity from quantity for existing rows
UPDATE inventory_lots SET original_quantity = quantity WHERE original_quantity IS NULL AND quantity IS NOT NULL;

-- Add depleted_at column
ALTER TABLE inventory_lots ADD COLUMN IF NOT EXISTS depleted_at TIMESTAMPTZ;

-- Add lot_number column (maps to lotNumber in TypeScript)
ALTER TABLE inventory_lots ADD COLUMN IF NOT EXISTS lot_number TEXT;

-- Add unit_cost_inc_tax column
ALTER TABLE inventory_lots ADD COLUMN IF NOT EXISTS unit_cost_inc_tax DECIMAL(15,6);

-- ============================================================
-- 2. Fix status CHECK constraint to allow all valid values
-- ============================================================

-- Drop the old CHECK constraint
ALTER TABLE inventory_lots DROP CONSTRAINT IF EXISTS inventory_lots_status_check;

-- Add new CHECK constraint with all valid values
-- Maps: 'active' (local) = 'available' (DB), plus 'depleted', 'expired', 'returned'
ALTER TABLE inventory_lots ADD CONSTRAINT inventory_lots_status_check 
    CHECK (status IN ('available', 'active', 'depleted', 'expired', 'returned'));

-- ============================================================
-- 3. Make quantity nullable (original_quantity is the source of truth now)
-- ============================================================
ALTER TABLE inventory_lots ALTER COLUMN quantity DROP NOT NULL;

-- ============================================================
-- Summary:
-- - Added: original_quantity, depleted_at, lot_number, unit_cost_inc_tax
-- - Updated: status constraint to include 'active' and 'returned'
-- - Made: quantity nullable (original_quantity is primary)
-- ============================================================
