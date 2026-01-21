-- ============================================================
-- Migration: Fix UPSERT Constraints for Sync
-- ============================================================
-- This migration fixes the issue where PostgREST returns 400 errors
-- when trying to upsert with on_conflict on multiple columns.
-- 
-- PostgREST requires explicit UNIQUE CONSTRAINTS (not just indexes)
-- for multi-column on_conflict clauses to work properly.
-- ============================================================

-- ============================================================
-- FIX USERS TABLE
-- ============================================================

-- Drop the existing unique index (we'll replace it with a constraint)
DROP INDEX IF EXISTS idx_users_store_local_unique;

-- Add explicit UNIQUE CONSTRAINT for upsert
ALTER TABLE users 
    DROP CONSTRAINT IF EXISTS users_store_local_unique;
ALTER TABLE users 
    ADD CONSTRAINT users_store_local_unique UNIQUE (store_id, local_id);

-- ============================================================
-- FIX ROLES TABLE
-- ============================================================

-- Drop the existing unique index
DROP INDEX IF EXISTS idx_roles_store_local_unique;

-- Add explicit UNIQUE CONSTRAINT for upsert
ALTER TABLE roles 
    DROP CONSTRAINT IF EXISTS roles_store_local_unique;
ALTER TABLE roles 
    ADD CONSTRAINT roles_store_local_unique UNIQUE (store_id, local_id);

-- ============================================================
-- FIX SHIFTS TABLE (from migration 009)
-- ============================================================

-- Drop the existing unique index
DROP INDEX IF EXISTS idx_shifts_store_local_unique;

-- Add explicit UNIQUE CONSTRAINT for upsert
ALTER TABLE shifts 
    DROP CONSTRAINT IF EXISTS shifts_store_local_unique;
ALTER TABLE shifts 
    ADD CONSTRAINT shifts_store_local_unique UNIQUE (store_id, local_id);

-- ============================================================
-- FIX INVENTORY_LOTS TABLE
-- ============================================================
-- This table uses UUID primary keys (not local_id), so no fix needed

-- ============================================================
-- FIX TRANSACTION_FEATURES TABLE (if it has local_id)
-- ============================================================

-- Check if table exists and add constraint if needed
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'transaction_features' AND column_name = 'local_id') THEN
        -- Drop existing index if exists
        DROP INDEX IF EXISTS idx_transaction_features_store_local_unique;
        
        -- Add constraint
        EXECUTE 'ALTER TABLE transaction_features DROP CONSTRAINT IF EXISTS transaction_features_store_local_unique';
        EXECUTE 'ALTER TABLE transaction_features ADD CONSTRAINT transaction_features_store_local_unique UNIQUE (store_id, local_id)';
    END IF;
END $$;

-- ============================================================
-- FIX REAL_TIME_INSIGHTS TABLE (if it has local_id)
-- ============================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'real_time_insights' AND column_name = 'local_id') THEN
        -- Drop existing index if exists
        DROP INDEX IF EXISTS idx_real_time_insights_store_local_unique;
        
        -- Add constraint
        EXECUTE 'ALTER TABLE real_time_insights DROP CONSTRAINT IF EXISTS real_time_insights_store_local_unique';
        EXECUTE 'ALTER TABLE real_time_insights ADD CONSTRAINT real_time_insights_store_local_unique UNIQUE (store_id, local_id)';
    END IF;
END $$;

-- ============================================================
-- FIX ITBIS_SUMMARIES TABLE (uses period for uniqueness)
-- ============================================================

-- Drop the existing unique index
DROP INDEX IF EXISTS idx_itbis_summaries_period;

-- Add explicit UNIQUE CONSTRAINT
ALTER TABLE itbis_summaries 
    DROP CONSTRAINT IF EXISTS itbis_summaries_store_period_unique;
ALTER TABLE itbis_summaries 
    ADD CONSTRAINT itbis_summaries_store_period_unique UNIQUE (store_id, period);

-- ============================================================
-- FIX NCF_USAGE TABLE (uses ncf for uniqueness)
-- ============================================================

-- Drop the existing unique index
DROP INDEX IF EXISTS idx_ncf_usage_ncf;

-- Add explicit UNIQUE CONSTRAINT
ALTER TABLE ncf_usage 
    DROP CONSTRAINT IF EXISTS ncf_usage_store_ncf_unique;
ALTER TABLE ncf_usage 
    ADD CONSTRAINT ncf_usage_store_ncf_unique UNIQUE (store_id, ncf);

-- ============================================================
-- FIX RECEIPT_SETTINGS TABLE (one per store)
-- ============================================================

-- Drop the existing unique index
DROP INDEX IF EXISTS idx_receipt_settings_store_unique;

-- Add explicit UNIQUE CONSTRAINT
ALTER TABLE receipt_settings 
    DROP CONSTRAINT IF EXISTS receipt_settings_store_unique;
ALTER TABLE receipt_settings 
    ADD CONSTRAINT receipt_settings_store_unique UNIQUE (store_id);

-- ============================================================
-- FIX SYNC_LOG TABLE - record_id should be TEXT not UUID
-- ============================================================
-- The sync_log table was created with record_id as UUID,
-- but auto-increment tables (users, roles, shifts) use integer IDs.
-- Change record_id to TEXT to support both UUID and integer IDs.

ALTER TABLE sync_log 
    ALTER COLUMN record_id TYPE TEXT USING record_id::TEXT;

-- ============================================================
-- SUMMARY
-- ============================================================
-- This migration converts UNIQUE INDEXES to UNIQUE CONSTRAINTS
-- for tables that use multi-column conflict resolution in upserts.
--
-- Tables affected:
-- - users (store_id, local_id)
-- - roles (store_id, local_id)
-- - shifts (store_id, local_id)
-- - transaction_features (store_id, local_id) - if exists
-- - real_time_insights (store_id, local_id) - if exists
-- - itbis_summaries (store_id, period)
-- - ncf_usage (store_id, ncf)
-- - receipt_settings (store_id)
-- - sync_log (record_id changed from UUID to TEXT)
-- ============================================================


