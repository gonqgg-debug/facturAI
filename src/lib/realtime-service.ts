/**
 * Realtime Service Module
 * 
 * Provides near-instant sync via Supabase Realtime websocket subscriptions.
 * Works alongside the existing polling sync as a performance enhancement.
 * 
 * Features:
 * - Subscribes to INSERT/UPDATE/DELETE events on high-priority tables
 * - Filters by store_id for multi-tenant isolation
 * - Applies changes directly to local Dexie database
 * - Handles reconnection automatically
 */

import { browser } from '$app/environment';
import { get } from 'svelte/store';
import { getSupabase, TABLE_NAME_MAP } from './supabase';
import { getStoreId, isDeviceRegistered } from './device-auth';
import { db } from './db';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// ============================================================
// CONFIGURATION
// ============================================================

/**
 * Tables to subscribe to via Realtime (high-priority for instant sync)
 * These are the most frequently updated tables where latency matters
 */
const REALTIME_TABLES = [
    'products',
    'sales',
    'stock_movements',
    'customers',
    'invoices',
    'payments'
];

// ============================================================
// REALTIME SERVICE CLASS
// ============================================================

class RealtimeService {
    private channel: RealtimeChannel | null = null;
    private isConnected = false;
    private storeId: string | null = null;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectDelay = 1000; // Start with 1 second

    /**
     * Start realtime subscriptions
     * Should be called after device registration and initial sync
     */
    async start(): Promise<void> {
        if (!browser) return;
        
        const supabase = getSupabase();
        const storeId = getStoreId();
        
        if (!supabase || !storeId) {
            console.log('[Realtime] Cannot start - Supabase or storeId not available');
            return;
        }
        
        if (!get(isDeviceRegistered)) {
            console.log('[Realtime] Cannot start - device not registered');
            return;
        }
        
        // If already connected with same store, skip
        if (this.channel && this.isConnected && this.storeId === storeId) {
            console.log('[Realtime] Already connected to store:', storeId);
            return;
        }
        
        // Clean up existing channel if any
        if (this.channel) {
            await this.stop();
        }
        
        this.storeId = storeId;
        console.log('[Realtime] Starting subscriptions for store:', storeId);
        
        // Create a channel for this store
        this.channel = supabase.channel(`store-sync:${storeId}`, {
            config: {
                broadcast: { self: false }, // Don't receive our own broadcasts
            }
        });
        
        // Subscribe to each high-priority table
        for (const table of REALTIME_TABLES) {
            this.channel.on(
                'postgres_changes',
                {
                    event: '*', // INSERT, UPDATE, DELETE
                    schema: 'public',
                    table: table,
                    filter: `store_id=eq.${storeId}`
                },
                (payload) => this.handleChange(table, payload)
            );
        }
        
        // Subscribe and handle connection status
        this.channel.subscribe((status, err) => {
            console.log('[Realtime] Channel status:', status, err ? `Error: ${err.message}` : '');
            
            if (status === 'SUBSCRIBED') {
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.reconnectDelay = 1000;
                console.log('[Realtime] Connected and subscribed to', REALTIME_TABLES.length, 'tables');
            } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
                this.isConnected = false;
                this.handleDisconnect();
            }
        });
        
        // Set up online/offline handlers
        this.setupReconnection();
    }
    
    /**
     * Handle incoming realtime change events
     */
    private async handleChange(
        tableName: string,
        payload: RealtimePostgresChangesPayload<Record<string, unknown>>
    ): Promise<void> {
        // Find the corresponding Dexie table name
        const dexieTable = Object.entries(TABLE_NAME_MAP)
            .find(([_, supaTable]) => supaTable === tableName)?.[0];
        
        if (!dexieTable || !db) {
            console.warn('[Realtime] Unknown table or db not available:', tableName);
            return;
        }
        
        try {
            const localTable = db.table(dexieTable);
            
            // Get the record data (new for INSERT/UPDATE, old for DELETE)
            const rawRecord = payload.eventType === 'DELETE' 
                ? payload.old as Record<string, unknown>
                : payload.new as Record<string, unknown>;
            
            if (!rawRecord || Object.keys(rawRecord).length === 0) {
                console.warn('[Realtime] Empty record in payload:', payload.eventType, tableName);
                return;
            }
            
            // Convert snake_case to camelCase for Dexie
            const record = this.convertToCamelCase(rawRecord);
            
            switch (payload.eventType) {
                case 'INSERT':
                case 'UPDATE':
                    console.log(`[Realtime] ${payload.eventType} on ${tableName}:`, record.id);
                    await localTable.put(record);
                    break;
                    
                case 'DELETE':
                    if (record.id) {
                        console.log(`[Realtime] DELETE on ${tableName}:`, record.id);
                        await localTable.delete(record.id);
                    }
                    break;
            }
        } catch (error) {
            console.error(`[Realtime] Error handling ${payload.eventType} on ${tableName}:`, error);
        }
    }
    
    /**
     * Stop realtime subscriptions
     */
    async stop(): Promise<void> {
        if (this.channel) {
            console.log('[Realtime] Stopping subscriptions');
            await this.channel.unsubscribe();
            this.channel = null;
        }
        
        this.isConnected = false;
        this.storeId = null;
        
        // Remove event listeners
        if (browser) {
            window.removeEventListener('online', this.handleOnline);
            window.removeEventListener('offline', this.handleOffline);
        }
    }
    
    /**
     * Set up reconnection handlers for online/offline events
     */
    private setupReconnection(): void {
        if (!browser) return;
        
        // Remove existing listeners to prevent duplicates
        window.removeEventListener('online', this.handleOnline);
        window.removeEventListener('offline', this.handleOffline);
        
        // Add new listeners
        window.addEventListener('online', this.handleOnline);
        window.addEventListener('offline', this.handleOffline);
    }
    
    /**
     * Handle coming back online
     */
    private handleOnline = (): void => {
        console.log('[Realtime] Back online - reconnecting');
        if (!this.isConnected) {
            this.start();
        }
    };
    
    /**
     * Handle going offline
     */
    private handleOffline = (): void => {
        console.log('[Realtime] Went offline');
        this.isConnected = false;
    };
    
    /**
     * Handle disconnection with exponential backoff retry
     */
    private handleDisconnect(): void {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.warn('[Realtime] Max reconnect attempts reached, giving up');
            return;
        }
        
        this.reconnectAttempts++;
        const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);
        
        console.log(`[Realtime] Will attempt reconnect #${this.reconnectAttempts} in ${delay}ms`);
        
        setTimeout(() => {
            if (!this.isConnected && browser && navigator.onLine) {
                console.log('[Realtime] Attempting reconnect...');
                this.start();
            }
        }, delay);
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
     * Check if currently connected
     */
    get connected(): boolean {
        return this.isConnected;
    }
    
    /**
     * Get list of tables being monitored
     */
    get monitoredTables(): string[] {
        return [...REALTIME_TABLES];
    }
}

// ============================================================
// SINGLETON INSTANCE
// ============================================================

const realtimeServiceInstance = new RealtimeService();

/**
 * Public Realtime Service API
 */
export const realtimeService = {
    /**
     * Start realtime subscriptions
     */
    start: () => realtimeServiceInstance.start(),
    
    /**
     * Stop realtime subscriptions
     */
    stop: () => realtimeServiceInstance.stop(),
    
    /**
     * Check if connected
     */
    get isConnected(): boolean {
        return realtimeServiceInstance.connected;
    },
    
    /**
     * Get monitored tables
     */
    get tables(): string[] {
        return realtimeServiceInstance.monitoredTables;
    }
};

/**
 * Initialize realtime service (convenience function)
 */
export function initializeRealtimeService(): void {
    realtimeService.start();
}

/**
 * Stop realtime service (convenience function)
 */
export function stopRealtimeService(): void {
    realtimeService.stop();
}

