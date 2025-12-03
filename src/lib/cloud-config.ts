/**
 * Dexie Cloud Configuration
 * 
 * This module handles cloud sync configuration and status management.
 * Part of Phase 6.1: Dexie Cloud Integration
 */

import { writable, derived, type Readable } from 'svelte/store';
import { browser } from '$app/environment';

// ============ CLOUD CONFIGURATION ============

/**
 * Cloud database URL from environment variable
 * Set VITE_DEXIE_CLOUD_URL in your .env file
 */
export const DEXIE_CLOUD_URL = browser 
    ? (import.meta.env.VITE_DEXIE_CLOUD_URL as string | undefined)
    : undefined;

/**
 * Whether cloud sync is configured (URL is set)
 */
export const isCloudConfigured = !!DEXIE_CLOUD_URL;

/**
 * Whether cloud sync is force-enabled
 * Cloud sync requires VITE_DEXIE_CLOUD_FORCE_ENABLE=true for existing databases
 * This is to prevent accidental data loss from schema migration
 */
export const isCloudForceEnabled = browser 
    ? (import.meta.env.VITE_DEXIE_CLOUD_FORCE_ENABLE === 'true')
    : false;

/**
 * Whether cloud sync is fully enabled
 * Requires both URL and force flag for existing databases
 */
export const isCloudEnabled = isCloudConfigured && isCloudForceEnabled;

// ============ SYNC STATUS ============

export type SyncState = 
    | 'offline'           // No internet connection
    | 'connecting'        // Establishing connection
    | 'syncing'          // Actively syncing data
    | 'synced'           // All changes synced
    | 'error'            // Sync error occurred
    | 'not-configured';  // Cloud URL not set

export interface SyncStatus {
    state: SyncState;
    lastSyncedAt: Date | null;
    pendingChanges: number;
    error: string | null;
    isOnline: boolean;
}

const initialSyncStatus: SyncStatus = {
    state: isCloudEnabled ? 'connecting' : 'not-configured',
    lastSyncedAt: null,
    pendingChanges: 0,
    error: null,
    isOnline: browser ? navigator.onLine : true
};

// Create the sync status store
const syncStatusStore = writable<SyncStatus>(initialSyncStatus);

export const syncStatus: Readable<SyncStatus> = {
    subscribe: syncStatusStore.subscribe
};

// ============ SYNC STATUS MANAGEMENT ============

/**
 * Update sync status
 */
export function updateSyncStatus(updates: Partial<SyncStatus>): void {
    syncStatusStore.update(status => ({
        ...status,
        ...updates
    }));
}

/**
 * Set sync state
 */
export function setSyncState(state: SyncState, error?: string): void {
    syncStatusStore.update(status => ({
        ...status,
        state,
        error: error || null,
        lastSyncedAt: state === 'synced' ? new Date() : status.lastSyncedAt
    }));
}

/**
 * Update pending changes count
 */
export function setPendingChanges(count: number): void {
    syncStatusStore.update(status => ({
        ...status,
        pendingChanges: count
    }));
}

// ============ ONLINE/OFFLINE DETECTION ============

if (browser) {
    // Update online status
    const updateOnlineStatus = () => {
        const isOnline = navigator.onLine;
        syncStatusStore.update(status => ({
            ...status,
            isOnline,
            state: !isOnline ? 'offline' : (status.state === 'offline' ? 'connecting' : status.state)
        }));
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
}

// ============ DERIVED STORES ============

/**
 * Whether the app can sync (cloud enabled + online)
 */
export const canSync = derived(
    syncStatus,
    $status => isCloudEnabled && $status.isOnline
);

/**
 * Whether sync is currently active
 */
export const isSyncing = derived(
    syncStatus,
    $status => $status.state === 'syncing' || $status.state === 'connecting'
);

/**
 * Whether there are pending changes to sync
 */
export const hasPendingChanges = derived(
    syncStatus,
    $status => $status.pendingChanges > 0
);

/**
 * Human-readable sync status message
 */
export const syncMessage = derived(
    syncStatus,
    $status => {
        switch ($status.state) {
            case 'offline':
                return 'Sin conexión - Los cambios se guardarán localmente';
            case 'connecting':
                return 'Conectando...';
            case 'syncing':
                return $status.pendingChanges > 0 
                    ? `Sincronizando ${$status.pendingChanges} cambio(s)...`
                    : 'Sincronizando...';
            case 'synced':
                return $status.lastSyncedAt 
                    ? `Sincronizado ${formatRelativeTime($status.lastSyncedAt)}`
                    : 'Sincronizado';
            case 'error':
                return `Error: ${$status.error || 'Error de sincronización'}`;
            case 'not-configured':
                return 'Modo sin conexión (nube no configurada)';
            default:
                return 'Estado desconocido';
        }
    }
);

// ============ UTILITY FUNCTIONS ============

/**
 * Format a date as relative time (e.g., "hace 5 minutos")
 */
function formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) {
        return 'hace unos segundos';
    } else if (diffMins < 60) {
        return `hace ${diffMins} minuto${diffMins !== 1 ? 's' : ''}`;
    } else if (diffHours < 24) {
        return `hace ${diffHours} hora${diffHours !== 1 ? 's' : ''}`;
    } else {
        return `hace ${diffDays} día${diffDays !== 1 ? 's' : ''}`;
    }
}

// ============ CLOUD AUTH STATUS ============

export type CloudAuthState = 
    | 'unauthenticated'
    | 'authenticating'
    | 'authenticated'
    | 'error';

export interface CloudAuthStatus {
    state: CloudAuthState;
    userId: string | null;
    email: string | null;
    error: string | null;
}

const initialAuthStatus: CloudAuthStatus = {
    state: 'unauthenticated',
    userId: null,
    email: null,
    error: null
};

const cloudAuthStore = writable<CloudAuthStatus>(initialAuthStatus);

export const cloudAuth: Readable<CloudAuthStatus> = {
    subscribe: cloudAuthStore.subscribe
};

/**
 * Update cloud auth status
 */
export function updateCloudAuth(updates: Partial<CloudAuthStatus>): void {
    cloudAuthStore.update(status => ({
        ...status,
        ...updates
    }));
}

/**
 * Whether user is authenticated with cloud
 */
export const isCloudAuthenticated = derived(
    cloudAuth,
    $auth => $auth.state === 'authenticated'
);

// ============ CONFIGURATION TYPES ============

/**
 * Tables that should sync to the cloud
 * These are shared business data that needs to be available across devices
 */
export const SYNCED_TABLES = [
    'products',
    'invoices',
    'suppliers',
    'customers',
    'sales',
    'payments',
    'returns',
    'bankAccounts',
    'rules',
    'globalContext',
    'stockMovements',
    'purchaseOrders',
    'receipts',
    'customerSegments',
    'weatherRecords'
] as const;

/**
 * Tables that stay local-only
 * These are device-specific or temporary data
 */
export const LOCAL_ONLY_TABLES = [
    'shifts',           // Cash register shifts are device-specific
    'users',            // Users managed by Dexie Cloud auth (Phase 6.2)
    'roles',            // Roles managed locally for now
    'transactionFeatures',  // AI analysis cache
    'realTimeInsights'      // Temporary insights
] as const;

export type SyncedTable = typeof SYNCED_TABLES[number];
export type LocalTable = typeof LOCAL_ONLY_TABLES[number];

// ============ REALM CONFIGURATION ============

/**
 * Default realm for single-tenant mode
 * In Phase 6.3, this will be replaced with tenant-specific realms
 */
export const DEFAULT_REALM = 'rlm-public';

/**
 * Get the current realm ID
 * For now, returns the default realm. In Phase 6.3, this will return the tenant ID.
 */
export function getCurrentRealm(): string {
    // TODO: Phase 6.3 - Return current tenant ID
    return DEFAULT_REALM;
}

