/**
 * Unit Tests for CSRF Protection
 * Tests token generation, validation, and utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Store browser mock value
let mockBrowser = false;

// Mock $app/environment before importing the module
vi.mock('$app/environment', () => ({
    get browser() {
        return mockBrowser;
    }
}));

// Import after mocking
import { validateCsrfToken, createCsrfCookie, getCsrfToken, getCsrfHeader, ensureCsrfToken } from './csrf';

describe('CSRF Token Validation', () => {
    describe('validateCsrfToken', () => {
        it('should return false when cookie token is missing', () => {
            expect(validateCsrfToken(null, 'valid-header-token-64-chars-long-xxxxxxxxxxxxxxxxxxxxxxxxxx')).toBe(false);
        });

        it('should return false when header token is missing', () => {
            expect(validateCsrfToken('valid-cookie-token-64-chars-long-xxxxxxxxxxxxxxxxxxxxxxxxxx', null)).toBe(false);
        });

        it('should return false when both tokens are missing', () => {
            expect(validateCsrfToken(null, null)).toBe(false);
        });

        it('should return false when tokens do not match', () => {
            const cookieToken = 'a'.repeat(64);
            const headerToken = 'b'.repeat(64);
            expect(validateCsrfToken(cookieToken, headerToken)).toBe(false);
        });

        it('should return true when tokens match and are valid length', () => {
            const token = 'a'.repeat(64);
            expect(validateCsrfToken(token, token)).toBe(true);
        });

        it('should return false when token is wrong length', () => {
            const shortToken = 'a'.repeat(32);
            expect(validateCsrfToken(shortToken, shortToken)).toBe(false);
        });

        it('should return false when tokens match but are too long', () => {
            const longToken = 'a'.repeat(128);
            expect(validateCsrfToken(longToken, longToken)).toBe(false);
        });

        it('should return false for empty strings', () => {
            expect(validateCsrfToken('', '')).toBe(false);
        });

        it('should return false when cookie is empty string', () => {
            expect(validateCsrfToken('', 'a'.repeat(64))).toBe(false);
        });

        it('should return false when header is empty string', () => {
            expect(validateCsrfToken('a'.repeat(64), '')).toBe(false);
        });

        it('should handle case-sensitive comparison', () => {
            const lowerCase = 'abcdef1234567890'.repeat(4);
            const upperCase = 'ABCDEF1234567890'.repeat(4);
            expect(validateCsrfToken(lowerCase, upperCase)).toBe(false);
        });

        it('should validate hex-like tokens correctly', () => {
            const hexToken = '0123456789abcdef'.repeat(4);
            expect(validateCsrfToken(hexToken, hexToken)).toBe(true);
        });
    });
});

describe('CSRF Cookie Creation (Server-side)', () => {
    beforeEach(() => {
        mockBrowser = false;
    });

    describe('createCsrfCookie', () => {
        it('should create a valid CSRF cookie object', () => {
            const cookie = createCsrfCookie();
            
            expect(cookie).toHaveProperty('name', 'csrf-token');
            expect(cookie).toHaveProperty('value');
            expect(cookie).toHaveProperty('options');
        });

        it('should generate a 64-character hex token', () => {
            const cookie = createCsrfCookie();
            
            expect(cookie.value).toHaveLength(64);
            expect(/^[0-9a-f]+$/i.test(cookie.value)).toBe(true);
        });

        it('should set correct cookie options', () => {
            const cookie = createCsrfCookie();
            
            expect(cookie.options.httpOnly).toBe(false); // Must be readable by JS for double-submit
            expect(cookie.options.sameSite).toBe('lax');
            expect(cookie.options.path).toBe('/');
            expect(cookie.options.maxAge).toBe(24 * 60 * 60); // 24 hours
        });

        it('should generate unique tokens on each call', () => {
            const cookie1 = createCsrfCookie();
            const cookie2 = createCsrfCookie();
            
            expect(cookie1.value).not.toBe(cookie2.value);
        });

        it('should set secure flag correctly', () => {
            const cookie = createCsrfCookie();
            expect(cookie.options.secure).toBe(false); // Allows HTTP in dev
        });

        it('should create tokens that are cryptographically unique', () => {
            // Generate 100 tokens and ensure all are unique
            const tokens = new Set<string>();
            for (let i = 0; i < 100; i++) {
                tokens.add(createCsrfCookie().value);
            }
            expect(tokens.size).toBe(100);
        });
    });
});

describe('Token Format', () => {
    beforeEach(() => {
        mockBrowser = false;
    });

    it('should create tokens that pass validation', () => {
        const cookie = createCsrfCookie();
        // Simulate double-submit: same token in cookie and header
        expect(validateCsrfToken(cookie.value, cookie.value)).toBe(true);
    });

    it('should create tokens with only hex characters', () => {
        const cookie = createCsrfCookie();
        // Ensure only valid hex characters (0-9, a-f)
        expect(/^[0-9a-f]+$/.test(cookie.value)).toBe(true);
    });
});

describe('Client-side CSRF Functions', () => {
    const originalDocument = global.document;

    beforeEach(() => {
        mockBrowser = true;
        // Mock document.cookie
        Object.defineProperty(global, 'document', {
            value: {
                cookie: ''
            },
            writable: true,
            configurable: true
        });
    });

    afterEach(() => {
        mockBrowser = false;
        // Restore document
        if (originalDocument) {
            Object.defineProperty(global, 'document', {
                value: originalDocument,
                writable: true,
                configurable: true
            });
        }
    });

    describe('getCsrfToken', () => {
        it('should return empty string when not in browser', () => {
            mockBrowser = false;
            const token = getCsrfToken();
            expect(token).toBe('');
        });

        it('should return empty string when no cookies exist', () => {
            mockBrowser = true;
            (global.document as any).cookie = '';
            const token = getCsrfToken();
            expect(token).toBe('');
        });

        it('should extract CSRF token from cookies', () => {
            mockBrowser = true;
            const expectedToken = 'a'.repeat(64);
            (global.document as any).cookie = `csrf-token=${expectedToken}`;
            const token = getCsrfToken();
            expect(token).toBe(expectedToken);
        });

        it('should find CSRF token among multiple cookies', () => {
            mockBrowser = true;
            const expectedToken = 'b'.repeat(64);
            (global.document as any).cookie = `other=value; csrf-token=${expectedToken}; another=data`;
            const token = getCsrfToken();
            expect(token).toBe(expectedToken);
        });

        it('should handle URL-encoded token values', () => {
            mockBrowser = true;
            const encodedToken = 'a'.repeat(64);
            (global.document as any).cookie = `csrf-token=${encodeURIComponent(encodedToken)}`;
            const token = getCsrfToken();
            expect(token).toBe(encodedToken);
        });

        it('should return empty string for malformed cookies', () => {
            mockBrowser = true;
            (global.document as any).cookie = 'csrf-token=';
            const token = getCsrfToken();
            expect(token).toBe('');
        });

        it('should handle whitespace in cookie values', () => {
            mockBrowser = true;
            const expectedToken = 'c'.repeat(64);
            (global.document as any).cookie = `  csrf-token=${expectedToken}  `;
            const token = getCsrfToken();
            expect(token).toBe(expectedToken);
        });

        it('should not match partial cookie names', () => {
            mockBrowser = true;
            (global.document as any).cookie = 'my-csrf-token=wrong; csrf-token-extra=also-wrong';
            const token = getCsrfToken();
            expect(token).toBe('');
        });
    });

    describe('getCsrfHeader', () => {
        it('should return empty object when not in browser', () => {
            mockBrowser = false;
            const header = getCsrfHeader();
            expect(header).toEqual({});
        });

        it('should return empty object when no token exists', () => {
            mockBrowser = true;
            (global.document as any).cookie = '';
            const header = getCsrfHeader();
            expect(header).toEqual({});
        });

        it('should return header with token when token exists', () => {
            mockBrowser = true;
            const expectedToken = 'd'.repeat(64);
            (global.document as any).cookie = `csrf-token=${expectedToken}`;
            const header = getCsrfHeader();
            expect(header).toEqual({ 'x-csrf-token': expectedToken });
        });

        it('should use correct header name', () => {
            mockBrowser = true;
            const expectedToken = 'e'.repeat(64);
            (global.document as any).cookie = `csrf-token=${expectedToken}`;
            const header = getCsrfHeader();
            expect(Object.keys(header)).toContain('x-csrf-token');
        });
    });

    describe('ensureCsrfToken', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('should return empty string when not in browser', async () => {
            mockBrowser = false;
            const token = await ensureCsrfToken();
            expect(token).toBe('');
        });

        it('should return existing token immediately', async () => {
            mockBrowser = true;
            const expectedToken = 'f'.repeat(64);
            (global.document as any).cookie = `csrf-token=${expectedToken}`;
            
            const tokenPromise = ensureCsrfToken();
            await vi.runAllTimersAsync();
            const token = await tokenPromise;
            
            expect(token).toBe(expectedToken);
        });

        it('should retry when token is not immediately available', async () => {
            mockBrowser = true;
            (global.document as any).cookie = '';
            
            // Mock fetch for the fallback HEAD request
            const mockFetch = vi.fn().mockResolvedValue({ ok: true });
            global.fetch = mockFetch;
            
            const tokenPromise = ensureCsrfToken();
            
            // Run all timers to trigger retries
            await vi.runAllTimersAsync();
            
            const token = await tokenPromise;
            
            // Should return empty string if token still not found
            expect(token).toBe('');
        });

        it('should handle fetch failure gracefully', async () => {
            mockBrowser = true;
            (global.document as any).cookie = '';
            
            // Mock fetch to fail
            const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
            global.fetch = mockFetch;
            
            // Mock console.warn
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            
            const tokenPromise = ensureCsrfToken();
            await vi.runAllTimersAsync();
            const token = await tokenPromise;
            
            expect(token).toBe('');
            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to ensure CSRF token'), expect.any(Error));
            
            warnSpy.mockRestore();
        });

        it('should return token if it becomes available during retry', async () => {
            mockBrowser = true;
            let callCount = 0;
            const expectedToken = 'g'.repeat(64);
            
            // Start with no token, then add it
            Object.defineProperty(global.document, 'cookie', {
                get: () => {
                    callCount++;
                    // Return token on third call
                    if (callCount >= 3) {
                        return `csrf-token=${expectedToken}`;
                    }
                    return '';
                },
                configurable: true
            });
            
            const tokenPromise = ensureCsrfToken();
            await vi.runAllTimersAsync();
            const token = await tokenPromise;
            
            expect(token).toBe(expectedToken);
        });
    });
});

describe('Edge Cases', () => {
    beforeEach(() => {
        mockBrowser = false;
    });

    it('should handle cookies with special characters', () => {
        mockBrowser = true;
        Object.defineProperty(global, 'document', {
            value: {
                cookie: 'csrf-token=' + 'a'.repeat(64) + '; path=/; SameSite=Lax'
            },
            writable: true,
            configurable: true
        });
        
        const token = getCsrfToken();
        // Should extract just the token value, not the path and SameSite
        expect(token).toBe('a'.repeat(64));
    });

    it('should validate exact 64-character requirement strictly', () => {
        // 63 characters - should fail
        expect(validateCsrfToken('a'.repeat(63), 'a'.repeat(63))).toBe(false);
        // 64 characters - should pass
        expect(validateCsrfToken('a'.repeat(64), 'a'.repeat(64))).toBe(true);
        // 65 characters - should fail
        expect(validateCsrfToken('a'.repeat(65), 'a'.repeat(65))).toBe(false);
    });

    it('should handle unicode in cookie values gracefully', () => {
        mockBrowser = true;
        Object.defineProperty(global, 'document', {
            value: {
                cookie: 'csrf-token=' + encodeURIComponent('🔐'.repeat(32))
            },
            writable: true,
            configurable: true
        });
        
        const token = getCsrfToken();
        // Should decode the value
        expect(token).toBe('🔐'.repeat(32));
    });

    it('should handle decoding errors gracefully', () => {
        mockBrowser = true;
        Object.defineProperty(global, 'document', {
            value: {
                cookie: 'csrf-token=%ZZ%invalid'
            },
            writable: true,
            configurable: true
        });
        
        const token = getCsrfToken();
        // Should return the raw value if decoding fails
        expect(token).toBe('%ZZ%invalid');
    });
});
