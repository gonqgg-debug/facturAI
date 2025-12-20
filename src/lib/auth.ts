import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import type { User, Role, PermissionKey } from './types';
import { encryptedStorage, clearEncryptionKey as clearEncKey } from './encryption';

// ============ SAFE STORAGE HELPERS ============
// Safari private browsing and other edge cases can throw on localStorage access

function safeLocalStorageGet(key: string): string | null {
    if (!browser) return null;
    try {
        return localStorage.getItem(key);
    } catch (error) {
        console.warn('localStorage.getItem failed (private browsing?):', error);
        return null;
    }
}

function safeLocalStorageSet(key: string, value: string): void {
    if (!browser) return;
    try {
        localStorage.setItem(key, value);
    } catch (error) {
        console.warn('localStorage.setItem failed (private browsing?):', error);
    }
}

function safeLocalStorageRemove(key: string): void {
    if (!browser) return;
    try {
        localStorage.removeItem(key);
    } catch (error) {
        console.warn('localStorage.removeItem failed:', error);
    }
}

// ============ LEGACY AUTH (backward compatibility) ============
// Will be phased out once multi-user is fully active

function createAuthStore() {
    const stored = browser ? safeLocalStorageGet('isAuthenticated') === 'true' : false;
    const { subscribe, set } = writable(stored);

    return {
        subscribe,
        login: (pin: string) => {
            // Legacy login - will be replaced by user-based login
            // For now, any valid user PIN works
            set(true);
            safeLocalStorageSet('isAuthenticated', 'true');
            return true;
        },
        logout: () => {
            set(false);
            safeLocalStorageRemove('isAuthenticated');
            safeLocalStorageRemove('currentUserId');
            currentUser.set(null);
            currentRole.set(null);
        },
        setAuthenticated: (value: boolean) => {
            set(value);
            if (value) {
                safeLocalStorageSet('isAuthenticated', 'true');
            } else {
                safeLocalStorageRemove('isAuthenticated');
            }
        }
    };
}

export const isAuthenticated = createAuthStore();

// ============ MULTI-USER AUTH ============

// Current logged-in user
export const currentUser = writable<User | null>(null);

// Current user's role
export const currentRole = writable<Role | null>(null);

// ============ SESSION TIMEOUT ============

// Session timeout configuration (default: 24 hours)
const SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const SESSION_ACTIVITY_KEY = 'session_last_activity';
const SESSION_START_KEY = 'session_start_time';

// Track user activity (call this on user interactions)
export function updateSessionActivity(): void {
    if (!browser) return;
    const now = Date.now();
    safeLocalStorageSet(SESSION_ACTIVITY_KEY, now.toString());
    
    // Set session start time if it doesn't exist (first activity after login)
    if (!safeLocalStorageGet(SESSION_START_KEY)) {
        safeLocalStorageSet(SESSION_START_KEY, now.toString());
    }
}

// Check if session has expired
export function checkSessionTimeout(): { expired: boolean; timeRemaining?: number } {
    if (!browser) return { expired: false };
    
    const lastActivity = safeLocalStorageGet(SESSION_ACTIVITY_KEY);
    const sessionStart = safeLocalStorageGet(SESSION_START_KEY);
    
    // No session data means no active session
    if (!lastActivity || !sessionStart) {
        return { expired: true };
    }
    
    const now = Date.now();
    const lastActivityTime = parseInt(lastActivity, 10);
    const sessionStartTime = parseInt(sessionStart, 10);
    const timeSinceActivity = now - lastActivityTime;
    const timeSinceStart = now - sessionStartTime;
    
    // Check if session has expired based on last activity
    // Also check total session duration (safety check)
    if (timeSinceActivity >= SESSION_TIMEOUT_MS || timeSinceStart >= SESSION_TIMEOUT_MS) {
        return { expired: true };
    }
    
    const timeRemaining = SESSION_TIMEOUT_MS - timeSinceActivity;
    return { expired: false, timeRemaining };
}

// Clear session timeout data
function clearSessionData(): void {
    if (!browser) return;
    safeLocalStorageRemove(SESSION_ACTIVITY_KEY);
    safeLocalStorageRemove(SESSION_START_KEY);
}

// Check if user has a specific permission
export function hasPermission(permission: PermissionKey): boolean {
    const role = get(currentRole);
    if (!role) return false;
    return role.permissions.includes(permission);
}

// Reactive permission checker (for use in components)
export const userPermissions = derived(currentRole, ($role) => {
    const permissions = new Set<PermissionKey>($role?.permissions || []);
    return {
        has: (permission: PermissionKey) => permissions.has(permission),
        hasAny: (...perms: PermissionKey[]) => perms.some(p => permissions.has(p)),
        hasAll: (...perms: PermissionKey[]) => perms.every(p => permissions.has(p))
    };
});

// Rate limiting for login attempts
interface LoginAttempt {
    count: number;
    lastAttempt: number;
    lockedUntil?: number;
}

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds
const ATTEMPT_WINDOW = 60 * 1000; // 1 minute window for counting attempts

function getLoginAttemptsKey(pin: string): string {
    // Use a hash of the PIN to track attempts without storing the actual PIN
    // In a real implementation, this should be server-side with IP tracking
    return `login_attempts_${btoa(pin).slice(0, 10)}`;
}

function checkRateLimit(pin: string): { allowed: boolean; remainingAttempts: number; lockedUntil?: number } {
    if (!browser) return { allowed: true, remainingAttempts: MAX_LOGIN_ATTEMPTS };
    
    const key = getLoginAttemptsKey(pin);
    const stored = safeLocalStorageGet(key);
    const now = Date.now();
    
    if (!stored) {
        return { allowed: true, remainingAttempts: MAX_LOGIN_ATTEMPTS };
    }
    
    try {
        const attempts: LoginAttempt = JSON.parse(stored);
        
        // Check if account is locked
        if (attempts.lockedUntil && now < attempts.lockedUntil) {
            return {
                allowed: false,
                remainingAttempts: 0,
                lockedUntil: attempts.lockedUntil
            };
        }
        
        // Reset if lockout period has passed
        if (attempts.lockedUntil && now >= attempts.lockedUntil) {
            safeLocalStorageRemove(key);
            return { allowed: true, remainingAttempts: MAX_LOGIN_ATTEMPTS };
        }
        
        // Reset attempts if outside the time window
        if (now - attempts.lastAttempt > ATTEMPT_WINDOW) {
            safeLocalStorageRemove(key);
            return { allowed: true, remainingAttempts: MAX_LOGIN_ATTEMPTS };
        }
        
        const remaining = Math.max(0, MAX_LOGIN_ATTEMPTS - attempts.count);
        
        return {
            allowed: attempts.count < MAX_LOGIN_ATTEMPTS,
            remainingAttempts: remaining
        };
    } catch {
        // Invalid stored data, reset
        safeLocalStorageRemove(key);
        return { allowed: true, remainingAttempts: MAX_LOGIN_ATTEMPTS };
    }
}

function recordFailedAttempt(pin: string): void {
    if (!browser) return;
    
    const key = getLoginAttemptsKey(pin);
    const now = Date.now();
    const stored = safeLocalStorageGet(key);
    
    let attempts: LoginAttempt;
    
    if (stored) {
        try {
            attempts = JSON.parse(stored);
            // Reset if outside time window
            if (now - attempts.lastAttempt > ATTEMPT_WINDOW) {
                attempts = { count: 0, lastAttempt: now };
            }
        } catch {
            attempts = { count: 0, lastAttempt: now };
        }
    } else {
        attempts = { count: 0, lastAttempt: now };
    }
    
    attempts.count++;
    attempts.lastAttempt = now;
    
    // Lock account if max attempts reached
    if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
        attempts.lockedUntil = now + LOCKOUT_DURATION;
    }
    
    safeLocalStorageSet(key, JSON.stringify(attempts));
}

function clearLoginAttempts(pin: string): void {
    if (!browser) return;
    const key = getLoginAttemptsKey(pin);
    safeLocalStorageRemove(key);
}

// Login with PIN - returns user if found, null otherwise
// Includes rate limiting to prevent brute force attacks
export async function loginWithPin(pin: string): Promise<User | null> {
    if (!browser) return null;
    
    // Check rate limit
    const rateLimit = checkRateLimit(pin);
    if (!rateLimit.allowed) {
        const minutesRemaining = rateLimit.lockedUntil 
            ? Math.ceil((rateLimit.lockedUntil - Date.now()) / 60000)
            : 0;
        throw new Error(`Too many failed login attempts. Please try again in ${minutesRemaining} minute(s).`);
    }
    
    const { db } = await import('./db');
    
    // Find user by PIN
    const user = await db.users
        .where('pin')
        .equals(pin)
        .filter(u => u.isActive)
        .first();
    
    if (user) {
        // Clear failed attempts on successful login
        clearLoginAttempts(pin);
        
        // Get user's role
        const role = await db.localRoles.get(user.roleId);
        
        // Update stores
        currentUser.set(user);
        currentRole.set(role || null);
        isAuthenticated.setAuthenticated(true);
        
        // Update last login
        if (user.id) {
            await db.users.update(user.id, { lastLogin: new Date() });
        }
        
        // Store user ID for session persistence (encrypted)
        if (browser) {
            await encryptedStorage.setItem('currentUserId', String(user.id));
            // Initialize session tracking
            updateSessionActivity();
        }
        
        return user;
    }
    
    // Record failed attempt
    recordFailedAttempt(pin);
    
    return null;
}

// Restore session from localStorage
// Prevents multiple simultaneous calls
let isRestoringSession = false;
let lastRestorePromise: Promise<boolean> | null = null;

export async function restoreSession(): Promise<boolean> {
    if (!browser) return false;
    
    // If already restoring, return the existing promise
    if (isRestoringSession && lastRestorePromise) {
        return lastRestorePromise;
    }
    
    isRestoringSession = true;
    lastRestorePromise = (async () => {
        try {
            // Check if session has expired
            const sessionCheck = checkSessionTimeout();
            if (sessionCheck.expired) {
                // Session expired, clear all session data and logout
                clearSessionData();
                await logout();
                return false;
            }
            
            // Try to get user ID - check both encrypted and plaintext storage
            let userId: string | null = null;
            
            // First, try plaintext (for backward compatibility and if encryption fails)
            userId = safeLocalStorageGet('currentUserId');
            
            // If no plaintext, try encrypted storage
            if (!userId) {
                try {
                    userId = await encryptedStorage.getItem('currentUserId');
                } catch (error) {
                    // If encryption/decryption fails, try plaintext as fallback
                    console.warn('Encrypted storage access failed, trying plaintext fallback:', error);
                    userId = safeLocalStorageGet('currentUserId');
                }
            }
            
            // If we found encrypted data but decryption returned null, try plaintext
            if (!userId) {
                const encryptedValue = safeLocalStorageGet('currentUserId');
                if (encryptedValue && !encryptedValue.startsWith('encrypted:')) {
                    // It's plaintext, use it
                    userId = encryptedValue;
                }
            }
            
            const wasAuthenticated = safeLocalStorageGet('isAuthenticated') === 'true';
            
            // Only proceed if we have both userId and authenticated flag
            if (!userId || !wasAuthenticated) {
                // Don't clear session here - might be in the middle of encryption migration
                // Only clear if explicitly not authenticated
                if (wasAuthenticated === false || (userId === null && !safeLocalStorageGet('currentUserId'))) {
                    clearSessionData();
                    await encryptedStorage.removeItem('currentUserId').catch(() => {});
                    safeLocalStorageRemove('currentUserId');
                    safeLocalStorageRemove('isAuthenticated');
                }
                return false;
            }
            
            // Validate user exists and is active
            try {
                const { db } = await import('./db');
                
                // Validate userId is a valid number before querying
                const numericUserId = Number(userId);
                if (!Number.isFinite(numericUserId) || numericUserId <= 0) {
                    console.warn('Invalid userId stored, clearing session:', userId);
                    clearSessionData();
                    await encryptedStorage.removeItem('currentUserId').catch(() => {});
                    safeLocalStorageRemove('currentUserId');
                    safeLocalStorageRemove('isAuthenticated');
                    return false;
                }
                
                const user = await db.users.get(numericUserId);
                
                if (user && user.isActive) {
                    const role = await db.localRoles.get(user.roleId);
                    currentUser.set(user);
                    currentRole.set(role || null);
                    isAuthenticated.setAuthenticated(true);
                    
                    // If we used plaintext, try to encrypt it for future use (non-blocking)
                    const currentValue = safeLocalStorageGet('currentUserId');
                    if (currentValue && !currentValue.startsWith('encrypted:')) {
                        // Migrate to encrypted storage in background (don't wait)
                        encryptedStorage.setItem('currentUserId', userId).catch(() => {
                            // If encryption fails, keep plaintext - don't break the session
                            console.warn('Failed to encrypt userId, keeping plaintext');
                        });
                    }
                    
                    // Update activity timestamp on successful restore
                    updateSessionActivity();
                    return true;
                }
            } catch (error) {
                // Properly log error details for debugging
                const errorMsg = error instanceof Error 
                    ? error.message 
                    : (typeof error === 'object' ? JSON.stringify(error) : String(error));
                console.error('Error restoring session:', errorMsg);
                // Don't log out on database errors - might be temporary
                return false;
            }
            
            // User not found or inactive - clear session
            clearSessionData();
            await encryptedStorage.removeItem('currentUserId').catch(() => {});
            safeLocalStorageRemove('currentUserId');
            safeLocalStorageRemove('isAuthenticated');
            return false;
        } finally {
            isRestoringSession = false;
        }
    })();
    
    return lastRestorePromise;
}

// Logout current user
export async function logout() {
    currentUser.set(null);
    currentRole.set(null);
    isAuthenticated.logout();
    // Clear session timeout data on logout
    clearSessionData();
    // Clear encrypted storage
    await encryptedStorage.removeItem('currentUserId');
    safeLocalStorageRemove('currentUserId'); // Also remove plaintext if exists
    // Clear encryption key (will regenerate on next login)
    clearEncKey();
}

// ============ FIREBASE -> LOCAL AUTH BRIDGE ============

/**
 * Login using Firebase authentication (for store owners/admins and invited team members)
 * This finds or creates a user and sets up local authentication
 * after Firebase authentication has completed.
 * 
 * Priority order for user lookup:
 * 1. Find user by firebaseUid (team member who accepted invite)
 * 2. Find user by email (existing admin/owner)
 * 3. Create new admin user (store owner first login)
 * 
 * @param firebaseUserOverride - Optional Firebase user to use instead of getting from store
 */
export async function loginWithFirebase(firebaseUserOverride?: { email: string | null; displayName: string | null; uid: string }): Promise<User | null> {
    if (!browser) return null;
    
    let firebaseUser = firebaseUserOverride;
    
    // If no override provided, try to get from Firebase store
    if (!firebaseUser) {
        const { getCurrentUser } = await import('./firebase');
        const currentUser = getCurrentUser();
        if (currentUser) {
            firebaseUser = {
                email: currentUser.email,
                displayName: currentUser.displayName,
                uid: currentUser.uid
            };
        }
    }
    
    if (!firebaseUser) {
        console.error('[Auth] No Firebase user found');
        return null;
    }
    
    console.log('[Auth] loginWithFirebase called for:', firebaseUser.email);
    
    const { db } = await import('./db');
    
    let user: User | undefined;
    
    try {
        // PRIORITY 1: Look for a user linked by Firebase UID (team member who accepted invite)
        console.log('[Auth] Searching for user with firebaseUid:', firebaseUser.uid);
        user = await db.users
            .filter(u => u.firebaseUid === firebaseUser!.uid)
            .first();
        
        if (user) {
            console.log('[Auth] Found user by firebaseUid:', user.id, user.displayName);
        }
        
        // PRIORITY 2: Look for a user by email (existing admin/owner or user before linking)
        if (!user && firebaseUser.email) {
            console.log('[Auth] Searching for user with email:', firebaseUser.email);
            user = await db.users
                .where('email')
                .equals(firebaseUser.email)
                .first();
            
            if (user) {
                console.log('[Auth] Found user by email:', user.id, user.displayName);
                
                // Link Firebase UID to this user if not already linked
                if (!user.firebaseUid && user.id) {
                    console.log('[Auth] Linking Firebase UID to existing user');
                    await db.users.update(user.id, { 
                        firebaseUid: firebaseUser.uid,
                        hasFullAccess: true
                    });
                    user.firebaseUid = firebaseUser.uid;
                    user.hasFullAccess = true;
                }
            }
        }
        
        // PRIORITY 3: Create a new admin user for this Firebase account (store owner first login)
        if (!user) {
            console.log('[Auth] Creating admin user for Firebase account:', firebaseUser.email);
            
            // Get or create the admin role
            console.log('[Auth] Looking for Administrador role...');
            let adminRole = await db.localRoles
                .where('name')
                .equals('Administrador')
                .first();
            
            if (!adminRole) {
                console.log('[Auth] Creating Administrador role...');
                // Create admin role with all permissions
                const adminRoleId = await db.localRoles.add({
                    name: 'Administrador',
                    permissions: [
                        'pos.access', 'pos.sell', 'pos.apply_discount', 'pos.void_item', 'pos.process_return', 'pos.view_returns',
                        'shifts.open', 'shifts.close', 'shifts.view_all', 'shifts.cash_in_out',
                        'inventory.view', 'inventory.adjust', 'inventory.view_costs',
                        'catalog.view', 'catalog.edit', 'catalog.delete', 'catalog.import',
                        'customers.view', 'customers.edit', 'customers.delete', 'customers.view_balance',
                        'invoices.view', 'invoices.capture', 'invoices.edit', 'invoices.delete', 'payments.record',
                        'reports.view', 'reports.export', 'reports.view_profit',
                        'settings.view', 'settings.edit',
                        'users.manage',
                        'system.backup', 'system.reset'
                    ],
                    createdAt: new Date()
                });
                adminRole = await db.localRoles.get(adminRoleId);
                console.log('[Auth] Created Administrador role with ID:', adminRoleId);
            } else {
                console.log('[Auth] Found existing Administrador role:', adminRole.id);
            }
            
            // Generate a random PIN for the new user
            const randomPin = String(Math.floor(1000 + Math.random() * 9000));
            
            // Create the admin user with Firebase linking
            console.log('[Auth] Creating new user...');
            const displayName = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Admin';
            const username = firebaseUser.email?.split('@')[0]?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'admin';
            const userId = await db.users.add({
                username,
                displayName,
                email: firebaseUser.email || undefined,
                firebaseUid: firebaseUser.uid,
                hasFullAccess: true,
                pin: randomPin,
                roleId: adminRole!.id!,
                roleName: adminRole!.name,
                isActive: true,
                createdAt: new Date(),
                lastLogin: new Date()
            });
            
            user = await db.users.get(userId);
            console.log('[Auth] Created admin user with ID:', userId, 'PIN:', randomPin);
        } else {
            console.log('[Auth] Found existing user:', user.id, user.displayName);
            // Update last login
            if (user.id) {
                await db.users.update(user.id, { lastLogin: new Date() });
            }
        }
    } catch (dbError) {
        console.error('[Auth] Database operation failed:', dbError);
        throw dbError;
    }
    
    if (!user) {
        console.error('[Auth] Failed to create/find user');
        return null;
    }
    
    console.log('[Auth] Found/created user:', user.id, user.displayName);
    
    // Get user's role
    const role = await db.localRoles.get(user.roleId);
    console.log('[Auth] User role:', role?.name);
    
    // Update stores - this sets up local authentication
    console.log('[Auth] Setting currentUser store...');
    currentUser.set(user);
    
    console.log('[Auth] Setting currentRole store...');
    currentRole.set(role || null);
    
    console.log('[Auth] Setting isAuthenticated to true...');
    isAuthenticated.setAuthenticated(true);
    
    // Initialize session
    console.log('[Auth] Updating session activity...');
    updateSessionActivity();
    
    // Store user ID for session persistence - use BOTH encrypted and plaintext for reliability
    if (browser) {
        const userIdStr = String(user.id);
        console.log('[Auth] Storing user ID:', userIdStr);
        
        // Store in plaintext localStorage as backup (more reliable)
        safeLocalStorageSet('currentUserId', userIdStr);
        
        // Also try encrypted storage
        try {
            await encryptedStorage.setItem('currentUserId', userIdStr);
            console.log('[Auth] User ID stored in encrypted storage');
        } catch (err) {
            console.warn('[Auth] Failed to store in encrypted storage, using plaintext:', err);
        }
        
        // Verify localStorage was set correctly
        const storedAuth = safeLocalStorageGet('isAuthenticated');
        const storedUserId = safeLocalStorageGet('currentUserId');
        console.log('[Auth] Verification - isAuthenticated in localStorage:', storedAuth);
        console.log('[Auth] Verification - currentUserId in localStorage:', storedUserId);
    }
    
    console.log('[Auth] Firebase user logged in as:', user.displayName);
    
    // If user has users.manage permission (admin), sync all team users from Supabase
    // This ensures admins see all team members even on new devices
    if (role && role.permissions.includes('users.manage')) {
        console.log('[Auth] User has users.manage permission, syncing team users...');
        try {
            const { syncTeamUsersFromSupabase } = await import('./team-invites');
            const { getStoreId } = await import('./device-auth');
            const storeId = getStoreId();
            if (storeId) {
                await syncTeamUsersFromSupabase(storeId);
                console.log('[Auth] ✅ Team users synced');
            } else {
                console.warn('[Auth] No store ID found, cannot sync team users');
            }
        } catch (syncError) {
            // Don't block login if sync fails - it's non-critical
            console.error('[Auth] Failed to sync team users (non-critical):', syncError);
        }
    }
    
    return user;
}

// Permission guard for routes - can be used in load functions
export function requirePermission(permission: PermissionKey): boolean {
    return hasPermission(permission);
}

// ============ FIREBASE AUTH RE-EXPORTS ============
// Re-export Firebase auth functions and stores from firebase.ts for convenience

export {
    firebaseUser,
    firebaseUserEmail,
    firebaseUserId,
    isFirebaseAuthenticated,
    signInWithEmail,
    signInWithGoogle,
    signUpWithEmail,
    firebaseSignOut as signOutFirebase,
    resetPassword as sendPasswordReset,
    getCurrentUser,
    initializeFirebase
} from './firebase';
