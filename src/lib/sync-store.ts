/**
 * Sync Store Module
 * 
 * Reactive Svelte stores for tracking sync status.
 * Replaces the Dexie Cloud sync status with Supabase-based sync status.
 */

import { writable, derived, type Readable } from 'svelte/store';
import { browser } from '$app/environment';

// ============================================================
// TYPES
// ============================================================

export type SyncState = 
    | 'idle'            // Not syncing, no pending changes
    | 'syncing'         // Actively syncing
    | 'pending'         // Has pending changes to sync
    | 'error'           // Sync error occurred
    | 'offline'         // No internet connection
    | 'not_registered'; // Device not registered

export interface SyncStatus {
    state: SyncState;
    lastSyncAt: Date | null;
    pendingChangesCount: number;
    error: string | null;
    isOnline: boolean;
    syncProgress: number; // 0-100
}

export interface SyncStats {
    totalPushed: number;
    totalPulled: number;
    lastPushAt: Date | null;
    lastPullAt: Date | null;
    failedAttempts: number;
}

// ============================================================
// INITIAL STATE
// ============================================================

const initialSyncStatus: SyncStatus = {
    state: 'not_registered',
    lastSyncAt: null,
    pendingChangesCount: 0,
    error: null,
    isOnline: browser ? navigator.onLine : true,
    syncProgress: 0
};

const initialSyncStats: SyncStats = {
    totalPushed: 0,
    totalPulled: 0,
    lastPushAt: null,
    lastPullAt: null,
    failedAttempts: 0
};

// ============================================================
// STORES
// ============================================================

const syncStatusStore = writable<SyncStatus>(initialSyncStatus);
const syncStatsStore = writable<SyncStats>(initialSyncStats);

// Public readable stores
export const syncStatus: Readable<SyncStatus> = {
    subscribe: syncStatusStore.subscribe
};

export const syncStats: Readable<SyncStats> = {
    subscribe: syncStatsStore.subscribe
};

// ============================================================
// DERIVED STORES
// ============================================================

/**
 * Whether sync is currently active
 */
export const isSyncing = derived(
    syncStatus,
    $status => $status.state === 'syncing'
);

/**
 * Whether there are pending changes to sync
 */
export const hasPendingChanges = derived(
    syncStatus,
    $status => $status.pendingChangesCount > 0
);

/**
 * Whether the app is online
 */
export const isOnline = derived(
    syncStatus,
    $status => $status.isOnline
);

/**
 * Whether sync can be performed (online + registered)
 */
export const canSync = derived(
    syncStatus,
    $status => $status.isOnline && $status.state !== 'not_registered'
);

/**
 * Human-readable sync status message
 */
export const syncMessage = derived(
    syncStatus,
    $status => {
        switch ($status.state) {
            case 'idle':
                if ($status.lastSyncAt) {
                    return formatRelativeTime($status.lastSyncAt);
                }
                return 'Ready to sync';
            case 'syncing':
                if ($status.syncProgress > 0) {
                    return `Syncing... ${$status.syncProgress}%`;
                }
                return 'Syncing...';
            case 'pending':
                return `${$status.pendingChangesCount} pending change${$status.pendingChangesCount !== 1 ? 's' : ''}`;
            case 'error':
                return $status.error || 'Sync error';
            case 'offline':
                return 'Offline - changes saved locally';
            case 'not_registered':
                return 'Device not registered';
            default:
                return 'Unknown status';
        }
    }
);

/**
 * Simple sync status for UI components
 * Provides a simplified view of sync state
 */
export interface SimpleSyncStatus {
    syncing: boolean;
    lastSync: string | null;
    pendingChanges: number;
    error: string | null;
}

export const simpleSyncStatus = derived(
    syncStatus,
    ($status): SimpleSyncStatus => ({
        syncing: $status.state === 'syncing',
        lastSync: $status.lastSyncAt?.toISOString() || null,
        pendingChanges: $status.pendingChangesCount,
        error: $status.error
    })
);

// ============================================================
// UPDATE FUNCTIONS
// ============================================================

/**
 * Set sync state
 */
export function setSyncState(state: SyncState, error?: string): void {
    syncStatusStore.update(s => ({
        ...s,
        state,
        error: error || null,
        lastSyncAt: state === 'idle' ? new Date() : s.lastSyncAt
    }));
}

/**
 * Set pending changes count
 */
export function setPendingChanges(count: number): void {
    syncStatusStore.update(s => ({
        ...s,
        pendingChangesCount: count,
        state: count > 0 && s.state === 'idle' ? 'pending' : s.state
    }));
}

/**
 * Set sync progress (0-100)
 */
export function setSyncProgress(progress: number): void {
    syncStatusStore.update(s => ({
        ...s,
        syncProgress: Math.min(100, Math.max(0, progress))
    }));
}

/**
 * Set online status
 */
export function setOnlineStatus(isOnline: boolean): void {
    syncStatusStore.update(s => ({
        ...s,
        isOnline,
        state: !isOnline ? 'offline' : (s.state === 'offline' ? 'idle' : s.state)
    }));
}

/**
 * Update sync stats after push
 */
export function recordPush(count: number): void {
    syncStatsStore.update(s => ({
        ...s,
        totalPushed: s.totalPushed + count,
        lastPushAt: new Date()
    }));
}

/**
 * Update sync stats after pull
 */
export function recordPull(count: number): void {
    syncStatsStore.update(s => ({
        ...s,
        totalPulled: s.totalPulled + count,
        lastPullAt: new Date()
    }));
}

/**
 * Record a failed sync attempt
 */
export function recordSyncFailure(): void {
    syncStatsStore.update(s => ({
        ...s,
        failedAttempts: s.failedAttempts + 1
    }));
}

/**
 * Reset sync stats
 */
export function resetSyncStats(): void {
    syncStatsStore.set(initialSyncStats);
}

/**
 * Mark device as registered and ready to sync
 */
export function markDeviceRegistered(): void {
    syncStatusStore.update(s => ({
        ...s,
        state: s.isOnline ? 'idle' : 'offline'
    }));
}

/**
 * Mark device as not registered
 */
export function markDeviceNotRegistered(): void {
    syncStatusStore.update(s => ({
        ...s,
        state: 'not_registered'
    }));
}

// ============================================================
// ONLINE/OFFLINE DETECTION
// ============================================================

if (browser) {
    window.addEventListener('online', () => setOnlineStatus(true));
    window.addEventListener('offline', () => setOnlineStatus(false));
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Format a date as relative time
 */
function formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) {
        return 'Synced just now';
    } else if (diffMins < 60) {
        return `Synced ${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
        return `Synced ${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else {
        return `Synced ${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    }
}

// ============================================================
// LOCAL STORAGE PERSISTENCE
// ============================================================

const LAST_SYNC_KEY = 'minimarket_last_sync';

/**
 * Get last sync timestamp from localStorage
 */
export function getLastSyncTimestamp(): string | null {
    if (!browser) return null;
    return localStorage.getItem(LAST_SYNC_KEY);
}

/**
 * Set last sync timestamp in localStorage
 */
export function setLastSyncTimestamp(timestamp: string): void {
    if (!browser) return;
    localStorage.setItem(LAST_SYNC_KEY, timestamp);
}

/**
 * Initialize sync status from localStorage
 */
export function initializeSyncStatus(isRegistered: boolean): void {
    if (!browser) return;
    
    const lastSync = getLastSyncTimestamp();
    
    syncStatusStore.set({
        state: isRegistered ? (navigator.onLine ? 'idle' : 'offline') : 'not_registered',
        lastSyncAt: lastSync ? new Date(lastSync) : null,
        pendingChangesCount: 0,
        error: null,
        isOnline: navigator.onLine,
        syncProgress: 0
    });
}

