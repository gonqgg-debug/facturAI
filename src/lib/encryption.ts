/**
 * Encryption utilities for sensitive localStorage data
 * Uses Web Crypto API (AES-GCM) for encryption
 * Keys are stored in memory only (session-based)
 */

import { browser } from '$app/environment';

// Generate a key for encryption (stored in memory only)
let encryptionKey: CryptoKey | null = null;

// Initialize encryption key (call once on app load)
export async function initEncryptionKey(): Promise<CryptoKey | null> {
    if (!browser) return null;
    
    if (encryptionKey) {
        return encryptionKey;
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
        console.error('Failed to initialize encryption key:', error);
        return null;
    }
}

// Encrypt a string value
export async function encrypt(value: string): Promise<string | null> {
    if (!browser || !value) return value;
    
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
        console.error('Encryption failed:', error);
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
        console.error('Decryption failed:', error);
        // If decryption fails, return null (data may be corrupted or key changed)
        return null;
    }
}

// Clear encryption key (call on logout)
export function clearEncryptionKey(): void {
    encryptionKey = null;
}

// Encrypted localStorage wrapper
export const encryptedStorage = {
    async setItem(key: string, value: string): Promise<void> {
        if (!browser) return;
        
        try {
            const encrypted = await encrypt(value);
            if (encrypted) {
                localStorage.setItem(key, encrypted);
            } else {
                // If encryption fails, fall back to plaintext storage
                console.warn('Encryption failed, storing as plaintext for key:', key);
                localStorage.setItem(key, value);
            }
        } catch (error) {
            // If encryption completely fails, store as plaintext to avoid data loss
            console.warn('Encryption error, storing as plaintext:', error);
            localStorage.setItem(key, value);
        }
    },
    
    async getItem(key: string): Promise<string | null> {
        if (!browser) return null;
        
        try {
            const encrypted = localStorage.getItem(key);
            if (!encrypted) return null;
            
            // Try to decrypt
            const decrypted = await decrypt(encrypted);
            
            // If decryption returns null, it might be plaintext or decryption failed
            // Return the original value if decryption failed (might be plaintext)
            return decrypted !== null ? decrypted : encrypted;
        } catch (error) {
            // If anything fails, try to return plaintext value
            console.warn('Error getting encrypted item, trying plaintext:', error);
            return localStorage.getItem(key);
        }
    },
    
    removeItem(key: string): void {
        if (!browser) return;
        localStorage.removeItem(key);
    }
};

