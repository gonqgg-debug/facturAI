import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import type { User, Role, PermissionKey } from './types';
import { encryptedStorage, clearEncryptionKey as clearEncKey } from './encryption';

// ============ LEGACY AUTH (backward compatibility) ============
// Will be phased out once multi-user is fully active

function createAuthStore() {
    const stored = browser ? localStorage.getItem('isAuthenticated') === 'true' : false;
    const { subscribe, set } = writable(stored);

    return {
        subscribe,
        login: (pin: string) => {
            // Legacy login - will be replaced by user-based login
            // For now, any valid user PIN works
            set(true);
            if (browser) localStorage.setItem('isAuthenticated', 'true');
            return true;
        },
        logout: () => {
            set(false);
            if (browser) {
                localStorage.removeItem('isAuthenticated');
                localStorage.removeItem('currentUserId');
            }
            currentUser.set(null);
            currentRole.set(null);
        },
        setAuthenticated: (value: boolean) => {
            set(value);
            if (browser) {
                if (value) {
                    localStorage.setItem('isAuthenticated', 'true');
                } else {
                    localStorage.removeItem('isAuthenticated');
                }
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
    localStorage.setItem(SESSION_ACTIVITY_KEY, now.toString());
    
    // Set session start time if it doesn't exist (first activity after login)
    if (!localStorage.getItem(SESSION_START_KEY)) {
        localStorage.setItem(SESSION_START_KEY, now.toString());
    }
}

// Check if session has expired
export function checkSessionTimeout(): { expired: boolean; timeRemaining?: number } {
    if (!browser) return { expired: false };
    
    const lastActivity = localStorage.getItem(SESSION_ACTIVITY_KEY);
    const sessionStart = localStorage.getItem(SESSION_START_KEY);
    
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
    localStorage.removeItem(SESSION_ACTIVITY_KEY);
    localStorage.removeItem(SESSION_START_KEY);
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
    const stored = localStorage.getItem(key);
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
            localStorage.removeItem(key);
            return { allowed: true, remainingAttempts: MAX_LOGIN_ATTEMPTS };
        }
        
        // Reset attempts if outside the time window
        if (now - attempts.lastAttempt > ATTEMPT_WINDOW) {
            localStorage.removeItem(key);
            return { allowed: true, remainingAttempts: MAX_LOGIN_ATTEMPTS };
        }
        
        const remaining = Math.max(0, MAX_LOGIN_ATTEMPTS - attempts.count);
        
        return {
            allowed: attempts.count < MAX_LOGIN_ATTEMPTS,
            remainingAttempts: remaining
        };
    } catch {
        // Invalid stored data, reset
        localStorage.removeItem(key);
        return { allowed: true, remainingAttempts: MAX_LOGIN_ATTEMPTS };
    }
}

function recordFailedAttempt(pin: string): void {
    if (!browser) return;
    
    const key = getLoginAttemptsKey(pin);
    const now = Date.now();
    const stored = localStorage.getItem(key);
    
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
    
    localStorage.setItem(key, JSON.stringify(attempts));
}

function clearLoginAttempts(pin: string): void {
    if (!browser) return;
    const key = getLoginAttemptsKey(pin);
    localStorage.removeItem(key);
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
        const role = await db.roles.get(user.roleId);
        
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
            userId = localStorage.getItem('currentUserId');
            
            // If no plaintext, try encrypted storage
            if (!userId) {
                try {
                    userId = await encryptedStorage.getItem('currentUserId');
                } catch (error) {
                    // If encryption/decryption fails, try plaintext as fallback
                    console.warn('Encrypted storage access failed, trying plaintext fallback:', error);
                    userId = localStorage.getItem('currentUserId');
                }
            }
            
            // If we found encrypted data but decryption returned null, try plaintext
            if (!userId) {
                const encryptedValue = localStorage.getItem('currentUserId');
                if (encryptedValue && !encryptedValue.startsWith('encrypted:')) {
                    // It's plaintext, use it
                    userId = encryptedValue;
                }
            }
            
            const wasAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
            
            // Only proceed if we have both userId and authenticated flag
            if (!userId || !wasAuthenticated) {
                // Don't clear session here - might be in the middle of encryption migration
                // Only clear if explicitly not authenticated
                if (wasAuthenticated === false || (userId === null && !localStorage.getItem('currentUserId'))) {
                    clearSessionData();
                    await encryptedStorage.removeItem('currentUserId').catch(() => {});
                    localStorage.removeItem('currentUserId');
                    localStorage.removeItem('isAuthenticated');
                }
                return false;
            }
            
            // Validate user exists and is active
            try {
                const { db } = await import('./db');
                const user = await db.users.get(Number(userId));
                
                if (user && user.isActive) {
                    const role = await db.roles.get(user.roleId);
                    currentUser.set(user);
                    currentRole.set(role || null);
                    isAuthenticated.setAuthenticated(true);
                    
                    // If we used plaintext, try to encrypt it for future use (non-blocking)
                    const currentValue = localStorage.getItem('currentUserId');
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
                console.error('Error restoring session:', error);
                // Don't log out on database errors - might be temporary
                return false;
            }
            
            // User not found or inactive - clear session
            clearSessionData();
            await encryptedStorage.removeItem('currentUserId').catch(() => {});
            localStorage.removeItem('currentUserId');
            localStorage.removeItem('isAuthenticated');
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
    localStorage.removeItem('currentUserId'); // Also remove plaintext if exists
    // Clear encryption key (will regenerate on next login)
    clearEncKey();
}

// Permission guard for routes - can be used in load functions
export function requirePermission(permission: PermissionKey): boolean {
    return hasPermission(permission);
}
