import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import type { User, Role, PermissionKey } from './types';

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

// Login with PIN - returns user if found, null otherwise
export async function loginWithPin(pin: string): Promise<User | null> {
    if (!browser) return null;
    
    const { db } = await import('./db');
    
    // Find user by PIN
    const user = await db.users
        .where('pin')
        .equals(pin)
        .filter(u => u.isActive)
        .first();
    
    if (user) {
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
        
        // Store user ID for session persistence
        if (browser) {
            localStorage.setItem('currentUserId', String(user.id));
        }
        
        return user;
    }
    
    return null;
}

// Restore session from localStorage
export async function restoreSession(): Promise<boolean> {
    if (!browser) return false;
    
    const userId = localStorage.getItem('currentUserId');
    const wasAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
    
    if (userId && wasAuthenticated) {
        const { db } = await import('./db');
        const user = await db.users.get(Number(userId));
        
        if (user && user.isActive) {
            const role = await db.roles.get(user.roleId);
            currentUser.set(user);
            currentRole.set(role || null);
            isAuthenticated.setAuthenticated(true);
            return true;
        }
    }
    
    // Clear invalid session
    localStorage.removeItem('currentUserId');
    localStorage.removeItem('isAuthenticated');
    return false;
}

// Logout current user
export function logout() {
    currentUser.set(null);
    currentRole.set(null);
    isAuthenticated.logout();
}

// Permission guard for routes - can be used in load functions
export function requirePermission(permission: PermissionKey): boolean {
    return hasPermission(permission);
}
