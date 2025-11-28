/**
 * Unit Tests for Encryption Utility
 * Tests AES-GCM encryption for localStorage
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    initEncryptionKey,
    encrypt,
    decrypt,
    clearEncryptionKey,
    encryptedStorage
} from './encryption';

// Mock $app/environment
const mockBrowser = vi.fn(() => true);
vi.mock('$app/environment', () => {
    return {
        get browser() {
            return mockBrowser();
        }
    };
});

// Mock Web Crypto API
const mockCrypto = {
    subtle: {
        generateKey: vi.fn(),
        encrypt: vi.fn(),
        decrypt: vi.fn()
    },
    getRandomValues: vi.fn()
};

// Mock localStorage
const mockLocalStorage = {
    store: {} as Record<string, string>,
    getItem: vi.fn((key: string) => mockLocalStorage.store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
        mockLocalStorage.store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
        delete mockLocalStorage.store[key];
    }),
    clear: vi.fn(() => {
        mockLocalStorage.store = {};
    })
};

describe('Encryption', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockLocalStorage.clear();
        clearEncryptionKey();
        mockBrowser.mockReturnValue(true);

        // Setup global crypto mock
        global.crypto = mockCrypto as any;
        global.localStorage = mockLocalStorage as any;
        global.btoa = vi.fn((str: string) => Buffer.from(str, 'binary').toString('base64'));
        global.atob = vi.fn((str: string) => Buffer.from(str, 'base64').toString('binary'));

        // Mock TextEncoder/TextDecoder
        global.TextEncoder = class {
            encode(str: string) {
                return new Uint8Array(Buffer.from(str, 'utf-8'));
            }
        } as any;
        global.TextDecoder = class {
            decode(data: Uint8Array) {
                return Buffer.from(data).toString('utf-8');
            }
        } as any;

        // Setup default crypto key mock
        const mockKey = { type: 'secret', algorithm: { name: 'AES-GCM' } } as CryptoKey;
        mockCrypto.subtle.generateKey.mockResolvedValue(mockKey);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('initEncryptionKey', () => {
        it('should generate encryption key', async () => {
            const key = await initEncryptionKey();
            expect(key).toBeTruthy();
            expect(mockCrypto.subtle.generateKey).toHaveBeenCalledWith(
                {
                    name: 'AES-GCM',
                    length: 256
                },
                false,
                ['encrypt', 'decrypt']
            );
        });

        it('should return existing key if already initialized', async () => {
            const key1 = await initEncryptionKey();
            const key2 = await initEncryptionKey();
            expect(key1).toBe(key2);
            expect(mockCrypto.subtle.generateKey).toHaveBeenCalledTimes(1);
        });

        it('should return null in non-browser environment', async () => {
            mockBrowser.mockReturnValue(false);
            const key = await initEncryptionKey();
            expect(key).toBeNull();
            expect(mockCrypto.subtle.generateKey).not.toHaveBeenCalled();
        });

        it('should handle key generation errors gracefully', async () => {
            mockCrypto.subtle.generateKey.mockRejectedValue(new Error('Crypto error'));
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            
            const key = await initEncryptionKey();
            expect(key).toBeNull();
            expect(consoleSpy).toHaveBeenCalled();
        });
    });

    describe('encrypt', () => {
        beforeEach(async () => {
            const mockKey = { type: 'secret' } as CryptoKey;
            mockCrypto.subtle.generateKey.mockResolvedValue(mockKey);
            
            // Mock IV
            const mockIV = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
            mockCrypto.getRandomValues.mockReturnValue(mockIV);
            
            // Mock encrypted data
            const mockEncrypted = new ArrayBuffer(16);
            mockCrypto.subtle.encrypt.mockResolvedValue(mockEncrypted);
        });

        it('should encrypt a string value', async () => {
            const result = await encrypt('test value');
            expect(result).toBeTruthy();
            expect(result).toContain('encrypted:');
            expect(mockCrypto.subtle.encrypt).toHaveBeenCalled();
        });

        it('should return null for empty string', async () => {
            const result = await encrypt('');
            expect(result).toBe('');
        });

        it('should return value as-is in non-browser environment', async () => {
            mockBrowser.mockReturnValue(false);
            const result = await encrypt('test');
            expect(result).toBe('test');
            expect(mockCrypto.subtle.encrypt).not.toHaveBeenCalled();
        });

        it('should handle encryption errors gracefully', async () => {
            mockCrypto.subtle.encrypt.mockRejectedValue(new Error('Encryption failed'));
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            
            const result = await encrypt('test');
            expect(result).toBe('test'); // Graceful degradation
            expect(consoleSpy).toHaveBeenCalled();
        });

        it('should return plaintext if key initialization fails', async () => {
            mockCrypto.subtle.generateKey.mockResolvedValue(null);
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            
            const result = await encrypt('test');
            expect(result).toBe('test');
            expect(consoleSpy).toHaveBeenCalledWith(
                'Encryption not available, storing plaintext'
            );
        });

        it('should prefix encrypted data with "encrypted:"', async () => {
            const result = await encrypt('test');
            expect(result).toMatch(/^encrypted:/);
        });
    });

    describe('decrypt', () => {
        beforeEach(async () => {
            const mockKey = { type: 'secret' } as CryptoKey;
            mockCrypto.subtle.generateKey.mockResolvedValue(mockKey);
        });

        it('should decrypt encrypted value', async () => {
            // First encrypt
            const mockIV = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
            mockCrypto.getRandomValues.mockReturnValue(mockIV);
            const mockEncrypted = new ArrayBuffer(16);
            mockCrypto.subtle.encrypt.mockResolvedValue(mockEncrypted);
            
            const encrypted = await encrypt('test value');
            
            // Then decrypt
            const mockDecrypted = new TextEncoder().encode('test value');
            mockCrypto.subtle.decrypt.mockResolvedValue(mockDecrypted.buffer);
            
            const result = await decrypt(encrypted!);
            expect(result).toBe('test value');
            expect(mockCrypto.subtle.decrypt).toHaveBeenCalled();
        });

        it('should return plaintext value if not encrypted', async () => {
            const result = await decrypt('plaintext value');
            expect(result).toBe('plaintext value');
            expect(mockCrypto.subtle.decrypt).not.toHaveBeenCalled();
        });

        it('should return null for empty string', async () => {
            const result = await decrypt('');
            expect(result).toBe('');
        });

        it('should return value as-is in non-browser environment', async () => {
            mockBrowser.mockReturnValue(false);
            const result = await decrypt('test');
            expect(result).toBe('test');
        });

        it('should return null if decryption fails', async () => {
            mockCrypto.subtle.decrypt.mockRejectedValue(new Error('Decryption failed'));
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            
            const result = await decrypt('encrypted:invalid');
            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalled();
        });

        it('should return null if key initialization fails', async () => {
            mockCrypto.subtle.generateKey.mockResolvedValue(null);
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            
            const result = await decrypt('encrypted:test');
            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalled();
        });
    });

    describe('clearEncryptionKey', () => {
        it('should clear the encryption key', async () => {
            await initEncryptionKey();
            clearEncryptionKey();
            
            // Next init should generate a new key
            await initEncryptionKey();
            expect(mockCrypto.subtle.generateKey).toHaveBeenCalledTimes(2);
        });
    });

    describe('encryptedStorage', () => {
        beforeEach(async () => {
            const mockKey = { type: 'secret' } as CryptoKey;
            mockCrypto.subtle.generateKey.mockResolvedValue(mockKey);
            
            const mockIV = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
            mockCrypto.getRandomValues.mockReturnValue(mockIV);
            const mockEncrypted = new ArrayBuffer(16);
            mockCrypto.subtle.encrypt.mockResolvedValue(mockEncrypted);
        });

        it('should store encrypted value', async () => {
            await encryptedStorage.setItem('test-key', 'test value');
            expect(mockLocalStorage.setItem).toHaveBeenCalled();
            const stored = mockLocalStorage.store['test-key'];
            expect(stored).toContain('encrypted:');
        });

        it('should retrieve and decrypt value', async () => {
            // First store
            await encryptedStorage.setItem('test-key', 'test value');
            
            // Then retrieve
            const mockDecrypted = new TextEncoder().encode('test value');
            mockCrypto.subtle.decrypt.mockResolvedValue(mockDecrypted.buffer);
            
            const result = await encryptedStorage.getItem('test-key');
            expect(result).toBe('test value');
        });

        it('should return null for non-existent key', async () => {
            const result = await encryptedStorage.getItem('non-existent');
            expect(result).toBeNull();
        });

        it('should remove item', () => {
            encryptedStorage.removeItem('test-key');
            expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('test-key');
        });

        it('should fall back to plaintext if encryption fails', async () => {
            mockCrypto.subtle.encrypt.mockRejectedValue(new Error('Encryption failed'));
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            
            await encryptedStorage.setItem('test-key', 'test value');
            // The encrypt function catches the error and returns the value as-is
            // So setItem receives the plaintext value
            expect(mockLocalStorage.setItem).toHaveBeenCalledWith('test-key', 'test value');
            // The error is logged in the encrypt function
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Encryption failed:',
                expect.any(Error)
            );
        });

        it('should return plaintext if decryption fails', async () => {
            // Store plaintext
            mockLocalStorage.setItem('test-key', 'plaintext value');
            
            // Try to get (will fail decryption and return original)
            mockCrypto.subtle.decrypt.mockRejectedValue(new Error('Decryption failed'));
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            
            const result = await encryptedStorage.getItem('test-key');
            expect(result).toBe('plaintext value');
        });

        it('should not operate in non-browser environment', async () => {
            mockBrowser.mockReturnValue(false);
            
            await encryptedStorage.setItem('test-key', 'test');
            expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
            
            const result = await encryptedStorage.getItem('test-key');
            expect(result).toBeNull();
            
            encryptedStorage.removeItem('test-key');
            expect(mockLocalStorage.removeItem).not.toHaveBeenCalled();
        });

        it('should handle errors gracefully in getItem', async () => {
            // First call throws, second call returns null
            let callCount = 0;
            mockLocalStorage.getItem.mockImplementation(() => {
                callCount++;
                if (callCount === 1) {
                    throw new Error('Storage error');
                }
                return null;
            });
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
            
            const result = await encryptedStorage.getItem('test-key');
            // Should return null after error handling
            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalledWith(
                'Error getting encrypted item, trying plaintext:',
                expect.any(Error)
            );
        });
    });
});

