/**
 * Device Authentication Module
 * 
 * Handles device registration and store management for multi-device sync.
 * 
 * Authentication Flow:
 * 1. User signs in with Firebase Auth (email/Google)
 * 2. System checks if a store exists for this Firebase user
 * 3. If not, creates a new store linked to their Firebase UID
 * 4. Device is automatically registered to the store
 * 5. All devices signed in with same Firebase account share data
 * 
 * Legacy pairing code flow is still available for manual device linking.
 */

import { browser } from '$app/environment';
import { getSupabase, isSupabaseConfigured } from './supabase';
import { getCurrentUser, firebaseUserId } from './firebase';
import { writable, derived, get, type Readable } from 'svelte/store';

// ============================================================
// CONSTANTS
// ============================================================

const DEVICE_TOKEN_KEY = 'minimarket_device_token';
const STORE_ID_KEY = 'minimarket_store_id';
const DEVICE_ID_KEY = 'minimarket_device_id';
const PAIRING_CODE_VALIDITY_MINUTES = 5;

// ============================================================
// TYPES
// ============================================================

export interface DeviceInfo {
    deviceId: string;
    storeId: string;
    deviceToken: string;
    deviceName: string | null;
    isRegistered: boolean;
}

export interface PairingCode {
    code: string;
    expiresAt: Date;
    storeId: string;
}

export type DeviceAuthState = 
    | 'not_configured'  // Supabase not configured
    | 'not_registered'  // Device not registered
    | 'registered'      // Device registered and ready
    | 'registering'     // Registration in progress
    | 'error';          // Error state

export interface DeviceAuthStatus {
    state: DeviceAuthState;
    deviceInfo: DeviceInfo | null;
    error: string | null;
}

// ============================================================
// STORES
// ============================================================

const deviceAuthStore = writable<DeviceAuthStatus>({
    state: 'not_configured',
    deviceInfo: null,
    error: null
});

export const deviceAuth: Readable<DeviceAuthStatus> = {
    subscribe: deviceAuthStore.subscribe
};

export const isDeviceRegistered = derived(
    deviceAuth,
    $auth => $auth.state === 'registered'
);

export const deviceStoreId = derived(
    deviceAuth,
    $auth => $auth.deviceInfo?.storeId || null
);

// ============================================================
// LOCAL STORAGE HELPERS
// ============================================================

/**
 * Get stored device token from localStorage
 */
export function getDeviceToken(): string | null {
    if (!browser) return null;
    return localStorage.getItem(DEVICE_TOKEN_KEY);
}

/**
 * Get stored store ID from localStorage
 */
export function getStoreId(): string | null {
    if (!browser) return null;
    return localStorage.getItem(STORE_ID_KEY);
}

/**
 * Get stored device ID from localStorage
 */
export function getDeviceId(): string | null {
    if (!browser) return null;
    return localStorage.getItem(DEVICE_ID_KEY);
}

/**
 * Store device credentials in localStorage
 */
function storeDeviceCredentials(deviceId: string, storeId: string, token: string): void {
    if (!browser) return;
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
    localStorage.setItem(STORE_ID_KEY, storeId);
    localStorage.setItem(DEVICE_TOKEN_KEY, token);
}

/**
 * Clear device credentials from localStorage
 */
function clearDeviceCredentials(): void {
    if (!browser) return;
    localStorage.removeItem(DEVICE_ID_KEY);
    localStorage.removeItem(STORE_ID_KEY);
    localStorage.removeItem(DEVICE_TOKEN_KEY);
}

// ============================================================
// INITIALIZATION
// ============================================================

/**
 * Initialize device auth state from localStorage
 * Call this on app startup
 */
export async function initializeDeviceAuth(): Promise<void> {
    if (!browser) return;
    
    // Check if Supabase is configured
    if (!isSupabaseConfigured()) {
        deviceAuthStore.set({
            state: 'not_configured',
            deviceInfo: null,
            error: null
        });
        return;
    }
    
    // Check for existing device registration
    const deviceToken = getDeviceToken();
    const storeId = getStoreId();
    const deviceId = getDeviceId();
    
    if (deviceToken && storeId && deviceId) {
        // Verify the device is still valid
        const isValid = await verifyDeviceRegistration(deviceId, deviceToken);
        
        if (isValid) {
            deviceAuthStore.set({
                state: 'registered',
                deviceInfo: {
                    deviceId,
                    storeId,
                    deviceToken,
                    deviceName: null,
                    isRegistered: true
                },
                error: null
            });
        } else {
            // Invalid registration, clear and set to not registered
            clearDeviceCredentials();
            deviceAuthStore.set({
                state: 'not_registered',
                deviceInfo: null,
                error: null
            });
        }
    } else {
        deviceAuthStore.set({
            state: 'not_registered',
            deviceInfo: null,
            error: null
        });
    }
}

/**
 * Verify device registration is still valid
 */
async function verifyDeviceRegistration(deviceId: string, token: string): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase) return false;
    
    try {
        const { data, error } = await supabase
            .from('devices')
            .select('id, is_active')
            .eq('id', deviceId)
            .eq('device_token', token)
            .single();
        
        if (error || !data) return false;
        return data.is_active;
    } catch {
        return false;
    }
}

// ============================================================
// FIREBASE AUTH-BASED STORE MANAGEMENT
// ============================================================

/**
 * Ensure a store exists for the current Firebase user
 * This is the primary way to set up sync - Firebase user = Store owner
 * 
 * Flow:
 * 1. Get current Firebase user
 * 2. Check if a store exists with this Firebase UID
 * 3. If not, create one
 * 4. Register this device to the store
 */
export async function ensureStoreExists(): Promise<string | null> {
    const supabase = getSupabase();
    if (!supabase) {
        console.error('Supabase not configured');
        return null;
    }
    
    const firebaseUser = getCurrentUser();
    if (!firebaseUser) {
        console.error('No Firebase user - must be signed in');
        return null;
    }
    
    const firebaseUid = firebaseUser.uid;
    const email = firebaseUser.email;
    
    deviceAuthStore.update(s => ({ ...s, state: 'registering', error: null }));
    
    try {
        // Check if store exists for this Firebase user
        const { data: existingStore, error: fetchError } = await supabase
            .from('stores')
            .select('id, name')
            .eq('firebase_uid', firebaseUid)
            .single();
        
        let storeId: string;
        
        if (existingStore && !fetchError) {
            // Store exists, use it
            console.log('Found existing store for Firebase user:', existingStore.name);
            storeId = existingStore.id;
        } else {
            // Create new store for this Firebase user
            console.log('Creating new store for Firebase user:', email);
            
            const storeName = email?.split('@')[0] || 'Mi Tienda';
            
            const { data: newStore, error: createError } = await supabase
                .from('stores')
                .insert({
                    name: storeName,
                    owner_email: email,
                    firebase_uid: firebaseUid
                })
                .select('id')
                .single();
            
            if (createError || !newStore) {
                console.error('Failed to create store:', createError);
                deviceAuthStore.update(s => ({ 
                    ...s, 
                    state: 'error', 
                    error: 'Failed to create store' 
                }));
                return null;
            }
            
            storeId = newStore.id;
        }
        
        // Register this device to the store
        const deviceToken = crypto.randomUUID();
        const deviceName = getDeviceName();
        
        const { data: deviceData, error: deviceError } = await supabase
            .from('devices')
            .insert({
                store_id: storeId,
                device_token: deviceToken,
                device_name: deviceName,
                device_type: getDeviceType(),
                user_agent: browser ? navigator.userAgent.slice(0, 255) : null,
                is_active: true,
                firebase_uid: firebaseUid
            })
            .select('id')
            .single();
        
        if (deviceError || !deviceData) {
            console.error('Failed to register device:', deviceError);
            deviceAuthStore.update(s => ({ 
                ...s, 
                state: 'error', 
                error: 'Failed to register device' 
            }));
            return null;
        }
        
        // Store credentials locally
        storeDeviceCredentials(deviceData.id, storeId, deviceToken);
        
        // Update store state
        deviceAuthStore.set({
            state: 'registered',
            deviceInfo: {
                deviceId: deviceData.id,
                storeId,
                deviceToken,
                deviceName,
                isRegistered: true
            },
            error: null
        });
        
        console.log('Device registered successfully to store:', storeId);
        return storeId;
        
    } catch (err) {
        console.error('Error ensuring store exists:', err);
        deviceAuthStore.update(s => ({ 
            ...s, 
            state: 'error', 
            error: 'Registration failed' 
        }));
        return null;
    }
}

// ============================================================
// LEGACY: PAIRING CODE STORE MANAGEMENT
// ============================================================

/**
 * Create a new store (business/tenant)
 * Legacy method - use ensureStoreExists() with Firebase Auth instead
 */
export async function createStore(storeName: string, ownerEmail?: string): Promise<string | null> {
    const supabase = getSupabase();
    if (!supabase) {
        console.error('Supabase not configured');
        return null;
    }
    
    try {
        const { data, error } = await supabase
            .from('stores')
            .insert({
                name: storeName,
                owner_email: ownerEmail || null
            })
            .select('id')
            .single();
        
        if (error) {
            console.error('Failed to create store:', error);
            return null;
        }
        
        return data.id;
    } catch (err) {
        console.error('Error creating store:', err);
        return null;
    }
}

// ============================================================
// PAIRING CODE GENERATION (Admin)
// ============================================================

/**
 * Generate a new pairing code for device registration
 * Only callable from an already-registered device (admin)
 */
export async function generatePairingCode(): Promise<PairingCode | null> {
    const supabase = getSupabase();
    if (!supabase) {
        console.error('Supabase not configured');
        return null;
    }
    
    const storeId = getStoreId();
    if (!storeId) {
        console.error('No store ID - device not registered');
        return null;
    }
    
    // Generate a 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + PAIRING_CODE_VALIDITY_MINUTES * 60 * 1000);
    
    try {
        const { error } = await supabase
            .from('pairing_codes')
            .insert({
                store_id: storeId,
                code,
                expires_at: expiresAt.toISOString()
            });
        
        if (error) {
            console.error('Failed to create pairing code:', error);
            return null;
        }
        
        return {
            code,
            expiresAt,
            storeId
        };
    } catch (err) {
        console.error('Error generating pairing code:', err);
        return null;
    }
}

// ============================================================
// DEVICE REGISTRATION (New Device)
// ============================================================

/**
 * Register a new device using a pairing code
 */
export async function registerDevice(pairingCode: string): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase) {
        deviceAuthStore.update(s => ({ ...s, state: 'error', error: 'Supabase not configured' }));
        return false;
    }
    
    deviceAuthStore.update(s => ({ ...s, state: 'registering', error: null }));
    
    try {
        // 1. Validate the pairing code
        const { data: pairingData, error: pairingError } = await supabase
            .from('pairing_codes')
            .select('*')
            .eq('code', pairingCode)
            .is('used_at', null)
            .gt('expires_at', new Date().toISOString())
            .single();
        
        if (pairingError || !pairingData) {
            deviceAuthStore.update(s => ({ 
                ...s, 
                state: 'error', 
                error: 'Invalid or expired pairing code' 
            }));
            return false;
        }
        
        // 2. Generate device token
        const deviceToken = crypto.randomUUID();
        const deviceName = getDeviceName();
        
        // 3. Create device record
        const { data: deviceData, error: deviceError } = await supabase
            .from('devices')
            .insert({
                store_id: pairingData.store_id,
                device_token: deviceToken,
                device_name: deviceName,
                device_type: getDeviceType(),
                user_agent: browser ? navigator.userAgent.slice(0, 255) : null,
                is_active: true
            })
            .select('id')
            .single();
        
        if (deviceError || !deviceData) {
            deviceAuthStore.update(s => ({ 
                ...s, 
                state: 'error', 
                error: 'Failed to register device' 
            }));
            return false;
        }
        
        // 4. Mark pairing code as used
        await supabase
            .from('pairing_codes')
            .update({
                used_at: new Date().toISOString(),
                used_by_device_id: deviceData.id
            })
            .eq('id', pairingData.id);
        
        // 5. Store credentials locally
        storeDeviceCredentials(deviceData.id, pairingData.store_id, deviceToken);
        
        // 6. Update store state
        deviceAuthStore.set({
            state: 'registered',
            deviceInfo: {
                deviceId: deviceData.id,
                storeId: pairingData.store_id,
                deviceToken,
                deviceName,
                isRegistered: true
            },
            error: null
        });
        
        return true;
    } catch (err) {
        console.error('Error registering device:', err);
        deviceAuthStore.update(s => ({ 
            ...s, 
            state: 'error', 
            error: 'Registration failed' 
        }));
        return false;
    }
}

/**
 * Register the first device and create a store
 * This is for initial setup when no store exists
 */
export async function registerFirstDevice(storeName: string, ownerEmail?: string): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase) {
        deviceAuthStore.update(s => ({ ...s, state: 'error', error: 'Supabase not configured' }));
        return false;
    }
    
    deviceAuthStore.update(s => ({ ...s, state: 'registering', error: null }));
    
    try {
        // 1. Create the store
        const storeId = await createStore(storeName, ownerEmail);
        if (!storeId) {
            deviceAuthStore.update(s => ({ 
                ...s, 
                state: 'error', 
                error: 'Failed to create store' 
            }));
            return false;
        }
        
        // 2. Generate device token
        const deviceToken = crypto.randomUUID();
        const deviceName = getDeviceName();
        
        // 3. Create device record
        const { data: deviceData, error: deviceError } = await supabase
            .from('devices')
            .insert({
                store_id: storeId,
                device_token: deviceToken,
                device_name: deviceName,
                device_type: getDeviceType(),
                user_agent: browser ? navigator.userAgent.slice(0, 255) : null,
                is_active: true
            })
            .select('id')
            .single();
        
        if (deviceError || !deviceData) {
            deviceAuthStore.update(s => ({ 
                ...s, 
                state: 'error', 
                error: 'Failed to register device' 
            }));
            return false;
        }
        
        // 4. Store credentials locally
        storeDeviceCredentials(deviceData.id, storeId, deviceToken);
        
        // 5. Update store state
        deviceAuthStore.set({
            state: 'registered',
            deviceInfo: {
                deviceId: deviceData.id,
                storeId,
                deviceToken,
                deviceName,
                isRegistered: true
            },
            error: null
        });
        
        return true;
    } catch (err) {
        console.error('Error registering first device:', err);
        deviceAuthStore.update(s => ({ 
            ...s, 
            state: 'error', 
            error: 'Registration failed' 
        }));
        return false;
    }
}

// ============================================================
// DEVICE DISCONNECTION
// ============================================================

/**
 * Disconnect this device (unregister)
 */
export async function disconnectDevice(): Promise<void> {
    const supabase = getSupabase();
    const deviceId = getDeviceId();
    
    // Deactivate device in Supabase if possible
    if (supabase && deviceId) {
        try {
            await supabase
                .from('devices')
                .update({ is_active: false })
                .eq('id', deviceId);
        } catch (err) {
            console.warn('Failed to deactivate device in cloud:', err);
        }
    }
    
    // Clear local credentials
    clearDeviceCredentials();
    
    // Update store state
    deviceAuthStore.set({
        state: 'not_registered',
        deviceInfo: null,
        error: null
    });
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Get a friendly device name based on user agent
 */
function getDeviceName(): string {
    if (!browser) return 'Unknown Device';
    
    const ua = navigator.userAgent;
    
    if (ua.includes('iPhone')) return 'iPhone';
    if (ua.includes('iPad')) return 'iPad';
    if (ua.includes('Android')) {
        if (ua.includes('Mobile')) return 'Android Phone';
        return 'Android Tablet';
    }
    if (ua.includes('Mac')) return 'Mac';
    if (ua.includes('Windows')) return 'Windows PC';
    if (ua.includes('Linux')) return 'Linux PC';
    
    return 'Web Browser';
}

/**
 * Get device type for categorization
 */
function getDeviceType(): string {
    if (!browser) return 'unknown';
    
    const ua = navigator.userAgent;
    
    if (ua.includes('Mobile') || ua.includes('iPhone') || ua.includes('Android')) {
        return 'mobile';
    }
    if (ua.includes('iPad') || ua.includes('Tablet')) {
        return 'tablet';
    }
    return 'desktop';
}

/**
 * Check if this is the first device (no store exists)
 * Used to determine if we should show "Create Store" vs "Enter Pairing Code"
 */
export function isFirstDevice(): boolean {
    const storeId = getStoreId();
    return !storeId;
}

/**
 * Format remaining time for pairing code expiry
 */
export function formatPairingCodeExpiry(expiresAt: Date): string {
    const now = new Date();
    const diff = expiresAt.getTime() - now.getTime();
    
    if (diff <= 0) return 'Expired';
    
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
}

