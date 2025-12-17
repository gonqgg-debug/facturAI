-- ============================================================
-- Migration: Users Table for Multi-Tenant Sync Support
-- ============================================================
-- This migration adds the users table to enable syncing team
-- members across devices within the same store/tenant.
-- 
-- NOTE: This table syncs with the local Dexie `users` table.
-- The local table uses auto-increment IDs, so we use a separate
-- `local_id` column for mapping.
-- ============================================================

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    local_id INTEGER NOT NULL,           -- Maps to local Dexie ++id
    username TEXT NOT NULL,
    display_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    pin TEXT NOT NULL,                   -- Hashed PIN for POS access
    role_id INTEGER NOT NULL,            -- Local role ID
    role_name TEXT,
    firebase_uid TEXT,                   -- Links to Firebase account for full access
    has_full_access BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by INTEGER,                  -- Local user ID who created this user
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_users_store ON users(store_id);
CREATE INDEX IF NOT EXISTS idx_users_store_local ON users(store_id, local_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(store_id, email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_firebase ON users(firebase_uid) WHERE firebase_uid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_pin ON users(store_id, pin);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(store_id, is_active);

-- Unique constraint: Each local_id should be unique within a store
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_store_local_unique 
ON users(store_id, local_id);

-- Unique constraint: Each PIN should be unique within a store
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_store_pin_unique 
ON users(store_id, pin);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

-- Policy: Allow inserting users for own store only
CREATE POLICY "users_insert_policy" ON users
    FOR INSERT
    WITH CHECK (
        store_id::text = current_setting('app.store_id', true)
        OR current_setting('app.store_id', true) IS NULL
    );

-- Policy: Allow reading users from own store only
CREATE POLICY "users_select_policy" ON users
    FOR SELECT
    USING (
        store_id::text = current_setting('app.store_id', true)
        OR current_setting('app.store_id', true) IS NULL
    );

-- Policy: Allow updating users in own store only
CREATE POLICY "users_update_policy" ON users
    FOR UPDATE
    USING (
        store_id::text = current_setting('app.store_id', true)
        OR current_setting('app.store_id', true) IS NULL
    );

-- Policy: Allow deleting users from own store only
CREATE POLICY "users_delete_policy" ON users
    FOR DELETE
    USING (
        store_id::text = current_setting('app.store_id', true)
        OR current_setting('app.store_id', true) IS NULL
    );

-- Add updated_at trigger
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ROLES TABLE (for syncing roles across devices)
-- ============================================================

CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    local_id INTEGER NOT NULL,           -- Maps to local Dexie ++id
    name TEXT NOT NULL,
    description TEXT,
    permissions JSONB DEFAULT '[]'::jsonb,  -- Array of permission keys
    is_system BOOLEAN DEFAULT FALSE,     -- System roles cannot be deleted
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_roles_store ON roles(store_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_store_local_unique ON roles(store_id, local_id);
CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(store_id, name);

-- Enable RLS
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for roles
CREATE POLICY "roles_insert_policy" ON roles
    FOR INSERT
    WITH CHECK (
        store_id::text = current_setting('app.store_id', true)
        OR current_setting('app.store_id', true) IS NULL
    );

CREATE POLICY "roles_select_policy" ON roles
    FOR SELECT
    USING (
        store_id::text = current_setting('app.store_id', true)
        OR current_setting('app.store_id', true) IS NULL
    );

CREATE POLICY "roles_update_policy" ON roles
    FOR UPDATE
    USING (
        store_id::text = current_setting('app.store_id', true)
        OR current_setting('app.store_id', true) IS NULL
    );

CREATE POLICY "roles_delete_policy" ON roles
    FOR DELETE
    USING (
        store_id::text = current_setting('app.store_id', true)
        OR current_setting('app.store_id', true) IS NULL
    );

-- Add updated_at trigger
CREATE TRIGGER update_roles_updated_at 
    BEFORE UPDATE ON roles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- HELPER FUNCTION: Find user by Firebase UID
-- ============================================================
CREATE OR REPLACE FUNCTION find_user_by_firebase_uid(
    p_firebase_uid TEXT,
    p_store_id UUID
)
RETURNS TABLE (
    id UUID,
    local_id INTEGER,
    username TEXT,
    display_name TEXT,
    email TEXT,
    role_id INTEGER,
    role_name TEXT,
    has_full_access BOOLEAN,
    is_active BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id,
        u.local_id,
        u.username,
        u.display_name,
        u.email,
        u.role_id,
        u.role_name,
        u.has_full_access,
        u.is_active
    FROM users u
    WHERE u.firebase_uid = p_firebase_uid
      AND u.store_id = p_store_id
      AND u.is_active = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- HELPER FUNCTION: Link Firebase UID to existing user
-- ============================================================
CREATE OR REPLACE FUNCTION link_firebase_to_user(
    p_store_id UUID,
    p_local_id INTEGER,
    p_firebase_uid TEXT,
    p_email TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE users
    SET firebase_uid = p_firebase_uid,
        email = COALESCE(p_email, email),
        has_full_access = TRUE
    WHERE store_id = p_store_id
      AND local_id = p_local_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

