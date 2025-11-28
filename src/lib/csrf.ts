/**
 * CSRF Protection Utilities
 * Implements double-submit cookie pattern for CSRF protection
 */

import { browser } from '$app/environment';

const CSRF_COOKIE_NAME = 'csrf-token';
const CSRF_HEADER_NAME = 'x-csrf-token';

/**
 * Generate a random CSRF token
 * Works in both browser and Node.js environments
 */
function generateToken(): string {
    // Generate a secure random token (32 bytes = 64 hex characters)
    if (browser) {
        // Browser environment - use Web Crypto API
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    } else {
        // Node.js environment - use Node.js crypto module
        // This function is only called server-side, so safe to use require
        try {
            const nodeCrypto = require('crypto');
            return nodeCrypto.randomBytes(32).toString('hex');
        } catch (e) {
            // Fallback: if require fails, try global crypto (Node.js 15+)
            if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.getRandomValues) {
                const array = new Uint8Array(32);
                globalThis.crypto.getRandomValues(array);
                return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
            }
            throw new Error('Unable to generate CSRF token: no crypto implementation available');
        }
    }
}

/**
 * Get or create CSRF token (client-side)
 * Reads token from cookie set by server
 * For double-submit pattern, the server sets the cookie and client reads it
 */
export function getCsrfToken(): string {
    if (!browser) return '';
    
    // Try to get existing token from cookie (set by server)
    // Cookie format: "name1=value1; name2=value2"
    const cookieString = document.cookie;
    if (!cookieString) return '';
    
    const cookies = cookieString.split(';');
    for (const cookie of cookies) {
        const trimmed = cookie.trim();
        if (trimmed.startsWith(`${CSRF_COOKIE_NAME}=`)) {
            // Extract value after the first '='
            const eqIndex = trimmed.indexOf('=');
            if (eqIndex !== -1) {
                const value = trimmed.substring(eqIndex + 1).trim();
                if (value) {
                    try {
                        return decodeURIComponent(value);
                    } catch (e) {
                        return value;
                    }
                }
            }
        }
    }
    
    return '';
}

/**
 * Get CSRF token header value for requests
 */
export function getCsrfHeader(): Record<string, string> {
    if (!browser) return {};
    
    const token = getCsrfToken();
    return token ? { [CSRF_HEADER_NAME]: token } : {};
}

/**
 * Ensure CSRF token is available, waiting if necessary
 * This helps when the cookie hasn't been set yet on first load
 * Returns the token if available, or empty string if not
 */
export async function ensureCsrfToken(): Promise<string> {
    if (!browser) return '';
    
    let token = getCsrfToken();
    
    // If token exists, return it immediately
    if (token) return token;
    
    // If no token, try a few times with small delays
    // The cookie should be set after the first page load
    for (let i = 0; i < 3; i++) {
        await new Promise(resolve => setTimeout(resolve, 50));
        token = getCsrfToken();
        if (token) return token;
    }
    
    // If still no token after waiting, make a lightweight HEAD request
    // to trigger cookie setting (HEAD is lighter than GET)
    try {
        await fetch('/', { 
            method: 'HEAD', 
            credentials: 'include',
            cache: 'no-store'
        });
        await new Promise(resolve => setTimeout(resolve, 50));
        token = getCsrfToken();
    } catch (e) {
        console.warn('Failed to ensure CSRF token:', e);
    }
    
    return token || '';
}

/**
 * Validate CSRF token (server-side)
 * Checks that cookie token matches header token
 */
export function validateCsrfToken(cookieToken: string | null, headerToken: string | null): boolean {
    // Both must be present
    if (!cookieToken || !headerToken) {
        return false;
    }
    
    // Tokens must match
    if (cookieToken !== headerToken) {
        return false;
    }
    
    // Token should be 64 characters (32 bytes as hex)
    if (cookieToken.length !== 64) {
        return false;
    }
    
    return true;
}

/**
 * Create CSRF token cookie (server-side)
 * Call this on login or when token is missing
 * Note: For double-submit cookie pattern, httpOnly must be false so client can read it
 */
export function createCsrfCookie(): { name: string; value: string; options: any } {
    const token = generateToken();
    
    return {
        name: CSRF_COOKIE_NAME,
        value: token,
        options: {
            httpOnly: false, // Must be readable by JavaScript for double-submit pattern
            secure: false, // Allow in development (HTTP) - will work in production HTTPS too
            sameSite: 'lax' as const, // 'lax' is less restrictive than 'strict', works better for SPAs
            path: '/',
            maxAge: 24 * 60 * 60 // 24 hours
        }
    };
}

