/**
 * Team Invites Service
 * 
 * Manages email invites for team members to create full Firebase accounts,
 * enabling web login access (not just PIN-based POS access).
 */

import { browser } from '$app/environment';
import { db, generateId } from './db';
import type { TeamInvite, User, InviteStatus, Role } from './types';
import { getStoreId } from './device-auth';
import { sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, getAuth } from 'firebase/auth';
import { getFirebaseAuth } from './firebase';
import { getSupabase } from './supabase';

// ============================================================
// CONSTANTS
// ============================================================

const INVITE_VALIDITY_DAYS = 7;
const INVITE_TOKEN_LENGTH = 32;

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Generate a secure random token for invite links
 */
function generateInviteToken(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        // Combine two UUIDs for extra length and entropy
        return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 8);
    }
    // Fallback
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < INVITE_TOKEN_LENGTH; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Calculate expiration date (7 days from now)
 */
function calculateExpirationDate(): Date {
    const date = new Date();
    date.setDate(date.getDate() + INVITE_VALIDITY_DAYS);
    return date;
}

/**
 * Check if an invite has expired
 */
function isInviteExpired(invite: TeamInvite): boolean {
    return new Date(invite.expiresAt) < new Date();
}

/**
 * Get the base URL for invite links
 */
function getInviteBaseUrl(): string {
    if (!browser) return '';
    return window.location.origin;
}

// ============================================================
// INVITE CRUD OPERATIONS
// ============================================================

/**
 * Create a new invite for a user
 * @param userId - The local user ID to invite
 * @param email - Email address to send the invite to
 * @param invitedBy - User ID of the person sending the invite
 * @returns The created invite with the magic link token
 */
export async function createInvite(
    userId: number,
    email: string,
    invitedBy: number
): Promise<TeamInvite> {
    if (!browser) throw new Error('Cannot create invite on server');
    
    // Get the user to ensure they exist
    const user = await db.users.get(userId);
    if (!user) {
        throw new Error('User not found');
    }
    
    // Check if user already has a Firebase account linked
    if (user.firebaseUid) {
        throw new Error('User already has full account access');
    }
    
    // Get store ID
    const storeId = getStoreId();
    if (!storeId) {
        throw new Error('Store not configured. Please complete device registration first.');
    }
    
    // Revoke any existing pending invites for this user
    const existingInvites = await db.teamInvites
        .where('userId')
        .equals(userId)
        .and(invite => invite.status === 'pending')
        .toArray();
    
    for (const invite of existingInvites) {
        await db.teamInvites.update(invite.id!, { status: 'revoked' as InviteStatus });
    }
    
    // Create new invite
    const token = generateInviteToken();
    const expiresAt = calculateExpirationDate();
    const normalizedEmail = email.toLowerCase().trim();
    
    const invite: TeamInvite = {
        id: generateId(),
        userId,
        email: normalizedEmail,
        token,
        storeId,
        invitedBy,
        status: 'pending',
        createdAt: new Date(),
        expiresAt
    };
    
    // Save to local database
    await db.teamInvites.add(invite);
    
    // CRITICAL: Also save to Supabase for cross-device access
    // Without this, team members on new devices can't find their invites
    const supabase = getSupabase();
    if (supabase) {
        try {
            // First, sync the user to Supabase (needed for new devices to load user data)
            await syncUserToSupabase(user, storeId);
            
            // Then, sync the invite
            const { error: supabaseError } = await supabase
                .from('team_invites')
                .insert({
                    id: invite.id,
                    store_id: storeId,
                    user_id: userId,
                    email: normalizedEmail,
                    token,
                    invited_by: invitedBy,
                    status: 'pending',
                    expires_at: expiresAt.toISOString()
                });
            
            if (supabaseError) {
                console.error('[TeamInvites] Failed to sync invite to Supabase:', supabaseError);
                // Don't throw - local invite still created
            } else {
                console.log('[TeamInvites] ✅ Synced invite to Supabase');
            }
        } catch (syncError) {
            console.error('[TeamInvites] Error syncing invite to Supabase:', syncError);
            // Don't throw - local invite still created
        }
    }
    
    // Update user email if not set
    if (!user.email || user.email !== normalizedEmail) {
        await db.users.update(userId, { email: normalizedEmail });
    }
    
    return invite;
}

/**
 * Send the invite email using Firebase Email Link Authentication
 * @param invite - The invite to send
 */
export async function sendInviteEmail(invite: TeamInvite): Promise<void> {
    const auth = getFirebaseAuth();
    if (!auth) {
        throw new Error('Firebase Auth not initialized');
    }
    
    const inviteUrl = `${getInviteBaseUrl()}/invite/${invite.token}`;
    
    const actionCodeSettings = {
        url: inviteUrl,
        handleCodeInApp: true
    };
    
    try {
        await sendSignInLinkToEmail(auth, invite.email, actionCodeSettings);
        // Store email in localStorage for later verification
        if (browser) {
            localStorage.setItem('emailForSignIn', invite.email);
        }
    } catch (error) {
        console.error('Failed to send invite email:', error);
        throw new Error('Failed to send invite email. Please check Firebase Email Link configuration.');
    }
}

/**
 * Create and send an invite in one operation
 */
export async function createAndSendInvite(
    userId: number,
    email: string,
    invitedBy: number
): Promise<TeamInvite> {
    const invite = await createInvite(userId, email, invitedBy);
    await sendInviteEmail(invite);
    return invite;
}

/**
 * Validate an invite token
 * @param token - The invite token to validate
 * @param enforceStoreId - Whether to enforce storeId validation (default: true)
 * @returns The invite if valid, null otherwise
 */
export async function validateInvite(token: string, enforceStoreId: boolean = true): Promise<TeamInvite | null> {
    if (!browser) return null;
    
    // First, try to find invite in local database
    let invite = await db.teamInvites.where('token').equals(token).first();
    
    // If not found locally, try to fetch from Supabase
    // This is crucial for team members on new devices who don't have local data
    if (!invite) {
        console.log('[TeamInvites] Invite not found locally for token:', token.slice(0, 8) + '...');
        const supabase = getSupabase();
        
        if (supabase) {
            try {
                // First try using the SECURITY DEFINER RPC function to bypass RLS
                // This is more reliable for new devices without store_id set
                console.log('[TeamInvites] Attempting validation via RPC...');
                const { data: rpcData, error: rpcError } = await supabase
                    .rpc('validate_team_invite', { p_token: token });
                
                if (rpcError) {
                    console.error('[TeamInvites] RPC validation error:', JSON.stringify(rpcError, null, 2));
                }
                
                if (!rpcError && rpcData && rpcData.length > 0) {
                    const validatedInvite = rpcData[0];
                    console.log('[TeamInvites] ✅ Invite validated via RPC:', validatedInvite.id);
                    
                    // RPC only returns limited fields, fetch complete record for consistency
                    const { data: fullInviteData, error: fullError } = await supabase
                        .from('team_invites')
                        .select('*')
                        .eq('id', validatedInvite.id)
                        .single();
                    
                    if (!fullError && fullInviteData) {
                        invite = {
                            id: fullInviteData.id,
                            userId: fullInviteData.user_id,
                            email: fullInviteData.email,
                            token: fullInviteData.token,
                            storeId: fullInviteData.store_id,
                            invitedBy: fullInviteData.invited_by,
                            status: fullInviteData.status as InviteStatus,
                            createdAt: new Date(fullInviteData.created_at),
                            expiresAt: new Date(fullInviteData.expires_at),
                            acceptedAt: fullInviteData.accepted_at ? new Date(fullInviteData.accepted_at) : undefined
                        };
                        
                        // Fetch the associated user using full invite data for consistency
                        console.log('[TeamInvites] Fetching user associated with invite...');
                        await fetchUserFromSupabase(fullInviteData.user_id, fullInviteData.store_id);
                    } else {
                        if (fullError) {
                            console.warn('[TeamInvites] Full invite fetch failed (likely RLS), using RPC data:', fullError.message);
                        }
                        // Fallback to RPC data if full fetch fails
                        invite = {
                            id: validatedInvite.id,
                            userId: validatedInvite.user_id,
                            email: validatedInvite.email,
                            token: token,
                            storeId: validatedInvite.store_id,
                            invitedBy: 0, // RPC doesn't return this
                            status: validatedInvite.status as InviteStatus,
                            createdAt: new Date(), // RPC doesn't return this
                            expiresAt: new Date(validatedInvite.expires_at)
                        };
                        
                        // Fetch the associated user using RPC data as fallback
                        await fetchUserFromSupabase(validatedInvite.user_id, validatedInvite.store_id);
                    }
                } else {
                    // Fallback to direct query if RPC fails or returns no data
                    console.log('[TeamInvites] RPC returned no data, trying direct query...');
                    
                    const { data, error } = await supabase
                        .from('team_invites')
                        .select('*')
                        .eq('token', token)
                        .maybeSingle(); // maybeSingle is safer than single
                    
                    if (error) {
                        console.error('[TeamInvites] Supabase direct query error:', JSON.stringify(error, null, 2));
                    } else if (data) {
                        console.log('[TeamInvites] ✅ Found invite in Supabase via direct query:', data.id);
                        
                        // Convert Supabase format to local format
                        invite = {
                            id: data.id,
                            userId: data.user_id,
                            email: data.email,
                            token: data.token,
                            storeId: data.store_id,
                            invitedBy: data.invited_by,
                            status: data.status as InviteStatus,
                            createdAt: new Date(data.created_at),
                            expiresAt: new Date(data.expires_at),
                            acceptedAt: data.accepted_at ? new Date(data.accepted_at) : undefined
                        };
                        
                        // Also need to fetch the associated user from Supabase
                        await fetchUserFromSupabase(data.user_id, data.store_id);
                    }
                }
                
                // Store invite locally for future use
                if (invite) {
                    try {
                        await db.teamInvites.put(invite);
                        console.log('[TeamInvites] ✅ Cached invite locally');
                    } catch (cacheError) {
                        console.warn('[TeamInvites] Could not cache invite locally:', cacheError);
                    }
                } else {
                    console.log('[TeamInvites] No invite found in Supabase for token');
                }
            } catch (supabaseError) {
                console.error('[TeamInvites] Unexpected error fetching from Supabase:', supabaseError);
            }
        } else {
            console.warn('[TeamInvites] Supabase client not available for validation');
        }
    } else {
        console.log('[TeamInvites] Found invite locally for token:', token.slice(0, 8) + '...');
    }
    
    if (!invite) {
        console.log('[TeamInvites] Invite not found in local DB or Supabase');
        return null;
    }
    
    // MULTI-TENANT: Verify the invite belongs to the current store
    if (enforceStoreId) {
        const currentStoreId = getStoreId();
        if (!currentStoreId || invite.storeId !== currentStoreId) {
            console.warn('[TeamInvites] Invite storeId mismatch:', {
                inviteStoreId: invite.storeId,
                currentStoreId
            });
            return null;
        }
    }
    
    // Check status
    if (invite.status !== 'pending') {
        return null;
    }
    
    // Check expiration
    if (isInviteExpired(invite)) {
        // Mark as expired
        await db.teamInvites.update(invite.id!, { status: 'expired' as InviteStatus });
        return null;
    }
    
    return invite;
}

/**
 * Sync a local user to Supabase
 * This ensures the user data is available for team members on new devices
 */
async function syncUserToSupabase(user: User, storeId: string): Promise<void> {
    const supabase = getSupabase();
    if (!supabase || !user.id) return;
    
    try {
        // Get role info for sync
        const role = await db.localRoles.get(user.roleId);
        
        // First, sync the role if it exists
        if (role && role.id) {
            await syncRoleToSupabase(role, storeId);
        }
        
        // Check if user already exists in Supabase
        const { data: existingUser, error: checkError } = await supabase
            .from('users')
            .select('id')
            .eq('local_id', user.id)
            .eq('store_id', storeId)
            .single();
        
        if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
            console.error('[TeamInvites] Error checking existing user:', checkError);
        }
        
        const userData = {
            store_id: storeId,
            local_id: user.id,
            username: user.username || user.displayName?.toLowerCase().replace(/\s+/g, '_') || `user_${user.id}`,
            display_name: user.displayName || 'Usuario',
            email: user.email || null,
            phone: user.phone || null,
            pin: user.pin,
            role_id: user.roleId,
            role_name: role?.name || user.roleName || null,
            firebase_uid: user.firebaseUid || null,
            has_full_access: user.hasFullAccess || false,
            is_active: user.isActive !== false,
            last_login: user.lastLogin?.toISOString() || null,
            created_by: user.createdBy || null
        };
        
        if (existingUser) {
            // Update existing user
            const { error: updateError } = await supabase
                .from('users')
                .update(userData)
                .eq('id', existingUser.id);
            
            if (updateError) {
                console.error('[TeamInvites] Failed to update user in Supabase:', updateError);
            } else {
                console.log('[TeamInvites] ✅ Updated user in Supabase:', user.id);
            }
        } else {
            // Insert new user
            const { error: insertError } = await supabase
                .from('users')
                .insert(userData);
            
            if (insertError) {
                console.error('[TeamInvites] Failed to insert user in Supabase:', insertError);
            } else {
                console.log('[TeamInvites] ✅ Synced user to Supabase:', user.id);
            }
        }
    } catch (err) {
        console.error('[TeamInvites] Error syncing user to Supabase:', err);
    }
}

/**
 * Sync a local role to Supabase
 */
async function syncRoleToSupabase(role: Role, storeId: string): Promise<void> {
    const supabase = getSupabase();
    if (!supabase || !role.id) return;
    
    try {
        // Check if role already exists in Supabase
        const { data: existingRole, error: checkError } = await supabase
            .from('roles')
            .select('id')
            .eq('local_id', role.id)
            .eq('store_id', storeId)
            .single();
        
        if (checkError && checkError.code !== 'PGRST116') {
            console.error('[TeamInvites] Error checking existing role:', checkError);
        }
        
        const roleData = {
            store_id: storeId,
            local_id: role.id,
            name: role.name,
            description: role.description || null,
            permissions: role.permissions || [],
            is_system: role.isSystem || false  // Fixed: use isSystem per Role interface
        };
        
        if (existingRole) {
            // Update existing role
            const { error: updateError } = await supabase
                .from('roles')
                .update(roleData)
                .eq('id', existingRole.id);
            
            if (updateError) {
                console.error('[TeamInvites] Failed to update role in Supabase:', updateError);
            } else {
                console.log('[TeamInvites] ✅ Updated role in Supabase:', role.id);
            }
        } else {
            // Insert new role
            const { error: insertError } = await supabase
                .from('roles')
                .insert(roleData);
            
            if (insertError) {
                console.error('[TeamInvites] Failed to insert role in Supabase:', insertError);
            } else {
                console.log('[TeamInvites] ✅ Synced role to Supabase:', role.id);
            }
        }
    } catch (err) {
        console.error('[TeamInvites] Error syncing role to Supabase:', err);
    }
}

/**
 * Fetch user data from Supabase and cache locally
 * This is needed when validating invites on new devices
 * NOTE: Supabase uses local_id to map to the local Dexie auto-increment ID
 */
async function fetchUserFromSupabase(localUserId: number, storeId: string): Promise<void> {
    const supabase = getSupabase();
    if (!supabase) return;
    
    try {
        // First try RPC function that bypasses RLS (for new devices)
        console.log('[TeamInvites] Fetching user via RPC for local_id:', localUserId, 'store_id:', storeId);
        const { data: rpcData, error: rpcError } = await supabase
            .rpc('get_user_for_invite', { 
                p_local_id: localUserId, 
                p_store_id: storeId 
            });
        
        let data = rpcData?.[0];
        
        if (rpcError || !data) {
            if (rpcError) {
                console.warn('[TeamInvites] RPC get_user_for_invite failed:', JSON.stringify(rpcError, null, 2));
            }
            
            // Fallback to direct query (works if store_id is set or RLS allows)
            console.log('[TeamInvites] Trying direct user query...');
            const { data: directData, error: directError } = await supabase
                .from('users')
                .select('*')
                .eq('local_id', localUserId)
                .eq('store_id', storeId)
                .single();
            
            if (directError) {
                console.error('[TeamInvites] Could not fetch user from Supabase:', JSON.stringify(directError, null, 2));
                return;
            }
            data = directData;
        }
        
        if (data) {
            // Convert and cache locally using local_id as the Dexie ID
            const localUser: User = {
                id: data.local_id,  // Use local_id as the Dexie ID
                username: data.username || data.display_name?.toLowerCase().replace(/\s+/g, '_') || `user_${data.local_id}`,
                displayName: data.display_name || 'Usuario',
                pin: data.pin,
                roleId: data.role_id,
                roleName: data.role_name,
                isActive: data.is_active !== false,
                firebaseUid: data.firebase_uid || undefined,
                email: data.email || undefined,
                phone: data.phone || undefined,
                hasFullAccess: data.has_full_access || false,
                lastLogin: data.last_login ? new Date(data.last_login) : undefined,
                createdAt: data.created_at ? new Date(data.created_at) : new Date(),
                createdBy: data.created_by || undefined,
                realmId: data.store_id  // Use realmId for multi-tenant sync
            };
            
            await db.users.put(localUser);
            console.log('[TeamInvites] ✅ Cached user locally:', localUserId);
            
            // Also fetch and cache the role
            if (data.role_id) {
                await fetchRoleFromSupabase(data.role_id, storeId);
            }
        }
    } catch (err) {
        console.error('[TeamInvites] Error fetching user:', err);
    }
}

/**
 * Fetch role data from Supabase and cache locally
 * NOTE: Supabase uses local_id to map to the local Dexie auto-increment ID
 */
async function fetchRoleFromSupabase(localRoleId: number, storeId: string): Promise<void> {
    const supabase = getSupabase();
    if (!supabase) return;
    
    try {
        // First try RPC function that bypasses RLS (for new devices)
        console.log('[TeamInvites] Fetching role via RPC for local_id:', localRoleId, 'store_id:', storeId);
        const { data: rpcData, error: rpcError } = await supabase
            .rpc('get_role_for_invite', { 
                p_local_id: localRoleId, 
                p_store_id: storeId 
            });
        
        let data = rpcData?.[0];
        
        if (rpcError || !data) {
            if (rpcError) {
                console.warn('[TeamInvites] RPC get_role_for_invite failed:', JSON.stringify(rpcError, null, 2));
            }
            
            // Fallback to direct query
            console.log('[TeamInvites] Trying direct role query...');
            const { data: directData, error: directError } = await supabase
                .from('roles')
                .select('*')
                .eq('local_id', localRoleId)
                .eq('store_id', storeId)
                .single();
            
            if (directError) {
                console.error('[TeamInvites] Could not fetch role from Supabase:', JSON.stringify(directError, null, 2));
                return;
            }
            data = directData;
        }
        
        if (data) {
            // Convert and cache locally using local_id as the Dexie ID
            const localRole: Role = {
                id: data.local_id,  // Use local_id as the Dexie ID
                name: data.name,
                description: data.description || undefined,
                permissions: data.permissions || [],
                isSystem: data.is_system || false,  // Correct property name per interface
                createdAt: data.created_at ? new Date(data.created_at) : new Date(),
                realmId: data.store_id  // Use realmId for multi-tenant sync
            };
            
            await db.localRoles.put(localRole);
            console.log('[TeamInvites] ✅ Cached role locally:', localRoleId);
        }
    } catch (err) {
        console.error('[TeamInvites] Error fetching role:', err);
    }
}

/**
 * Accept an invite and link the Firebase account
 * Handles both cases: user on same device (has storeId) or new device (no storeId yet)
 * 
 * @param token - The invite token
 * @param firebaseUid - The Firebase UID to link
 * @returns The updated user
 */
export async function acceptInvite(token: string, firebaseUid: string): Promise<User> {
    if (!browser) throw new Error('Cannot accept invite on server');
    
    // Validate invite WITHOUT store ID enforcement
    // Team members on new devices won't have a storeId yet
    const invite = await validateInvite(token, false);
    if (!invite) {
        throw new Error('Invalid or expired invite');
    }
    
    // Check if device already has a store registered
    const currentStoreId = getStoreId();
    
    if (currentStoreId && invite.storeId !== currentStoreId) {
        // Device has a different store - switch to the invite's store
        // This happens when someone tests invites on the same device
        console.log('[TeamInvites] Switching store for invite:', {
            oldStoreId: currentStoreId,
            newStoreId: invite.storeId
        });
        
        // Update the store ID to match the invite
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('storeId', invite.storeId);
            console.log('[TeamInvites] ✅ Updated storeId to:', invite.storeId);
        }
    }
    
    // If no store registered yet, this is a team member on a new device
    // Set the storeId from the invite
    if (!currentStoreId) {
        console.log('[TeamInvites] Team member on new device, setting invite storeId:', invite.storeId);
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('storeId', invite.storeId);
        }
    }
    
    // Get the user
    const user = await db.users.get(invite.userId);
    if (!user) {
        throw new Error('User account no longer exists');
    }
    
    // Check if Firebase UID is already linked to another user
    const existingUser = await db.users
        .filter(u => u.firebaseUid === firebaseUid)
        .first();
    
    if (existingUser && existingUser.id !== user.id) {
        throw new Error('This Firebase account is already linked to another user');
    }
    
    // Link Firebase account to user
    await db.users.update(user.id!, {
        firebaseUid,
        hasFullAccess: true,
        email: invite.email
    });
    
    // Mark invite as accepted (local)
    await db.teamInvites.update(invite.id!, {
        status: 'accepted' as InviteStatus,
        acceptedAt: new Date()
    });
    
    // CRITICAL: Also sync acceptance to Supabase for cross-device access
    // Without this, new devices can't find the team membership
    const supabase = getSupabase();
    if (supabase) {
        try {
            const { error: supabaseError } = await supabase
                .from('team_invites')
                .update({ 
                    status: 'accepted',
                    accepted_at: new Date().toISOString()
                })
                .eq('token', token);
            
            if (supabaseError) {
                console.error('[TeamInvites] Failed to sync acceptance to Supabase:', supabaseError);
                // Don't throw - local acceptance still succeeded
            } else {
                console.log('[TeamInvites] ✅ Synced invite acceptance to Supabase');
            }
        } catch (syncError) {
            console.error('[TeamInvites] Error syncing to Supabase:', syncError);
            // Don't throw - local acceptance still succeeded
        }
    }
    
    console.log('[TeamInvites] ✅ Invite accepted for user:', user.id, 'to store:', invite.storeId);
    
    // Return updated user
    const updatedUser = await db.users.get(user.id!);
    return updatedUser!;
}

/**
 * Revoke a pending invite
 */
export async function revokeInvite(inviteId: string): Promise<void> {
    if (!browser) return;
    
    const invite = await db.teamInvites.get(inviteId);
    if (!invite) {
        throw new Error('Invite not found');
    }
    
    // MULTI-TENANT: Verify the invite belongs to the current store
    const currentStoreId = getStoreId();
    if (!currentStoreId || invite.storeId !== currentStoreId) {
        throw new Error('Cannot revoke invite from a different store');
    }
    
    if (invite.status !== 'pending') {
        throw new Error('Can only revoke pending invites');
    }
    
    await db.teamInvites.update(inviteId, { status: 'revoked' as InviteStatus });
}

/**
 * Resend an invite (generates new token and sends new email)
 */
export async function resendInvite(inviteId: string): Promise<TeamInvite> {
    if (!browser) throw new Error('Cannot resend invite on server');
    
    const invite = await db.teamInvites.get(inviteId);
    if (!invite) {
        throw new Error('Invite not found');
    }
    
    // MULTI-TENANT: Verify the invite belongs to the current store
    const currentStoreId = getStoreId();
    if (!currentStoreId || invite.storeId !== currentStoreId) {
        throw new Error('Cannot resend invite from a different store');
    }
    
    if (invite.status === 'accepted') {
        throw new Error('Cannot resend an already accepted invite');
    }
    
    // Create new invite (this will revoke the old one)
    const newInvite = await createInvite(invite.userId, invite.email, invite.invitedBy);
    await sendInviteEmail(newInvite);
    
    return newInvite;
}

// ============================================================
// QUERY FUNCTIONS
// ============================================================

/**
 * Get pending invite for a user
 */
export async function getPendingInvite(userId: number): Promise<TeamInvite | null> {
    if (!browser) return null;
    
    const invite = await db.teamInvites
        .where('userId')
        .equals(userId)
        .and(i => i.status === 'pending')
        .first();
    
    if (invite && isInviteExpired(invite)) {
        await db.teamInvites.update(invite.id!, { status: 'expired' as InviteStatus });
        return null;
    }
    
    return invite || null;
}

/**
 * Get all invites for a user (all statuses)
 */
export async function getUserInvites(userId: number): Promise<TeamInvite[]> {
    if (!browser) return [];
    
    return db.teamInvites.where('userId').equals(userId).toArray();
}

/**
 * Get invite by email
 */
export async function getInviteByEmail(email: string): Promise<TeamInvite | null> {
    if (!browser) return null;
    
    const normalizedEmail = email.toLowerCase().trim();
    const invite = await db.teamInvites
        .where('email')
        .equals(normalizedEmail)
        .and(i => i.status === 'pending')
        .first();
    
    if (invite && isInviteExpired(invite)) {
        await db.teamInvites.update(invite.id!, { status: 'expired' as InviteStatus });
        return null;
    }
    
    return invite || null;
}

/**
 * Get all pending invites for the current store
 */
export async function getAllPendingInvites(): Promise<TeamInvite[]> {
    if (!browser) return [];
    
    const storeId = getStoreId();
    if (!storeId) return [];
    
    const invites = await db.teamInvites
        .where('storeId')
        .equals(storeId)
        .and(i => i.status === 'pending')
        .toArray();
    
    // Check and update expired invites
    const validInvites: TeamInvite[] = [];
    for (const invite of invites) {
        if (isInviteExpired(invite)) {
            await db.teamInvites.update(invite.id!, { status: 'expired' as InviteStatus });
        } else {
            validInvites.push(invite);
        }
    }
    
    return validInvites;
}

// ============================================================
// FIREBASE EMAIL LINK HELPERS
// ============================================================

/**
 * Check if current URL is a Firebase sign-in link
 */
export function isFirebaseSignInLink(url: string): boolean {
    const auth = getFirebaseAuth();
    if (!auth) return false;
    return isSignInWithEmailLink(auth, url);
}

/**
 * Complete Firebase sign-in with email link
 * @param email - The email used for sign-in
 * @param url - The current URL containing the sign-in link
 * @returns The Firebase User
 */
export async function completeEmailSignIn(email: string, url: string) {
    const auth = getFirebaseAuth();
    if (!auth) {
        throw new Error('Firebase Auth not initialized');
    }
    
    const result = await signInWithEmailLink(auth, email, url);
    
    // Clear stored email
    if (browser) {
        localStorage.removeItem('emailForSignIn');
    }
    
    return result.user;
}

/**
 * Get stored email for sign-in (used when returning from email link)
 */
export function getStoredEmailForSignIn(): string | null {
    if (!browser) return null;
    return localStorage.getItem('emailForSignIn');
}

/**
 * Get the invite URL for sharing/display
 */
export function getInviteUrl(token: string): string {
    return `${getInviteBaseUrl()}/invite/${token}`;
}

