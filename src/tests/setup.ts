/**
 * Test Setup File
 * Configures the testing environment for Vitest
 */

import { vi } from 'vitest';

// Mock browser globals that may be used in tests
const localStorageMock = {
    store: {} as Record<string, string>,
    getItem: vi.fn((key: string) => localStorageMock.store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
        localStorageMock.store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
        delete localStorageMock.store[key];
    }),
    clear: vi.fn(() => {
        localStorageMock.store = {};
    }),
    get length() {
        return Object.keys(localStorageMock.store).length;
    },
    key: vi.fn((index: number) => Object.keys(localStorageMock.store)[index] ?? null)
};

// Set up localStorage mock
Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageMock,
    writable: true
});

// Mock crypto for CSRF token generation
Object.defineProperty(globalThis, 'crypto', {
    value: {
        getRandomValues: (array: Uint8Array) => {
            for (let i = 0; i < array.length; i++) {
                array[i] = Math.floor(Math.random() * 256);
            }
            return array;
        },
        subtle: {
            generateKey: vi.fn(),
            encrypt: vi.fn(),
            decrypt: vi.fn()
        }
    },
    writable: true
});

// Reset mocks before each test
beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
});

// Export for use in tests
export { localStorageMock };

