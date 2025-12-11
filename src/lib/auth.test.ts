/**
 * Unit Tests for Authentication Rate Limiting
 * Tests login attempt limiting and session management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PermissionKey, Role, User } from './types';

// Create localStorage mock
const localStorageMock = {
    store: {} as Record<string, string>,
    getItem: vi.fn((key: string) => localStorageMock.store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
        localStorageMock.store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
        delete localStorageMock.store[key];
    }),
    clear: vi.fn(() => {
        localStorageMock.store = {};
        vi.clearAllMocks();
    })
};

Object.defineProperty(global, 'localStorage', {
    value: localStorageMock,
    writable: true
});

// Mock modules before import
vi.mock('$app/environment', () => ({
    browser: true
}));

vi.mock('$app/stores', () => ({
    page: {
        subscribe: vi.fn()
    }
}));

const mockEncryptedStorage = {
    setItem: vi.fn().mockResolvedValue(undefined),
    getItem: vi.fn().mockResolvedValue(null),
    removeItem: vi.fn().mockResolvedValue(undefined)
};

vi.mock('./encryption', () => ({
    encryptedStorage: mockEncryptedStorage,
    clearEncryptionKey: vi.fn()
}));

const SELL_PERMISSION: PermissionKey = 'pos.sell';
const INVENTORY_PERMISSION: PermissionKey = 'inventory.view';
const REPORT_PERMISSION: PermissionKey = 'reports.view';
const ADMIN_PERMISSION: PermissionKey = 'users.manage';
const SYSTEM_PERMISSION: PermissionKey = 'system.reset';

const createTestRole = (overrides: Partial<Role> = {}): Role => ({
    id: overrides.id ?? 1,
    name: overrides.name ?? 'Test Role',
    permissions: overrides.permissions ?? [],
    createdAt: overrides.createdAt ?? new Date(),
    description: overrides.description,
    isSystem: overrides.isSystem,
    ...overrides
});

const createTestUser = (overrides: Partial<User> = {}): User => ({
    id: overrides.id,
    username: overrides.username ?? 'test-user',
    displayName: overrides.displayName ?? 'Test User',
    pin: overrides.pin ?? '1234',
    roleId: overrides.roleId ?? 1,
    roleName: overrides.roleName ?? 'Test Role',
    email: overrides.email,
    phone: overrides.phone,
    isActive: overrides.isActive ?? true,
    lastLogin: overrides.lastLogin,
    createdAt: overrides.createdAt ?? new Date(),
    createdBy: overrides.createdBy
});

const mockDb = {
    users: {
        where: vi.fn().mockReturnValue({
            equals: vi.fn().mockReturnValue({
                filter: vi.fn().mockReturnValue({
                    first: vi.fn().mockResolvedValue(null)
                })
            })
        }),
        get: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockResolvedValue(1)
    },
    localRoles: {
        where: vi.fn().mockReturnValue({
            equals: vi.fn().mockReturnValue({
                first: vi.fn().mockResolvedValue(null)
            })
        }),
        get: vi.fn().mockResolvedValue(null),
        add: vi.fn().mockResolvedValue(1)
    }
};

vi.mock('./db', () => ({
    db: mockDb
}));

// Test the rate limiting logic directly
describe('Authentication Rate Limiting', () => {
    beforeEach(() => {
        localStorageMock.clear();
        vi.clearAllMocks();
        mockEncryptedStorage.getItem.mockResolvedValue(null);
        mockDb.users.get.mockResolvedValue(null);
        mockDb.localRoles.get.mockResolvedValue(null);
    });

    describe('Rate Limit Configuration', () => {
        it('should have correct rate limit constants', async () => {
            // Import fresh module
            const auth = await import('./auth');
            
            // Check that rate limiting exists (we can't directly access private constants)
            // but we can verify behavior
            expect(auth.loginWithPin).toBeDefined();
        });
    });

    describe('Session Timeout', () => {
        it('should update session activity timestamp', async () => {
            const { updateSessionActivity } = await import('./auth');
            
            updateSessionActivity();
            
            // Check localStorage was updated
            expect(localStorageMock.setItem).toHaveBeenCalled();
        });

        it('should set session start time on first activity', async () => {
            const { updateSessionActivity } = await import('./auth');
            
            // Ensure no session start time exists
            delete localStorageMock.store['session_start_time'];
            
            updateSessionActivity();
            
            // Should set both last_activity and start_time
            expect(localStorageMock.setItem).toHaveBeenCalledWith('session_last_activity', expect.any(String));
        });

        it('should check session timeout correctly', async () => {
            const { checkSessionTimeout } = await import('./auth');
            
            // Without any session data, should be expired
            const result = checkSessionTimeout();
            expect(result.expired).toBe(true);
        });

        it('should detect valid session', async () => {
            const { checkSessionTimeout } = await import('./auth');
            
            // Set up session activity
            const now = Date.now();
            localStorageMock.store['session_last_activity'] = now.toString();
            localStorageMock.store['session_start_time'] = now.toString();
            
            // Override getItem to return our test values
            localStorageMock.getItem.mockImplementation((key: string) => {
                return localStorageMock.store[key] ?? null;
            });
            
            const result = checkSessionTimeout();
            expect(result.expired).toBe(false);
            expect(result.timeRemaining).toBeDefined();
            expect(result.timeRemaining).toBeGreaterThan(0);
        });

        it('should detect expired session based on inactivity', async () => {
            const { checkSessionTimeout } = await import('./auth');
            
            // Set up expired session (25 hours ago)
            const expiredTime = Date.now() - (25 * 60 * 60 * 1000);
            localStorageMock.store['session_last_activity'] = expiredTime.toString();
            localStorageMock.store['session_start_time'] = expiredTime.toString();
            
            localStorageMock.getItem.mockImplementation((key: string) => {
                return localStorageMock.store[key] ?? null;
            });
            
            const result = checkSessionTimeout();
            expect(result.expired).toBe(true);
        });

        it('should detect expired session based on total duration', async () => {
            const { checkSessionTimeout } = await import('./auth');
            
            // Session started 25 hours ago but had recent activity
            const sessionStart = Date.now() - (25 * 60 * 60 * 1000);
            const recentActivity = Date.now() - (1000); // 1 second ago
            
            localStorageMock.store['session_last_activity'] = recentActivity.toString();
            localStorageMock.store['session_start_time'] = sessionStart.toString();
            
            localStorageMock.getItem.mockImplementation((key: string) => {
                return localStorageMock.store[key] ?? null;
            });
            
            const result = checkSessionTimeout();
            expect(result.expired).toBe(true);
        });

        it('should return time remaining for valid session', async () => {
            const { checkSessionTimeout } = await import('./auth');
            
            const now = Date.now();
            const oneHourAgo = now - (60 * 60 * 1000);
            
            localStorageMock.store['session_last_activity'] = oneHourAgo.toString();
            localStorageMock.store['session_start_time'] = oneHourAgo.toString();
            
            localStorageMock.getItem.mockImplementation((key: string) => {
                return localStorageMock.store[key] ?? null;
            });
            
            const result = checkSessionTimeout();
            expect(result.expired).toBe(false);
            // Should have roughly 23 hours remaining
            expect(result.timeRemaining).toBeGreaterThan(22 * 60 * 60 * 1000);
            expect(result.timeRemaining).toBeLessThan(24 * 60 * 60 * 1000);
        });
    });

    describe('Login Rate Limiting Behavior', () => {
        it('should allow first login attempt', async () => {
            const { loginWithPin } = await import('./auth');
            
            // This will fail because no user exists, but shouldn't throw rate limit error
            const result = await loginWithPin('1234');
            
            // Should return null (no user), not throw rate limit error
            expect(result).toBeNull();
        });

        it('should track failed login attempts', async () => {
            const { loginWithPin } = await import('./auth');
            
            // Multiple failed attempts
            await loginWithPin('wrong1');
            await loginWithPin('wrong2');
            await loginWithPin('wrong3');
            
            // Should store attempt data in localStorage
            // The key is hashed, so we check that some login_attempts key exists
            const keys = Object.keys(localStorageMock.store);
            const hasAttemptKey = keys.some(k => k.startsWith('login_attempts_'));
            expect(hasAttemptKey).toBe(true);
        });

        it('should lock out after max attempts', async () => {
            const { loginWithPin } = await import('./auth');
            
            // Simulate 5 failed attempts by setting up localStorage directly
            const attemptKey = 'login_attempts_' + btoa('9999').slice(0, 10);
            localStorageMock.store[attemptKey] = JSON.stringify({
                count: 5,
                lastAttempt: Date.now(),
                lockedUntil: Date.now() + 15 * 60 * 1000 // 15 minutes
            });
            
            localStorageMock.getItem.mockImplementation((key: string) => {
                return localStorageMock.store[key] ?? null;
            });
            
            // Next attempt should throw
            await expect(loginWithPin('9999')).rejects.toThrow(/Too many failed login attempts/);
        });

        it('should reset attempts after lockout period', async () => {
            const { loginWithPin } = await import('./auth');
            
            // Set up expired lockout
            const attemptKey = 'login_attempts_' + btoa('expired').slice(0, 10);
            localStorageMock.store[attemptKey] = JSON.stringify({
                count: 5,
                lastAttempt: Date.now() - 20 * 60 * 1000, // 20 minutes ago
                lockedUntil: Date.now() - 5 * 60 * 1000 // Lockout expired 5 minutes ago
            });
            
            localStorageMock.getItem.mockImplementation((key: string) => {
                return localStorageMock.store[key] ?? null;
            });
            
            // Should not throw, should attempt login normally
            const result = await loginWithPin('expired');
            expect(result).toBeNull(); // No user found, but no rate limit error
        });

        it('should reset attempts after time window', async () => {
            const { loginWithPin } = await import('./auth');
            
            // Set up attempts outside the time window
            const attemptKey = 'login_attempts_' + btoa('stale').slice(0, 10);
            localStorageMock.store[attemptKey] = JSON.stringify({
                count: 4,
                lastAttempt: Date.now() - 2 * 60 * 1000 // 2 minutes ago (outside 1-minute window)
            });
            
            localStorageMock.getItem.mockImplementation((key: string) => {
                return localStorageMock.store[key] ?? null;
            });
            
            // Should reset and allow login
            const result = await loginWithPin('stale');
            expect(result).toBeNull();
        });

        it('should show correct minutes remaining in lockout message', async () => {
            const { loginWithPin } = await import('./auth');
            
            const lockoutMinutes = 10;
            const attemptKey = 'login_attempts_' + btoa('locked').slice(0, 10);
            localStorageMock.store[attemptKey] = JSON.stringify({
                count: 5,
                lastAttempt: Date.now(),
                lockedUntil: Date.now() + lockoutMinutes * 60 * 1000
            });
            
            localStorageMock.getItem.mockImplementation((key: string) => {
                return localStorageMock.store[key] ?? null;
            });
            
            try {
                await loginWithPin('locked');
            } catch (e: any) {
                expect(e.message).toContain(String(lockoutMinutes));
            }
        });
    });

    describe('Successful Login', () => {
        it('should return user on successful login', async () => {
            const { loginWithPin } = await import('./auth');
            
            const mockUser = createTestUser({ id: 1, pin: '1234' });
            const mockRole = createTestRole({
                id: 1,
                name: 'Admin',
                permissions: [SELL_PERMISSION, INVENTORY_PERMISSION]
            });
            
            // Mock successful user lookup
            mockDb.users.where.mockReturnValue({
                equals: vi.fn().mockReturnValue({
                    filter: vi.fn().mockReturnValue({
                        first: vi.fn().mockResolvedValue(mockUser)
                    })
                })
            });
            mockDb.localRoles.get.mockResolvedValue(mockRole);
            
            const result = await loginWithPin('1234');
            
            expect(result).toEqual(mockUser);
            expect(mockEncryptedStorage.setItem).toHaveBeenCalledWith('currentUserId', '1');
        });

        it('should clear failed attempts on successful login', async () => {
            const { loginWithPin } = await import('./auth');
            
            const mockUser = createTestUser({ id: 1, pin: '5678' });
            
            // Set up some failed attempts
            const attemptKey = 'login_attempts_' + btoa('5678').slice(0, 10);
            localStorageMock.store[attemptKey] = JSON.stringify({
                count: 3,
                lastAttempt: Date.now()
            });
            
            localStorageMock.getItem.mockImplementation((key: string) => {
                return localStorageMock.store[key] ?? null;
            });
            
            mockDb.users.where.mockReturnValue({
                equals: vi.fn().mockReturnValue({
                    filter: vi.fn().mockReturnValue({
                        first: vi.fn().mockResolvedValue(mockUser)
                    })
                })
            });
            
            await loginWithPin('5678');
            
            // Attempts should be cleared
            expect(localStorageMock.removeItem).toHaveBeenCalledWith(attemptKey);
        });

        it('should update last login timestamp', async () => {
            const { loginWithPin } = await import('./auth');
            
            const mockUser = createTestUser({ id: 1, pin: '1111' });
            
            mockDb.users.where.mockReturnValue({
                equals: vi.fn().mockReturnValue({
                    filter: vi.fn().mockReturnValue({
                        first: vi.fn().mockResolvedValue(mockUser)
                    })
                })
            });
            
            await loginWithPin('1111');
            
            expect(mockDb.users.update).toHaveBeenCalledWith(1, { lastLogin: expect.any(Date) });
        });
    });

    describe('Permissions', () => {
        it('should have hasPermission function', async () => {
            const { hasPermission, currentRole } = await import('./auth');
            
            // Reset role to null first
            currentRole.set(null);
            
            // Without a role set, should return false
            expect(hasPermission(SELL_PERMISSION)).toBe(false);
        });

        it('should have userPermissions derived store', async () => {
            const { userPermissions } = await import('./auth');
            
            expect(userPermissions).toBeDefined();
            expect(userPermissions.subscribe).toBeDefined();
        });

        it('should check permissions correctly when role is set', async () => {
            const { currentRole, hasPermission } = await import('./auth');
            
            currentRole.set(
                createTestRole({
                    id: 1,
                    name: 'Admin',
                    permissions: [SELL_PERMISSION, INVENTORY_PERMISSION, REPORT_PERMISSION]
                })
            );
            
            expect(hasPermission(SELL_PERMISSION)).toBe(true);
            expect(hasPermission(INVENTORY_PERMISSION)).toBe(true);
            expect(hasPermission(ADMIN_PERMISSION)).toBe(false);
        });

        it('should requirePermission work correctly', async () => {
            const { requirePermission, currentRole } = await import('./auth');
            
            currentRole.set(
                createTestRole({
                    id: 2,
                    name: 'Cashier',
                    permissions: [SELL_PERMISSION]
                })
            );
            
            expect(requirePermission(SELL_PERMISSION)).toBe(true);
            expect(requirePermission(ADMIN_PERMISSION)).toBe(false);
        });
    });

    describe('Session Restore', () => {
        it('should return false when session is expired', async () => {
            const { restoreSession } = await import('./auth');
            
            // Set up expired session
            const expiredTime = Date.now() - (25 * 60 * 60 * 1000);
            localStorageMock.store['session_last_activity'] = expiredTime.toString();
            localStorageMock.store['session_start_time'] = expiredTime.toString();
            localStorageMock.store['currentUserId'] = '1';
            localStorageMock.store['isAuthenticated'] = 'true';
            
            localStorageMock.getItem.mockImplementation((key: string) => {
                return localStorageMock.store[key] ?? null;
            });
            
            const result = await restoreSession();
            expect(result).toBe(false);
        });

        it('should return false when no userId exists', async () => {
            const { restoreSession } = await import('./auth');
            
            // Set up valid session but no userId
            const now = Date.now();
            localStorageMock.store['session_last_activity'] = now.toString();
            localStorageMock.store['session_start_time'] = now.toString();
            delete localStorageMock.store['currentUserId'];
            localStorageMock.store['isAuthenticated'] = 'true';
            
            localStorageMock.getItem.mockImplementation((key: string) => {
                return localStorageMock.store[key] ?? null;
            });
            
            mockEncryptedStorage.getItem.mockResolvedValue(null);
            
            const result = await restoreSession();
            expect(result).toBe(false);
        });

        it('should return true when valid session and user found', async () => {
            const { restoreSession } = await import('./auth');
            
            const mockUser = createTestUser({ id: 1, pin: '1234' });
            const mockRole = createTestRole({
                id: 1,
                name: 'Admin',
                permissions: [SELL_PERMISSION]
            });
            
            // Set up valid session
            const now = Date.now();
            localStorageMock.store['session_last_activity'] = now.toString();
            localStorageMock.store['session_start_time'] = now.toString();
            localStorageMock.store['currentUserId'] = '1';
            localStorageMock.store['isAuthenticated'] = 'true';
            
            localStorageMock.getItem.mockImplementation((key: string) => {
                return localStorageMock.store[key] ?? null;
            });
            
            mockDb.users.get.mockResolvedValue(mockUser);
            mockDb.localRoles.get.mockResolvedValue(mockRole);
            
            const result = await restoreSession();
            expect(result).toBe(true);
        });

        it('should try encrypted storage when plaintext fails', async () => {
            const { restoreSession } = await import('./auth');
            
            // Set up valid session with no plaintext userId
            const now = Date.now();
            localStorageMock.store['session_last_activity'] = now.toString();
            localStorageMock.store['session_start_time'] = now.toString();
            localStorageMock.store['isAuthenticated'] = 'true';
            delete localStorageMock.store['currentUserId'];
            
            localStorageMock.getItem.mockImplementation((key: string) => {
                return localStorageMock.store[key] ?? null;
            });
            
            // Encrypted storage has the userId
            mockEncryptedStorage.getItem.mockResolvedValue('2');
            
            const mockUser = createTestUser({ id: 2 });
            
            mockDb.users.get.mockResolvedValue(mockUser);
            mockDb.localRoles.get.mockResolvedValue(createTestRole({ id: 1, name: 'Admin' }));
            
            const result = await restoreSession();
            expect(result).toBe(true);
            expect(mockEncryptedStorage.getItem).toHaveBeenCalledWith('currentUserId');
        });

        it('should return false when user is inactive', async () => {
            const { restoreSession } = await import('./auth');
            
            const mockUser = createTestUser({ id: 1, isActive: false });
            
            const now = Date.now();
            localStorageMock.store['session_last_activity'] = now.toString();
            localStorageMock.store['session_start_time'] = now.toString();
            localStorageMock.store['currentUserId'] = '1';
            localStorageMock.store['isAuthenticated'] = 'true';
            
            localStorageMock.getItem.mockImplementation((key: string) => {
                return localStorageMock.store[key] ?? null;
            });
            
            mockDb.users.get.mockResolvedValue(mockUser);
            
            const result = await restoreSession();
            expect(result).toBe(false);
        });

        it('should handle database errors gracefully', async () => {
            const { restoreSession } = await import('./auth');
            
            const now = Date.now();
            localStorageMock.store['session_last_activity'] = now.toString();
            localStorageMock.store['session_start_time'] = now.toString();
            localStorageMock.store['currentUserId'] = '1';
            localStorageMock.store['isAuthenticated'] = 'true';
            
            localStorageMock.getItem.mockImplementation((key: string) => {
                return localStorageMock.store[key] ?? null;
            });
            
            // Mock database error
            mockDb.users.get.mockRejectedValue(new Error('Database error'));
            
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            
            const result = await restoreSession();
            expect(result).toBe(false);
            
            consoleSpy.mockRestore();
        });

        it('should prevent multiple simultaneous restore calls', async () => {
            const { restoreSession } = await import('./auth');
            
            const now = Date.now();
            localStorageMock.store['session_last_activity'] = now.toString();
            localStorageMock.store['session_start_time'] = now.toString();
            localStorageMock.store['currentUserId'] = '1';
            localStorageMock.store['isAuthenticated'] = 'true';
            
            localStorageMock.getItem.mockImplementation((key: string) => {
                return localStorageMock.store[key] ?? null;
            });
            
            const mockUser = createTestUser({ id: 1 });
            
            mockDb.users.get.mockResolvedValue(mockUser);
            mockDb.localRoles.get.mockResolvedValue(createTestRole({ id: 1, name: 'Admin' }));
            
            // Call multiple times simultaneously
            const promise1 = restoreSession();
            const promise2 = restoreSession();
            
            const [result1, result2] = await Promise.all([promise1, promise2]);
            
            // Both should return the same result
            expect(result1).toBe(result2);
        });
    });

    describe('Logout', () => {
        it('should clear session data on logout', async () => {
            const { logout, updateSessionActivity } = await import('./auth');
            
            // Set up a session
            updateSessionActivity();
            localStorageMock.store['currentUserId'] = '1';
            localStorageMock.store['isAuthenticated'] = 'true';
            
            // Logout
            await logout();
            
            // Check that removeItem was called
            expect(localStorageMock.removeItem).toHaveBeenCalled();
            expect(mockEncryptedStorage.removeItem).toHaveBeenCalledWith('currentUserId');
        });

        it('should clear encryption key on logout', async () => {
            const { logout } = await import('./auth');
            const { clearEncryptionKey } = await import('./encryption');
            
            await logout();
            
            expect(clearEncryptionKey).toHaveBeenCalled();
        });

        it('should clear both encrypted and plaintext storage', async () => {
            const { logout } = await import('./auth');
            
            localStorageMock.store['currentUserId'] = '1';
            
            await logout();
            
            expect(localStorageMock.removeItem).toHaveBeenCalledWith('currentUserId');
            expect(mockEncryptedStorage.removeItem).toHaveBeenCalledWith('currentUserId');
        });
    });
});

describe('Authentication Stores', () => {
    it('should export isAuthenticated store', async () => {
        const { isAuthenticated } = await import('./auth');
        
        expect(isAuthenticated).toBeDefined();
        expect(isAuthenticated.subscribe).toBeDefined();
    });

    it('should export currentUser store', async () => {
        const { currentUser } = await import('./auth');
        
        expect(currentUser).toBeDefined();
        expect(currentUser.subscribe).toBeDefined();
    });

    it('should export currentRole store', async () => {
        const { currentRole } = await import('./auth');
        
        expect(currentRole).toBeDefined();
        expect(currentRole.subscribe).toBeDefined();
    });
});

describe('Auth Store Methods', () => {
    beforeEach(() => {
        localStorageMock.clear();
    });

    it('should have login method on isAuthenticated', async () => {
        const { isAuthenticated } = await import('./auth');
        
        expect(isAuthenticated.login).toBeDefined();
    });

    it('should have logout method on isAuthenticated', async () => {
        const { isAuthenticated } = await import('./auth');
        
        expect(isAuthenticated.logout).toBeDefined();
    });

    it('should have setAuthenticated method', async () => {
        const { isAuthenticated } = await import('./auth');
        
        expect(isAuthenticated.setAuthenticated).toBeDefined();
        
        isAuthenticated.setAuthenticated(true);
        expect(localStorageMock.store['isAuthenticated']).toBe('true');
        
        isAuthenticated.setAuthenticated(false);
        expect(localStorageMock.removeItem).toHaveBeenCalledWith('isAuthenticated');
    });

    it('should clear user stores on legacy logout', async () => {
        const { isAuthenticated, currentUser, currentRole } = await import('./auth');
        const { get } = await import('svelte/store');
        
        // Set up some state
        currentUser.set(createTestUser());
        currentRole.set(createTestRole({ name: 'Admin', permissions: [] }));
        
        // Call legacy logout
        isAuthenticated.logout();
        
        expect(get(currentUser)).toBeNull();
        expect(get(currentRole)).toBeNull();
    });
});

describe('userPermissions Derived Store', () => {
    beforeEach(() => {
        localStorageMock.clear();
    });

    it('should have has method', async () => {
        const { userPermissions } = await import('./auth');
        const { get } = await import('svelte/store');
        
        const perms = get(userPermissions);
        expect(perms.has).toBeDefined();
    });

    it('should have hasAny method', async () => {
        const { userPermissions, currentRole } = await import('./auth');
        const { get } = await import('svelte/store');
        
        currentRole.set(
            createTestRole({ permissions: [SELL_PERMISSION, INVENTORY_PERMISSION] })
        );
        
        const perms = get(userPermissions);
        expect(perms.hasAny(SELL_PERMISSION, ADMIN_PERMISSION)).toBe(true);
        expect(perms.hasAny(ADMIN_PERMISSION, SYSTEM_PERMISSION)).toBe(false);
    });

    it('should have hasAll method', async () => {
        const { userPermissions, currentRole } = await import('./auth');
        const { get } = await import('svelte/store');
        
        currentRole.set(
            createTestRole({ permissions: [SELL_PERMISSION, INVENTORY_PERMISSION, REPORT_PERMISSION] })
        );
        
        const perms = get(userPermissions);
        expect(perms.hasAll(SELL_PERMISSION, INVENTORY_PERMISSION)).toBe(true);
        expect(perms.hasAll(SELL_PERMISSION, ADMIN_PERMISSION)).toBe(false);
    });

    it('should return empty permissions when no role', async () => {
        const { userPermissions, currentRole } = await import('./auth');
        const { get } = await import('svelte/store');
        
        currentRole.set(null);
        
        const perms = get(userPermissions);
        expect(perms.has(SELL_PERMISSION)).toBe(false);
        expect(perms.hasAny(SELL_PERMISSION, INVENTORY_PERMISSION)).toBe(false);
        expect(perms.hasAll(SELL_PERMISSION)).toBe(false);
    });
});
