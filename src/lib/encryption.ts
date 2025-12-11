/**
 * Encryption utilities for sensitive localStorage data
 * Uses Web Crypto API (AES-GCM) for encryption
 * Keys are stored in memory only (session-based)
 * 
 * SAFARI COMPATIBILITY:
 * - crypto.subtle may be unavailable on non-HTTPS localhost in Safari
 * - Graceful fallback to plaintext storage when crypto is unavailable
 */

import { browser } from '$app/environment';

// Generate a key for encryption (stored in memory only)
let encryptionKey: CryptoKey | null = null;
let cryptoUnavailable = false; // Track if crypto.subtle is not available

// Check if crypto.subtle is available (Safari may block it on non-HTTPS)
function isCryptoAvailable(): boolean {
    if (!browser) return false;
    if (cryptoUnavailable) return false;
    
    try {
        // Check if crypto.subtle exists and is accessible
        if (typeof crypto === 'undefined' || !crypto.subtle) {
            console.warn('crypto.subtle is not available (Safari non-HTTPS or older browser)');
            cryptoUnavailable = true;
            return false;
        }
        return true;
    } catch (error) {
        console.warn('crypto.subtle access error:', error);
        cryptoUnavailable = true;
        return false;
    }
}

// Initialize encryption key (call once on app load)
export async function initEncryptionKey(): Promise<CryptoKey | null> {
    if (!browser) return null;
    
    if (encryptionKey) {
        return encryptionKey;
    }
    
    // Check if crypto.subtle is available
    if (!isCryptoAvailable()) {
        return null;
    }
    
    try {
        // Generate a random key for this session
        // This key is ephemeral and stored only in memory
        encryptionKey = await crypto.subtle.generateKey(
            {
                name: 'AES-GCM',
                length: 256
            },
            false, // key is not extractable (more secure)
            ['encrypt', 'decrypt']
        );
        
        return encryptionKey;
    } catch (error) {
        console.warn('Failed to initialize encryption key (Safari/non-HTTPS?):', error);
        cryptoUnavailable = true;
        return null;
    }
}

// Encrypt a string value
export async function encrypt(value: string): Promise<string | null> {
    if (!browser || !value) return value;
    
    // Quick check if crypto is available
    if (!isCryptoAvailable()) {
        console.warn('Encryption not available (Safari/non-HTTPS), storing plaintext');
        return value;
    }
    
    try {
        const key = await initEncryptionKey();
        if (!key) {
            // If encryption fails, return value as-is (graceful degradation)
            console.warn('Encryption not available, storing plaintext');
            return value;
        }
        
        // Convert string to ArrayBuffer
        const encoder = new TextEncoder();
        const data = encoder.encode(value);
        
        // Generate random IV (Initialization Vector)
        const iv = crypto.getRandomValues(new Uint8Array(12));
        
        // Encrypt
        const encryptedData = await crypto.subtle.encrypt(
            {
                name: 'AES-GCM',
                iv: iv
            },
            key,
            data
        );
        
        // Combine IV and encrypted data, then base64 encode
        const combined = new Uint8Array(iv.length + encryptedData.byteLength);
        combined.set(iv, 0);
        combined.set(new Uint8Array(encryptedData), iv.length);
        
        // Convert to base64 for storage
        const base64 = btoa(String.fromCharCode(...combined));
        
        // Prefix to identify encrypted data
        return `encrypted:${base64}`;
    } catch (error) {
        console.warn('Encryption failed:', error);
        // Graceful degradation: return value as-is
        return value;
    }
}

// Decrypt a string value
export async function decrypt(encryptedValue: string): Promise<string | null> {
    if (!browser || !encryptedValue) return encryptedValue;
    
    // Check if value is encrypted (has prefix)
    if (!encryptedValue.startsWith('encrypted:')) {
        // Not encrypted, return as-is (backward compatibility)
        return encryptedValue;
    }
    
    // Quick check if crypto is available
    if (!isCryptoAvailable()) {
        console.warn('Decryption not available (Safari/non-HTTPS)');
        return null;
    }
    
    try {
        const key = await initEncryptionKey();
        if (!key) {
            // If key initialization fails, return null so caller can try plaintext fallback
            console.warn('Decryption not available - key initialization failed');
            return null;
        }
        
        // Remove prefix and decode base64
        const base64 = encryptedValue.replace('encrypted:', '');
        const combined = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
        
        // Extract IV (first 12 bytes) and encrypted data
        const iv = combined.slice(0, 12);
        const encryptedData = combined.slice(12);
        
        // Decrypt
        const decryptedData = await crypto.subtle.decrypt(
            {
                name: 'AES-GCM',
                iv: iv
            },
            key,
            encryptedData
        );
        
        // Convert ArrayBuffer back to string
        const decoder = new TextDecoder();
        return decoder.decode(decryptedData);
    } catch (error) {
        console.warn('Decryption failed:', error);
        // If decryption fails, return null (data may be corrupted or key changed)
        return null;
    }
}

// Clear encryption key (call on logout)
export function clearEncryptionKey(): void {
    encryptionKey = null;
    cryptoUnavailable = false;
}

// Safe localStorage access helpers (Safari private browsing compatibility)
function safeLocalStorageGet(key: string): string | null {
    if (!browser) return null;
    try {
        return localStorage.getItem(key);
    } catch (error) {
        console.warn('localStorage.getItem failed:', error);
        return null;
    }
}

function safeLocalStorageSet(key: string, value: string): boolean {
    if (!browser) return false;
    try {
        localStorage.setItem(key, value);
        return true;
    } catch (error) {
        console.warn('localStorage.setItem failed:', error);
        return false;
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

// Encrypted localStorage wrapper
export const encryptedStorage = {
    async setItem(key: string, value: string): Promise<void> {
        if (!browser) return;
        
        try {
            const encrypted = await encrypt(value);
            if (encrypted) {
                if (!safeLocalStorageSet(key, encrypted)) {
                    console.warn('Could not save to localStorage for key:', key);
                }
            } else {
                // If encryption fails, fall back to plaintext storage
                console.warn('Encryption failed, storing as plaintext for key:', key);
                safeLocalStorageSet(key, value);
            }
        } catch (error) {
            // If encryption completely fails, store as plaintext to avoid data loss
            console.warn('Encryption error, storing as plaintext:', error);
            safeLocalStorageSet(key, value);
        }
    },
    
    async getItem(key: string): Promise<string | null> {
        if (!browser) return null;
        
        try {
            const encrypted = safeLocalStorageGet(key);
            if (!encrypted) return null;
            
            // Try to decrypt
            const decrypted = await decrypt(encrypted);
            
            // If decryption returns null, it might be plaintext or decryption failed
            // Return the original value if decryption failed (might be plaintext)
            return decrypted !== null ? decrypted : encrypted;
        } catch (error) {
            // If anything fails, try to return plaintext value
            console.warn('Error getting encrypted item, trying plaintext:', error);
            return safeLocalStorageGet(key);
        }
    },
    
    async removeItem(key: string): Promise<void> {
        if (!browser) return;
        safeLocalStorageRemove(key);
    }
};

