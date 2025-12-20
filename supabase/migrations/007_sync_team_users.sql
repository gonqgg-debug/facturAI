-- Migration: RPC Functions for Syncing Team Users
-- This migration adds RPC functions to fetch all users and roles for a store
-- These functions bypass RLS to allow admins to sync team data across devices

-- Function to fetch all users for a store (bypasses RLS)
DROP FUNCTION IF EXISTS get_store_users(UUID);

CREATE OR REPLACE FUNCTION get_store_users(p_store_id UUID)
RETURNS TABLE (
    local_id INTEGER,
    username TEXT,
    display_name TEXT,
    email TEXT,
    phone TEXT,
    pin TEXT,
    role_id INTEGER,
    role_name TEXT,
    firebase_uid TEXT,
    has_full_access BOOLEAN,
    is_active BOOLEAN,
    last_login TIMESTAMPTZ,
    created_by INTEGER,
    store_id UUID
) AS $$
BEGIN
    SET LOCAL row_security = off;
    
    RETURN QUERY
    SELECT 
        u.local_id,
        u.username,
        u.display_name,
        u.email,
        u.phone,
        u.pin,
        u.role_id,
        u.role_name,
        u.firebase_uid,
        u.has_full_access,
        u.is_active,
        u.last_login,
        u.created_by,
        u.store_id
    FROM users u
    WHERE u.store_id = p_store_id
    ORDER BY u.local_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_store_users(UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_store_users(UUID) TO authenticated;

-- Function to fetch all roles for a store (bypasses RLS)
DROP FUNCTION IF EXISTS get_store_roles(UUID);

CREATE OR REPLACE FUNCTION get_store_roles(p_store_id UUID)
RETURNS TABLE (
    local_id INTEGER,
    name TEXT,
    description TEXT,
    permissions JSONB,
    is_system BOOLEAN,
    store_id UUID
) AS $$
BEGIN
    SET LOCAL row_security = off;
    
    RETURN QUERY
    SELECT 
        r.local_id,
        r.name,
        r.description,
        r.permissions,
        r.is_system,
        r.store_id
    FROM roles r
    WHERE r.store_id = p_store_id
    ORDER BY r.local_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_store_roles(UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_store_roles(UUID) TO authenticated;

