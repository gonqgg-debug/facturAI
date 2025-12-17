/**
 * Team Invites Service
 * 
 * Manages email invites for team members to create full Firebase accounts,
 * enabling web login access (not just PIN-based POS access).
 */

import { browser } from '$app/environment';
import { db, generateId } from './db';
import type { TeamInvite, User, InviteStatus } from './types';
import { getStoreId } from './device-auth';
import { sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, getAuth } from 'firebase/auth';
import { getFirebaseAuth } from './firebase';

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
    const invite: TeamInvite = {
        id: generateId(),
        userId,
        email: email.toLowerCase().trim(),
        token,
        storeId,
        invitedBy,
        status: 'pending',
        createdAt: new Date(),
        expiresAt: calculateExpirationDate()
    };
    
    await db.teamInvites.add(invite);
    
    // Update user email if not set
    if (!user.email || user.email !== email) {
        await db.users.update(userId, { email: email.toLowerCase().trim() });
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
    
    const invite = await db.teamInvites.where('token').equals(token).first();
    
    if (!invite) {
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
 * Accept an invite and link the Firebase account
 * @param token - The invite token
 * @param firebaseUid - The Firebase UID to link
 * @returns The updated user
 */
export async function acceptInvite(token: string, firebaseUid: string): Promise<User> {
    if (!browser) throw new Error('Cannot accept invite on server');
    
    // MULTI-TENANT: Validate invite with store ID enforcement
    const invite = await validateInvite(token, true);
    if (!invite) {
        throw new Error('Invalid or expired invite');
    }
    
    // Double-check store ID (defensive programming)
    const currentStoreId = getStoreId();
    if (!currentStoreId || invite.storeId !== currentStoreId) {
        console.error('[TeamInvites] Store mismatch in acceptInvite:', {
            inviteStoreId: invite.storeId,
            currentStoreId
        });
        throw new Error('This invite is not valid for this store');
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
    
    // Mark invite as accepted
    await db.teamInvites.update(invite.id!, {
        status: 'accepted' as InviteStatus,
        acceptedAt: new Date()
    });
    
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

