-- Migration: 016_fix_cost_consumptions_fk.sql
-- Purpose: Drop foreign key constraints on cost_consumptions table
-- 
-- Problem: The sync service processes pending changes grouped by table,
-- which means cost_consumptions records may be pushed before their
-- related sales/returns records exist in Supabase, causing FK violations.
--
-- Solution: Drop the sale_id and return_id foreign key constraints,
-- consistent with how lot_id and product_id constraints were dropped
-- in migration 013.
-- ============================================================

-- Drop sale_id foreign key constraint
ALTER TABLE cost_consumptions DROP CONSTRAINT IF EXISTS cost_consumptions_sale_id_fkey;

-- Drop return_id foreign key constraint  
ALTER TABLE cost_consumptions DROP CONSTRAINT IF EXISTS cost_consumptions_return_id_fkey;

-- Make sale_id and return_id TEXT type for flexibility (consistent with other ID fields)
ALTER TABLE cost_consumptions ALTER COLUMN sale_id TYPE TEXT;
ALTER TABLE cost_consumptions ALTER COLUMN return_id TYPE TEXT;

-- ============================================================
-- SUMMARY:
-- 1. Dropped cost_consumptions_sale_id_fkey constraint
-- 2. Dropped cost_consumptions_return_id_fkey constraint
-- 3. Changed sale_id and return_id to TEXT type
--
-- This allows the sync service to push cost_consumptions records
-- regardless of whether their referenced sales/returns exist yet.
-- ============================================================
