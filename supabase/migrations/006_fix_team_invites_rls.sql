-- Migration: Fix Team Invites RLS Policies
-- This migration fixes the RLS policies for team_invites table
-- to allow new team members (on new devices) to access their invites.

-- Drop existing policies (they have the bug)
DROP POLICY IF EXISTS "team_invites_insert_policy" ON team_invites;
DROP POLICY IF EXISTS "team_invites_select_policy" ON team_invites;
DROP POLICY IF EXISTS "team_invites_update_policy" ON team_invites;
DROP POLICY IF EXISTS "team_invites_delete_policy" ON team_invites;

-- Policy: Allow inserting invites for own store only
CREATE POLICY "team_invites_insert_policy" ON team_invites
    FOR INSERT
    WITH CHECK (
        store_id::text = current_setting('app.store_id', true)
        OR NULLIF(current_setting('app.store_id', true), '') IS NULL
    );

-- Policy: Allow reading invites
CREATE POLICY "team_invites_select_policy" ON team_invites
    FOR SELECT
    USING (
        store_id::text = current_setting('app.store_id', true)
        OR NULLIF(current_setting('app.store_id', true), '') IS NULL
    );

-- Policy: Allow updating invites
CREATE POLICY "team_invites_update_policy" ON team_invites
    FOR UPDATE
    USING (
        store_id::text = current_setting('app.store_id', true)
        OR NULLIF(current_setting('app.store_id', true), '') IS NULL
    );

-- Policy: Allow deleting invites
CREATE POLICY "team_invites_delete_policy" ON team_invites
    FOR DELETE
    USING (
        store_id::text = current_setting('app.store_id', true)
        OR NULLIF(current_setting('app.store_id', true), '') IS NULL
    );

-- Recreate validate_team_invite function with RLS bypass
DROP FUNCTION IF EXISTS validate_team_invite(TEXT);

CREATE OR REPLACE FUNCTION validate_team_invite(p_token TEXT)
RETURNS TABLE (
    id UUID,
    store_id UUID,
    user_id INTEGER,
    email TEXT,
    status TEXT,
    expires_at TIMESTAMPTZ
) AS $$
BEGIN
    SET LOCAL row_security = off;
    
    RETURN QUERY
    SELECT 
        ti.id,
        ti.store_id,
        ti.user_id,
        ti.email,
        ti.status,
        ti.expires_at
    FROM team_invites ti
    WHERE ti.token = p_token
      AND ti.status = 'pending'
      AND ti.expires_at > NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION validate_team_invite(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION validate_team_invite(TEXT) TO authenticated;

-- Fix ALL users table policies
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'users') THEN
        DROP POLICY IF EXISTS "users_select_policy" ON users;
        DROP POLICY IF EXISTS "users_insert_policy" ON users;
        DROP POLICY IF EXISTS "users_update_policy" ON users;
        DROP POLICY IF EXISTS "users_delete_policy" ON users;
        
        CREATE POLICY "users_select_policy" ON users
            FOR SELECT
            USING (
                store_id::text = current_setting('app.store_id', true)
                OR NULLIF(current_setting('app.store_id', true), '') IS NULL
            );
        CREATE POLICY "users_insert_policy" ON users
            FOR INSERT
            WITH CHECK (
                store_id::text = current_setting('app.store_id', true)
                OR NULLIF(current_setting('app.store_id', true), '') IS NULL
            );
        CREATE POLICY "users_update_policy" ON users
            FOR UPDATE
            USING (
                store_id::text = current_setting('app.store_id', true)
                OR NULLIF(current_setting('app.store_id', true), '') IS NULL
            );
        CREATE POLICY "users_delete_policy" ON users
            FOR DELETE
            USING (
                store_id::text = current_setting('app.store_id', true)
                OR NULLIF(current_setting('app.store_id', true), '') IS NULL
            );
    END IF;
END $$;

-- Fix ALL roles table policies
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'roles') THEN
        DROP POLICY IF EXISTS "roles_select_policy" ON roles;
        DROP POLICY IF EXISTS "roles_insert_policy" ON roles;
        DROP POLICY IF EXISTS "roles_update_policy" ON roles;
        DROP POLICY IF EXISTS "roles_delete_policy" ON roles;
        
        CREATE POLICY "roles_select_policy" ON roles
            FOR SELECT
            USING (
                store_id::text = current_setting('app.store_id', true)
                OR NULLIF(current_setting('app.store_id', true), '') IS NULL
            );
        CREATE POLICY "roles_insert_policy" ON roles
            FOR INSERT
            WITH CHECK (
                store_id::text = current_setting('app.store_id', true)
                OR NULLIF(current_setting('app.store_id', true), '') IS NULL
            );
        CREATE POLICY "roles_update_policy" ON roles
            FOR UPDATE
            USING (
                store_id::text = current_setting('app.store_id', true)
                OR NULLIF(current_setting('app.store_id', true), '') IS NULL
            );
        CREATE POLICY "roles_delete_policy" ON roles
            FOR DELETE
            USING (
                store_id::text = current_setting('app.store_id', true)
                OR NULLIF(current_setting('app.store_id', true), '') IS NULL
            );
    END IF;
END $$;

-- Helper function to fetch user by invite (bypasses RLS)
CREATE OR REPLACE FUNCTION get_user_for_invite(p_local_id INTEGER, p_store_id UUID)
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
        u.store_id
    FROM users u
    WHERE u.local_id = p_local_id
      AND u.store_id = p_store_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_user_for_invite(INTEGER, UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_user_for_invite(INTEGER, UUID) TO authenticated;

-- Helper function to fetch role (bypasses RLS)
CREATE OR REPLACE FUNCTION get_role_for_invite(p_local_id INTEGER, p_store_id UUID)
RETURNS TABLE (
    local_id INTEGER,
    name TEXT,
    description TEXT,
    permissions TEXT[],
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
    WHERE r.local_id = p_local_id
      AND r.store_id = p_store_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_role_for_invite(INTEGER, UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_role_for_invite(INTEGER, UUID) TO authenticated;
