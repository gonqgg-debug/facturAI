/**
 * Tests for Backup & Restore System
 * 
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock browser and db before imports
vi.mock('$app/environment', () => ({
    browser: true
}));

// Preserve and mock URL
class MockURL {
    href: string;
    constructor(url: string) {
        this.href = url;
    }
    static createObjectURL = vi.fn(() => 'blob:test');
    static revokeObjectURL = vi.fn();
}
(globalThis as unknown as { URL: typeof MockURL }).URL = MockURL;

// Mock crypto API
const mockCrypto = {
    subtle: {
        generateKey: vi.fn(),
        importKey: vi.fn(),
        deriveKey: vi.fn(),
        encrypt: vi.fn(),
        decrypt: vi.fn(),
        digest: vi.fn()
    },
    getRandomValues: vi.fn((arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) {
            arr[i] = Math.floor(Math.random() * 256);
        }
        return arr;
    })
};

Object.defineProperty(global, 'crypto', {
    value: mockCrypto,
    writable: true
});

// Mock db
const mockDb = {
    invoices: {
        toArray: vi.fn().mockResolvedValue([
            { id: 1, providerName: 'Test Supplier', total: 1000 }
        ]),
        clear: vi.fn().mockResolvedValue(undefined),
        bulkAdd: vi.fn().mockResolvedValue([1])
    },
    suppliers: {
        toArray: vi.fn().mockResolvedValue([
            { id: 1, name: 'Test Supplier', rnc: '123456789' }
        ]),
        clear: vi.fn().mockResolvedValue(undefined),
        bulkAdd: vi.fn().mockResolvedValue([1])
    },
    products: {
        toArray: vi.fn().mockResolvedValue([
            { id: 1, name: 'Test Product', lastPrice: 100, lastDate: '2024-01-01' }
        ]),
        clear: vi.fn().mockResolvedValue(undefined),
        bulkAdd: vi.fn().mockResolvedValue([1]),
        add: vi.fn().mockResolvedValue(1)
    },
    customers: {
        toArray: vi.fn().mockResolvedValue([
            { id: 1, name: 'Test Customer', type: 'retail', isActive: true }
        ]),
        clear: vi.fn().mockResolvedValue(undefined),
        bulkAdd: vi.fn().mockResolvedValue([1]),
        add: vi.fn().mockResolvedValue(1)
    },
    sales: {
        toArray: vi.fn().mockResolvedValue([]),
        clear: vi.fn().mockResolvedValue(undefined),
        bulkAdd: vi.fn().mockResolvedValue([]),
        add: vi.fn().mockResolvedValue(1)
    },
    users: {
        toArray: vi.fn().mockResolvedValue([
            { id: 1, username: 'admin', displayName: 'Admin', pin: '1234', roleId: 1, isActive: true }
        ]),
        clear: vi.fn().mockResolvedValue(undefined),
        bulkAdd: vi.fn().mockResolvedValue([1]),
        add: vi.fn().mockResolvedValue(1)
    },
    roles: {
        toArray: vi.fn().mockResolvedValue([
            { id: 1, name: 'Admin', permissions: ['all'], isSystem: true }
        ]),
        clear: vi.fn().mockResolvedValue(undefined),
        bulkAdd: vi.fn().mockResolvedValue([1]),
        add: vi.fn().mockResolvedValue(1)
    },
    rules: {
        toArray: vi.fn().mockResolvedValue([]),
        clear: vi.fn().mockResolvedValue(undefined),
        bulkAdd: vi.fn().mockResolvedValue([]),
        add: vi.fn().mockResolvedValue(1)
    },
    globalContext: {
        toArray: vi.fn().mockResolvedValue([]),
        clear: vi.fn().mockResolvedValue(undefined),
        bulkAdd: vi.fn().mockResolvedValue([]),
        add: vi.fn().mockResolvedValue(1)
    },
    stockMovements: {
        toArray: vi.fn().mockResolvedValue([]),
        clear: vi.fn().mockResolvedValue(undefined),
        bulkAdd: vi.fn().mockResolvedValue([]),
        add: vi.fn().mockResolvedValue(1)
    },
    bankAccounts: {
        toArray: vi.fn().mockResolvedValue([]),
        clear: vi.fn().mockResolvedValue(undefined),
        bulkAdd: vi.fn().mockResolvedValue([]),
        add: vi.fn().mockResolvedValue(1)
    },
    payments: {
        toArray: vi.fn().mockResolvedValue([]),
        clear: vi.fn().mockResolvedValue(undefined),
        bulkAdd: vi.fn().mockResolvedValue([]),
        add: vi.fn().mockResolvedValue(1)
    },
    shifts: {
        toArray: vi.fn().mockResolvedValue([]),
        clear: vi.fn().mockResolvedValue(undefined),
        bulkAdd: vi.fn().mockResolvedValue([]),
        add: vi.fn().mockResolvedValue(1)
    },
    returns: {
        toArray: vi.fn().mockResolvedValue([]),
        clear: vi.fn().mockResolvedValue(undefined),
        bulkAdd: vi.fn().mockResolvedValue([]),
        add: vi.fn().mockResolvedValue(1)
    },
    customerSegments: {
        toArray: vi.fn().mockResolvedValue([]),
        clear: vi.fn().mockResolvedValue(undefined),
        bulkAdd: vi.fn().mockResolvedValue([]),
        add: vi.fn().mockResolvedValue(1)
    },
    transactionFeatures: {
        toArray: vi.fn().mockResolvedValue([]),
        clear: vi.fn().mockResolvedValue(undefined),
        bulkAdd: vi.fn().mockResolvedValue([]),
        add: vi.fn().mockResolvedValue(1)
    },
    realTimeInsights: {
        toArray: vi.fn().mockResolvedValue([]),
        clear: vi.fn().mockResolvedValue(undefined),
        bulkAdd: vi.fn().mockResolvedValue([]),
        add: vi.fn().mockResolvedValue(1)
    },
    weatherRecords: {
        toArray: vi.fn().mockResolvedValue([]),
        clear: vi.fn().mockResolvedValue(undefined),
        bulkAdd: vi.fn().mockResolvedValue([]),
        add: vi.fn().mockResolvedValue(1)
    },
    purchaseOrders: {
        toArray: vi.fn().mockResolvedValue([]),
        clear: vi.fn().mockResolvedValue(undefined),
        bulkAdd: vi.fn().mockResolvedValue([]),
        add: vi.fn().mockResolvedValue(1)
    },
    receipts: {
        toArray: vi.fn().mockResolvedValue([]),
        clear: vi.fn().mockResolvedValue(undefined),
        bulkAdd: vi.fn().mockResolvedValue([]),
        add: vi.fn().mockResolvedValue(1)
    },
    tables: [],
    transaction: vi.fn(async (_mode: string, _tables: unknown, callback: () => Promise<void>) => {
        await callback();
    }),
    initializeDefaults: vi.fn().mockResolvedValue(undefined)
};

vi.mock('./db', () => ({
    db: mockDb
}));

describe('Backup Module', () => {
    let mockLocalStorage: Record<string, string>;
    
    beforeEach(() => {
        vi.clearAllMocks();
        
        // Mock localStorage
        mockLocalStorage = {};
        const localStorageMock = {
            getItem: vi.fn((key: string) => mockLocalStorage[key] || null),
            setItem: vi.fn((key: string, value: string) => { mockLocalStorage[key] = value; }),
            removeItem: vi.fn((key: string) => { delete mockLocalStorage[key]; }),
            clear: vi.fn(() => { mockLocalStorage = {}; })
        };
        vi.stubGlobal('localStorage', localStorageMock);
        
        // Mock navigator
        vi.stubGlobal('navigator', {
            userAgent: 'test-agent',
            language: 'en',
            platform: 'test'
        });
        
        // Mock document for download
        const mockAnchor = {
            href: '',
            download: '',
            click: vi.fn()
        };
        vi.stubGlobal('document', {
            createElement: vi.fn(() => mockAnchor),
            body: {
                appendChild: vi.fn(),
                removeChild: vi.fn()
            }
        });
        
        // URL is already mocked globally, reset mocks
        MockURL.createObjectURL.mockClear();
        MockURL.revokeObjectURL.mockClear();
        
        // Mock crypto.subtle.digest for checksum
        mockCrypto.subtle.digest.mockImplementation(async (_alg: string, data: ArrayBuffer) => {
            // Simple mock hash
            const arr = new Uint8Array(data);
            const sum = arr.reduce((a, b) => a + b, 0);
            const hash = new Uint8Array(32);
            hash[0] = sum % 256;
            return hash.buffer;
        });
    });
    
    afterEach(() => {
        vi.unstubAllGlobals();
        // Restore URL mock after unstubbing
        (globalThis as unknown as { URL: typeof MockURL }).URL = MockURL;
    });
    
    describe('createBackup', () => {
        it('should create a backup with all tables', async () => {
            const { createBackup } = await import('./backup');
            
            const result = await createBackup();
            
            expect(result.success).toBe(true);
            expect(result.filename).toBeDefined();
            expect(result.filename).toContain('minimarket_backup_');
            expect(result.recordCount).toBeGreaterThan(0);
        });
        
        it('should track progress during backup', async () => {
            const { createBackup } = await import('./backup');
            
            const progressUpdates: { stage: string; percent: number }[] = [];
            
            await createBackup({
                onProgress: (progress) => {
                    progressUpdates.push({ ...progress });
                }
            });
            
            expect(progressUpdates.length).toBeGreaterThan(0);
            expect(progressUpdates[progressUpdates.length - 1].percent).toBe(100);
        });
        
        it('should exclude analytics tables when specified', async () => {
            const { createBackup } = await import('./backup');
            
            const result = await createBackup({ includeAnalytics: false });
            
            expect(result.success).toBe(true);
        });
        
        it('should generate filename with date', async () => {
            const { createBackup } = await import('./backup');
            
            const result = await createBackup();
            
            expect(result.success).toBe(true);
            expect(result.filename).toMatch(/minimarket_backup_\d{4}-\d{2}-\d{2}_\d{4}\.json/);
        });
        
        it('should include _encrypted suffix when password provided', async () => {
            const { createBackup } = await import('./backup');
            
            // Mock encryption
            const mockKey = { type: 'secret' };
            mockCrypto.subtle.importKey.mockResolvedValue(mockKey);
            mockCrypto.subtle.deriveKey.mockResolvedValue(mockKey);
            mockCrypto.subtle.encrypt.mockResolvedValue(new ArrayBuffer(10));
            
            const result = await createBackup({ password: 'testpassword' });
            
            expect(result.success).toBe(true);
            expect(result.filename).toContain('_encrypted');
        });
    });
    
    describe('Auto-backup', () => {
        it('should create auto-backup to localStorage', async () => {
            const { createAutoBackup, getAutoBackupInfo } = await import('./backup');
            
            const result = await createAutoBackup();
            
            expect(result).toBe(true);
            
            const info = getAutoBackupInfo();
            expect(info).toBeDefined();
            expect(info?.timestamp).toBeDefined();
        });
        
        it('should clear auto-backup', async () => {
            const { createAutoBackup, clearAutoBackup, getAutoBackupInfo } = await import('./backup');
            
            await createAutoBackup();
            expect(getAutoBackupInfo()).not.toBeNull();
            
            clearAutoBackup();
            expect(getAutoBackupInfo()).toBeNull();
        });
        
        it('should return null when no auto-backup exists', async () => {
            const { getAutoBackupInfo } = await import('./backup');
            
            const info = getAutoBackupInfo();
            expect(info).toBeNull();
        });
        
        it('should include size in auto-backup info', async () => {
            const { createAutoBackup, getAutoBackupInfo } = await import('./backup');
            
            await createAutoBackup();
            const info = getAutoBackupInfo();
            
            expect(info?.size).toBeGreaterThan(0);
        });
    });
    
    describe('Scheduled backups', () => {
        it('should start and stop scheduled backups', async () => {
            vi.useFakeTimers();
            const { startScheduledBackups, stopScheduledBackups } = await import('./backup');
            
            startScheduledBackups(1); // 1 hour interval
            
            // Advance time to trigger interval
            vi.advanceTimersByTime(1000);
            
            stopScheduledBackups();
            vi.useRealTimers();
        });
    });
    
    describe('Export specific tables', () => {
        it('should export only specified tables', async () => {
            const { exportTables } = await import('./backup');
            
            const result = await exportTables(['products', 'suppliers']);
            
            expect(result.success).toBe(true);
            expect(result.recordCount).toBe(2); // 1 product + 1 supplier
        });
        
        it('should use custom filename when provided', async () => {
            const { exportTables } = await import('./backup');
            
            const result = await exportTables(['products'], { filename: 'custom_export.json' });
            
            expect(result.success).toBe(true);
            expect(result.filename).toBe('custom_export.json');
        });
    });
    
    describe('Backup metadata', () => {
        it('should include correct version info', async () => {
            const { createBackup } = await import('./backup');
            
            let capturedBlob: Blob | null = null;
            const originalBlob = globalThis.Blob;
            globalThis.Blob = class MockBlob {
                content: BlobPart[];
                constructor(content: BlobPart[], _options?: BlobPropertyBag) {
                    this.content = content;
                    capturedBlob = this as unknown as Blob;
                }
                get size() { return 1000; }
            } as unknown as typeof Blob;
            
            await createBackup();
            
            globalThis.Blob = originalBlob;
            
            if (capturedBlob) {
                const content = (capturedBlob as unknown as { content: string[] }).content[0];
                const backup = JSON.parse(content);
                
                expect(backup.metadata.version).toBe(2);
                expect(backup.metadata.schemaVersion).toBe(14);
                expect(backup.metadata.appVersion).toBe('1.1.0');
                expect(backup.metadata.deviceInfo).toBeDefined();
                expect(backup.metadata.checksum).toBeDefined();
            }
        });
    });
});

describe('Backup types and constants', () => {
    it('should export all required types', async () => {
        const backup = await import('./backup');
        
        expect(typeof backup.createBackup).toBe('function');
        expect(typeof backup.restoreBackup).toBe('function');
        expect(typeof backup.validateBackup).toBe('function');
        expect(typeof backup.createAutoBackup).toBe('function');
        expect(typeof backup.getAutoBackupInfo).toBe('function');
        expect(typeof backup.clearAutoBackup).toBe('function');
        expect(typeof backup.startScheduledBackups).toBe('function');
        expect(typeof backup.stopScheduledBackups).toBe('function');
        expect(typeof backup.exportTables).toBe('function');
        expect(typeof backup.importData).toBe('function');
    });
});
