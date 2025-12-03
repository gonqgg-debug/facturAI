-- ============================================================
-- Migration: Add Firebase UID columns for Firebase Auth integration
-- ============================================================
-- This migration adds firebase_uid columns to stores and devices tables
-- to link them to Firebase authenticated users.
-- ============================================================

-- Add firebase_uid to stores table
ALTER TABLE stores ADD COLUMN IF NOT EXISTS firebase_uid TEXT;

-- Create index for faster lookups by firebase_uid
CREATE INDEX IF NOT EXISTS idx_stores_firebase_uid ON stores(firebase_uid);

-- Add firebase_uid to devices table (to track which Firebase user registered the device)
ALTER TABLE devices ADD COLUMN IF NOT EXISTS firebase_uid TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_devices_firebase_uid ON devices(firebase_uid);

-- Add unique constraint on firebase_uid for stores (one store per Firebase user)
-- Note: This allows NULL values (for legacy stores without Firebase auth)
CREATE UNIQUE INDEX IF NOT EXISTS idx_stores_firebase_uid_unique 
ON stores(firebase_uid) 
WHERE firebase_uid IS NOT NULL;

