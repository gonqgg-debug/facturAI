/**
 * Sync Service Module
 * 
 * Handles bidirectional synchronization between local Dexie database
 * and Supabase cloud backend.
 * 
 * Features:
 * - Push local changes to Supabase
 * - Pull remote changes from Supabase
 * - Background sync at configurable intervals
 * - Conflict resolution (last-write-wins)
 * - Offline support with change tracking
 */

import { browser } from '$app/environment';
import { getSupabase, TABLE_NAME_MAP, SYNCED_TABLES, type Database } from './supabase';
import { getStoreId, getDeviceId, getDeviceToken, isDeviceRegistered } from './device-auth';
import { 
    setSyncState, 
    setPendingChanges, 
    setSyncProgress,
    recordPush,
    recordPull,
    recordSyncFailure,
    setLastSyncTimestamp,
    getLastSyncTimestamp,
    markDeviceRegistered,
    markDeviceNotRegistered
} from './sync-store';
import { db, type MinimarketDatabase } from './db';

// ============================================================
// TYPES
// ============================================================

export interface PendingChange {
    id?: number;
    tableName: string;
    recordId: string;
    action: 'insert' | 'update' | 'delete';
    data: Record<string, unknown>;
    timestamp: number;
    synced?: boolean;
}

interface SyncResult {
    success: boolean;
    pushed: number;
    pulled: number;
    errors: string[];
}

// ============================================================
// CONFIGURATION
// ============================================================

const SYNC_INTERVAL_MS = 15000; // 15 seconds
const MAX_BATCH_SIZE = 100; // Max records per batch
const RETRY_DELAY_MS = 5000; // Retry after 5 seconds on failure

// ============================================================
// SYNC SERVICE CLASS
// ============================================================

class SyncService {
    private syncInterval: ReturnType<typeof setInterval> | null = null;
    private isSyncing = false;
    private isInitialized = false;
    
    /**
     * Initialize the sync service
     */
    async initialize(): Promise<void> {
        if (!browser || this.isInitialized) return;
        
        // Check if device is registered
        const deviceToken = getDeviceToken();
        const storeId = getStoreId();
        
        if (deviceToken && storeId) {
            markDeviceRegistered();
            this.isInitialized = true;
            
            // Initial sync
            await this.sync();
            
            // Start background sync
            this.startBackgroundSync();
        } else {
            markDeviceNotRegistered();
        }
    }
    
    /**
     * Start background synchronization
     */
    startBackgroundSync(): void {
        if (!browser) return;
        
        // Clear existing interval
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
        
        // Set up periodic sync
        this.syncInterval = setInterval(() => {
            this.sync().catch(console.error);
        }, SYNC_INTERVAL_MS);
        
        // Sync when coming back online
        window.addEventListener('online', this.handleOnline);
        
        console.log('Background sync started');
    }
    
    /**
     * Stop background synchronization
     */
    stopBackgroundSync(): void {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
        
        if (browser) {
            window.removeEventListener('online', this.handleOnline);
        }
        
        console.log('Background sync stopped');
    }
    
    /**
     * Handle coming back online
     */
    private handleOnline = (): void => {
        console.log('Back online - triggering sync');
        this.sync().catch(console.error);
    };
    
    /**
     * Perform a full sync (push + pull)
     */
    async sync(): Promise<SyncResult> {
        if (!browser || this.isSyncing || !navigator.onLine) {
            return { success: false, pushed: 0, pulled: 0, errors: ['Sync skipped'] };
        }
        
        const storeId = getStoreId();
        const deviceId = getDeviceId();
        
        if (!storeId || !deviceId) {
            return { success: false, pushed: 0, pulled: 0, errors: ['Device not registered'] };
        }
        
        this.isSyncing = true;
        setSyncState('syncing');
        setSyncProgress(0);
        
        const result: SyncResult = {
            success: true,
            pushed: 0,
            pulled: 0,
            errors: []
        };
        
        try {
            // Phase 1: Push local changes (50% of progress)
            setSyncProgress(10);
            const pushResult = await this.pushChanges(storeId, deviceId);
            result.pushed = pushResult.count;
            if (pushResult.errors.length > 0) {
                result.errors.push(...pushResult.errors);
            }
            setSyncProgress(50);
            
            // Phase 2: Pull remote changes (50% of progress)
            const pullResult = await this.pullChanges(storeId);
            result.pulled = pullResult.count;
            if (pullResult.errors.length > 0) {
                result.errors.push(...pullResult.errors);
            }
            setSyncProgress(100);
            
            // Update last sync timestamp
            const now = new Date().toISOString();
            setLastSyncTimestamp(now);
            
            // Update device last_sync_at in Supabase
            await this.updateDeviceLastSync(deviceId);
            
            // Set final state
            setSyncState('idle');
            
            if (result.pushed > 0) recordPush(result.pushed);
            if (result.pulled > 0) recordPull(result.pulled);
            
            console.log(`Sync complete: pushed ${result.pushed}, pulled ${result.pulled}`);
            
        } catch (error) {
            console.error('Sync failed:', error);
            result.success = false;
            result.errors.push(error instanceof Error ? error.message : 'Unknown error');
            setSyncState('error', result.errors.join(', '));
            recordSyncFailure();
        } finally {
            this.isSyncing = false;
        }
        
        return result;
    }
    
    /**
     * Push local changes to Supabase
     */
    private async pushChanges(storeId: string, deviceId: string): Promise<{ count: number; errors: string[] }> {
        const supabase = getSupabase();
        if (!supabase || !db) {
            return { count: 0, errors: ['Database not available'] };
        }
        
        const errors: string[] = [];
        let totalPushed = 0;
        
        try {
            // Get pending changes from local database
            const pendingChanges = await db.pendingChanges?.toArray() || [];
            console.log('[Sync] Push starting, pendingChanges count:', pendingChanges.length);
            if (pendingChanges.length > 0) {
                console.log('[Sync] Pending changes:', pendingChanges.map(c => ({ table: c.tableName, action: c.action, id: c.recordId })));
            }
            
            if (pendingChanges.length === 0) {
                return { count: 0, errors: [] };
            }
            
            // Group changes by table
            const changesByTable = new Map<string, PendingChange[]>();
            for (const change of pendingChanges) {
                const existing = changesByTable.get(change.tableName) || [];
                existing.push(change);
                changesByTable.set(change.tableName, existing);
            }
            
            // Process each table
            for (const [tableName, changes] of changesByTable) {
                const supabaseTable = TABLE_NAME_MAP[tableName];
                if (!supabaseTable) {
                    console.warn(`Unknown table: ${tableName}`);
                    continue;
                }
                
                // Process in batches
                for (let i = 0; i < changes.length; i += MAX_BATCH_SIZE) {
                    const batch = changes.slice(i, i + MAX_BATCH_SIZE);
                    
                    for (const change of batch) {
                        try {
                            await this.pushSingleChange(supabase, supabaseTable, change, storeId, deviceId);
                            
                            // Mark as synced
                            if (change.id && db.pendingChanges) {
                                await db.pendingChanges.delete(change.id);
                            }
                            
                            totalPushed++;
                        } catch (err) {
                            const errorMsg = `Failed to push ${change.action} to ${tableName}: ${err}`;
                            console.error(errorMsg);
                            errors.push(errorMsg);
                        }
                    }
                }
            }
            
            // Update pending changes count
            const remainingChanges = await db.pendingChanges?.count() || 0;
            setPendingChanges(remainingChanges);
            
        } catch (error) {
            errors.push(`Push error: ${error}`);
        }
        
        return { count: totalPushed, errors };
    }
    
    /**
     * Push a single change to Supabase
     */
    private async pushSingleChange(
        supabase: ReturnType<typeof getSupabase>,
        tableName: keyof Database['public']['Tables'],
        change: PendingChange,
        storeId: string,
        deviceId: string
    ): Promise<void> {
        if (!supabase) throw new Error('Supabase not available');
        
        const data = {
            ...this.convertToSnakeCase(change.data),
            store_id: storeId,
            updated_at: new Date().toISOString()
        };
        
        switch (change.action) {
            case 'insert':
            case 'update': {
                // Use upsert for both insert and update
                const { error } = await supabase
                    .from(tableName)
                    .upsert(data as Record<string, unknown>, { 
                        onConflict: 'id',
                        ignoreDuplicates: false 
                    });
                
                if (error) throw error;
                break;
            }
            
            case 'delete': {
                const { error } = await supabase
                    .from(tableName)
                    .delete()
                    .eq('id', change.recordId)
                    .eq('store_id', storeId);
                
                if (error) throw error;
                break;
            }
        }
        
        // Log the sync operation
        await supabase.from('sync_log').insert({
            store_id: storeId,
            device_id: deviceId,
            table_name: tableName,
            record_id: change.recordId,
            action: change.action,
            data: change.data
        });
    }
    
    /**
     * Pull remote changes from Supabase
     */
    private async pullChanges(storeId: string): Promise<{ count: number; errors: string[] }> {
        const supabase = getSupabase();
        if (!supabase || !db) {
            return { count: 0, errors: ['Database not available'] };
        }
        
        const errors: string[] = [];
        let totalPulled = 0;
        
        // Get last sync timestamp
        const lastSync = getLastSyncTimestamp() || '1970-01-01T00:00:00.000Z';
        console.log('[Sync] Pull starting with lastSync:', lastSync, 'storeId:', storeId);
        
        try {
            // Pull changes for each synced table
            for (const dexieTable of SYNCED_TABLES) {
                const supabaseTable = TABLE_NAME_MAP[dexieTable];
                if (!supabaseTable) continue;
                
                try {
                    console.log(`[Sync] Pulling ${supabaseTable} where store_id=${storeId} and updated_at > ${lastSync}`);
                    const { data, error } = await supabase
                        .from(supabaseTable)
                        .select('*')
                        .eq('store_id', storeId)
                        .gt('updated_at', lastSync)
                        .order('updated_at', { ascending: true })
                        .limit(MAX_BATCH_SIZE);
                    
                    if (error) {
                        console.error(`[Sync] Error pulling ${supabaseTable}:`, error);
                        errors.push(`Failed to pull ${supabaseTable}: ${error.message}`);
                        continue;
                    }
                    
                    console.log(`[Sync] ${supabaseTable}: fetched ${data?.length || 0} records`);
                    
                    if (data && data.length > 0) {
                        // Convert and save to local database
                        const localTable = db.table(dexieTable);
                        
                        for (const record of data) {
                            const localRecord = this.convertToCamelCase(record);
                            console.log(`[Sync] Saving to local ${dexieTable}:`, localRecord.id || localRecord.name);
                            await localTable.put(localRecord);
                            totalPulled++;
                        }
                    }
                } catch (err) {
                    console.error(`[Sync] Exception pulling ${supabaseTable}:`, err);
                    errors.push(`Error pulling ${supabaseTable}: ${err}`);
                }
            }
        } catch (error) {
            console.error('[Sync] Pull error:', error);
            errors.push(`Pull error: ${error}`);
        }
        
        console.log('[Sync] Pull complete, totalPulled:', totalPulled);
        return { count: totalPulled, errors };
    }
    
    /**
     * Update device last_sync_at timestamp
     */
    private async updateDeviceLastSync(deviceId: string): Promise<void> {
        const supabase = getSupabase();
        if (!supabase) return;
        
        try {
            await supabase
                .from('devices')
                .update({ last_sync_at: new Date().toISOString() })
                .eq('id', deviceId);
        } catch (err) {
            console.warn('Failed to update device last_sync_at:', err);
        }
    }
    
    /**
     * Convert camelCase object keys to snake_case for Supabase
     */
    private convertToSnakeCase(obj: Record<string, unknown>): Record<string, unknown> {
        const result: Record<string, unknown> = {};
        
        for (const [key, value] of Object.entries(obj)) {
            const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
            result[snakeKey] = value;
        }
        
        return result;
    }
    
    /**
     * Convert snake_case object keys to camelCase for Dexie
     */
    private convertToCamelCase(obj: Record<string, unknown>): Record<string, unknown> {
        const result: Record<string, unknown> = {};
        
        for (const [key, value] of Object.entries(obj)) {
            const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
            result[camelKey] = value;
        }
        
        return result;
    }
    
    /**
     * Force a manual sync
     */
    async forceSync(): Promise<SyncResult> {
        return this.sync();
    }
    
    /**
     * Check if sync is currently in progress
     */
    get isCurrentlySyncing(): boolean {
        return this.isSyncing;
    }
}

// ============================================================
// SINGLETON INSTANCE
// ============================================================

const syncServiceInstance = new SyncService();

/**
 * Public Sync Service API
 * Provides a clean interface for managing sync
 */
export const syncService = {
    /**
     * Start the sync service
     */
    start: () => {
        syncServiceInstance.initialize();
    },
    
    /**
     * Stop the sync service
     */
    stop: () => {
        syncServiceInstance.stopBackgroundSync();
    },
    
    /**
     * Trigger an immediate sync
     */
    syncNow: async () => {
        return syncServiceInstance.forceSync();
    },
    
    /**
     * Check if currently syncing
     */
    get isSyncing(): boolean {
        return syncServiceInstance.isCurrentlySyncing;
    }
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Track a local change for syncing
 * Call this when saving data to local database
 */
export async function trackChange(
    tableName: string,
    recordId: string,
    action: 'insert' | 'update' | 'delete',
    data: Record<string, unknown>
): Promise<void> {
    if (!browser || !db?.pendingChanges) return;
    
    // Check if this is a synced table
    if (!SYNCED_TABLES.includes(tableName)) return;
    
    const change: PendingChange = {
        tableName,
        recordId,
        action,
        data,
        timestamp: Date.now(),
        synced: false
    };
    
    await db.pendingChanges.add(change);
    
    // Update pending changes count
    const count = await db.pendingChanges.count();
    setPendingChanges(count);
}

/**
 * Initialize sync service (call on app startup)
 */
export async function initializeSyncService(): Promise<void> {
    syncService.start();
}

/**
 * Stop sync service (call on app shutdown)
 */
export function stopSyncService(): void {
    syncService.stopBackgroundSync();
}

/**
 * Trigger manual sync
 */
export async function triggerSync(): Promise<SyncResult> {
    return syncService.syncNow();
}

