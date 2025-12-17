-- ============================================================
-- Migration: Team Invites Table for Multi-Tenant User Access
-- ============================================================
-- This migration adds the team_invites table to manage invitations
-- for team members to create full Firebase accounts and access
-- the application from any device.
-- ============================================================

-- Create team_invites table
CREATE TABLE IF NOT EXISTS team_invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL,           -- Local user ID being invited
    email TEXT NOT NULL,                 -- Email address to send invite
    token TEXT UNIQUE NOT NULL,          -- Unique invite token for URL
    invited_by INTEGER NOT NULL,         -- Local user ID of inviter
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,     -- Typically 7 days from creation
    accepted_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_team_invites_store ON team_invites(store_id);
CREATE INDEX IF NOT EXISTS idx_team_invites_token ON team_invites(token);
CREATE INDEX IF NOT EXISTS idx_team_invites_email ON team_invites(email);
CREATE INDEX IF NOT EXISTS idx_team_invites_user ON team_invites(store_id, user_id);
CREATE INDEX IF NOT EXISTS idx_team_invites_status ON team_invites(store_id, status);

-- Enable RLS
ALTER TABLE team_invites ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

-- Policy: Allow inserting invites for own store only
-- Uses the current setting 'app.store_id' which should be set by the client
CREATE POLICY "team_invites_insert_policy" ON team_invites
    FOR INSERT
    WITH CHECK (
        store_id::text = current_setting('app.store_id', true)
        OR current_setting('app.store_id', true) IS NULL  -- Fallback for initial setup
    );

-- Policy: Allow reading invites from own store only
CREATE POLICY "team_invites_select_policy" ON team_invites
    FOR SELECT
    USING (
        store_id::text = current_setting('app.store_id', true)
        OR current_setting('app.store_id', true) IS NULL
    );

-- Policy: Allow updating invites in own store only
CREATE POLICY "team_invites_update_policy" ON team_invites
    FOR UPDATE
    USING (
        store_id::text = current_setting('app.store_id', true)
        OR current_setting('app.store_id', true) IS NULL
    );

-- Policy: Allow deleting invites from own store only
CREATE POLICY "team_invites_delete_policy" ON team_invites
    FOR DELETE
    USING (
        store_id::text = current_setting('app.store_id', true)
        OR current_setting('app.store_id', true) IS NULL
    );

-- Add updated_at trigger
CREATE TRIGGER update_team_invites_updated_at 
    BEFORE UPDATE ON team_invites 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- HELPER FUNCTION: Validate invite by token
-- ============================================================
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

-- ============================================================
-- HELPER FUNCTION: Accept invite and mark as accepted
-- ============================================================
CREATE OR REPLACE FUNCTION accept_team_invite(
    p_token TEXT,
    p_store_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_invite_store_id UUID;
BEGIN
    -- Get the invite's store_id and verify it matches
    SELECT store_id INTO v_invite_store_id
    FROM team_invites
    WHERE token = p_token
      AND status = 'pending'
      AND expires_at > NOW();
    
    IF v_invite_store_id IS NULL THEN
        RETURN FALSE;  -- Invalid or expired invite
    END IF;
    
    IF v_invite_store_id != p_store_id THEN
        RETURN FALSE;  -- Store mismatch (multi-tenant security)
    END IF;
    
    -- Mark invite as accepted
    UPDATE team_invites
    SET status = 'accepted',
        accepted_at = NOW()
    WHERE token = p_token
      AND store_id = p_store_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

