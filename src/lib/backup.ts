/**
 * Comprehensive Backup & Restore System
 * 
 * Features:
 * - Full database export (all 17 tables)
 * - Versioning system for compatibility
 * - Optional password-based encryption (AES-GCM with PBKDF2)
 * - Validation before restore
 * - Integrity checksums
 * - Progress tracking
 * 
 * @module backup
 */

import { browser } from '$app/environment';
import { db } from './db';
import { z } from 'zod';

// ============ TYPES ============

export interface BackupMetadata {
    version: number;
    schemaVersion: number;
    appVersion: string;
    createdAt: string;
    deviceInfo: {
        userAgent: string;
        language: string;
        platform: string;
    };
    checksum: string;
    encrypted: boolean;
    tables: string[];
    recordCounts: Record<string, number>;
}

export interface BackupData {
    metadata: BackupMetadata;
    data: {
        invoices: unknown[];
        suppliers: unknown[];
        rules: unknown[];
        globalContext: unknown[];
        products: unknown[];
        stockMovements: unknown[];
        bankAccounts: unknown[];
        payments: unknown[];
        customers: unknown[];
        sales: unknown[];
        shifts: unknown[];
        returns: unknown[];
        users: unknown[];
        roles: unknown[];
        customerSegments: unknown[];
        transactionFeatures: unknown[];
        realTimeInsights: unknown[];
        weatherRecords: unknown[];
        purchaseOrders: unknown[];
        receipts: unknown[];
    };
}

export interface BackupProgress {
    stage: string;
    percent: number;
    currentTable?: string;
}

export interface BackupResult {
    success: boolean;
    filename?: string;
    size?: number;
    recordCount?: number;
    error?: string;
}

export interface RestoreResult {
    success: boolean;
    recordsRestored?: number;
    tablesRestored?: string[];
    warnings?: string[];
    error?: string;
}

export interface ValidationResult {
    valid: boolean;
    version?: number;
    schemaVersion?: number;
    encrypted?: boolean;
    tables?: string[];
    recordCounts?: Record<string, number>;
    errors: string[];
    warnings: string[];
}

// ============ CONSTANTS ============

const CURRENT_BACKUP_VERSION = 2;
const CURRENT_SCHEMA_VERSION = 14; // Must match db.ts version
const APP_VERSION = '1.1.0';
const BACKUP_PREFIX = 'MINIMARKET_BACKUP';
const ENCRYPTION_SALT_LENGTH = 16;
const ENCRYPTION_IV_LENGTH = 12;
const PBKDF2_ITERATIONS = 100000;

// All database tables in order
const ALL_TABLES = [
    'invoices',
    'suppliers',
    'rules',
    'globalContext',
    'products',
    'stockMovements',
    'bankAccounts',
    'payments',
    'customers',
    'sales',
    'shifts',
    'returns',
    'users',
    'roles',
    'customerSegments',
    'transactionFeatures',
    'realTimeInsights',
    'weatherRecords',
    'purchaseOrders',
    'receipts'
] as const;

// ============ BACKUP SCHEMA VALIDATION ============

const backupMetadataSchema = z.object({
    version: z.number().min(1),
    schemaVersion: z.number().min(1),
    appVersion: z.string(),
    createdAt: z.string(),
    deviceInfo: z.object({
        userAgent: z.string(),
        language: z.string(),
        platform: z.string()
    }),
    checksum: z.string(),
    encrypted: z.boolean(),
    tables: z.array(z.string()),
    recordCounts: z.record(z.number())
});

const backupDataSchema = z.object({
    metadata: backupMetadataSchema,
    data: z.record(z.array(z.unknown()))
});

// ============ ENCRYPTION UTILITIES ============

/**
 * Derive encryption key from password using PBKDF2
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
    );
    
    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt,
            iterations: PBKDF2_ITERATIONS,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

/**
 * Encrypt data with password
 */
async function encryptData(data: string, password: string): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(ENCRYPTION_SALT_LENGTH));
    const iv = crypto.getRandomValues(new Uint8Array(ENCRYPTION_IV_LENGTH));
    const key = await deriveKey(password, salt);
    
    const encoder = new TextEncoder();
    const encryptedData = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        encoder.encode(data)
    );
    
    // Combine salt + iv + encrypted data
    const combined = new Uint8Array(
        ENCRYPTION_SALT_LENGTH + ENCRYPTION_IV_LENGTH + encryptedData.byteLength
    );
    combined.set(salt, 0);
    combined.set(iv, ENCRYPTION_SALT_LENGTH);
    combined.set(new Uint8Array(encryptedData), ENCRYPTION_SALT_LENGTH + ENCRYPTION_IV_LENGTH);
    
    // Return as base64
    return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt data with password
 */
async function decryptData(encryptedBase64: string, password: string): Promise<string> {
    const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
    
    // Extract salt, iv, and encrypted data
    const salt = combined.slice(0, ENCRYPTION_SALT_LENGTH);
    const iv = combined.slice(ENCRYPTION_SALT_LENGTH, ENCRYPTION_SALT_LENGTH + ENCRYPTION_IV_LENGTH);
    const encryptedData = combined.slice(ENCRYPTION_SALT_LENGTH + ENCRYPTION_IV_LENGTH);
    
    const key = await deriveKey(password, salt);
    
    const decryptedData = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encryptedData
    );
    
    const decoder = new TextDecoder();
    return decoder.decode(decryptedData);
}

// ============ CHECKSUM UTILITIES ============

/**
 * Calculate SHA-256 checksum of data
 */
async function calculateChecksum(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify checksum of backup data
 */
async function verifyChecksum(backup: BackupData): Promise<boolean> {
    const dataString = JSON.stringify(backup.data);
    const calculatedChecksum = await calculateChecksum(dataString);
    return calculatedChecksum === backup.metadata.checksum;
}

// ============ BACKUP FUNCTIONS ============

/**
 * Create a full backup of the database
 */
export async function createBackup(
    options: {
        password?: string;
        includeAnalytics?: boolean;
        onProgress?: (progress: BackupProgress) => void;
    } = {}
): Promise<BackupResult> {
    if (!browser || !db) {
        return { success: false, error: 'Backup only available in browser' };
    }
    
    const { password, includeAnalytics = true, onProgress } = options;
    
    try {
        const data: Record<string, unknown[]> = {};
        const recordCounts: Record<string, number> = {};
        let totalRecords = 0;
        
        // Determine which tables to export
        const tablesToExport = includeAnalytics 
            ? ALL_TABLES 
            : ALL_TABLES.filter(t => !['customerSegments', 'transactionFeatures', 'realTimeInsights', 'weatherRecords'].includes(t));
        
        // Export each table
        for (let i = 0; i < tablesToExport.length; i++) {
            const tableName = tablesToExport[i];
            onProgress?.({
                stage: 'Exporting data',
                percent: Math.round((i / tablesToExport.length) * 70),
                currentTable: tableName
            });
            
            try {
                const table = (db as Record<string, { toArray: () => Promise<unknown[]> }>)[tableName];
                if (table && typeof table.toArray === 'function') {
                    const records = await table.toArray();
                    data[tableName] = records;
                    recordCounts[tableName] = records.length;
                    totalRecords += records.length;
                } else {
                    data[tableName] = [];
                    recordCounts[tableName] = 0;
                }
            } catch (tableError) {
                console.warn(`Failed to export table ${tableName}:`, tableError);
                data[tableName] = [];
                recordCounts[tableName] = 0;
            }
        }
        
        onProgress?.({ stage: 'Calculating checksum', percent: 75 });
        
        // Calculate checksum
        const dataString = JSON.stringify(data);
        const checksum = await calculateChecksum(dataString);
        
        // Create metadata
        const metadata: BackupMetadata = {
            version: CURRENT_BACKUP_VERSION,
            schemaVersion: CURRENT_SCHEMA_VERSION,
            appVersion: APP_VERSION,
            createdAt: new Date().toISOString(),
            deviceInfo: {
                userAgent: navigator.userAgent,
                language: navigator.language,
                platform: navigator.platform
            },
            checksum,
            encrypted: !!password,
            tables: tablesToExport as unknown as string[],
            recordCounts
        };
        
        const backup: BackupData = {
            metadata,
            data: data as BackupData['data']
        };
        
        onProgress?.({ stage: 'Preparing file', percent: 80 });
        
        // Convert to JSON string
        let backupContent = JSON.stringify(backup, null, 2);
        
        // Encrypt if password provided
        if (password) {
            onProgress?.({ stage: 'Encrypting', percent: 85 });
            const encryptedData = await encryptData(backupContent, password);
            backupContent = JSON.stringify({
                format: BACKUP_PREFIX,
                version: CURRENT_BACKUP_VERSION,
                encrypted: true,
                data: encryptedData
            });
        }
        
        onProgress?.({ stage: 'Creating file', percent: 90 });
        
        // Create and download file
        const blob = new Blob([backupContent], { type: 'application/json' });
        const filename = generateBackupFilename(!!password);
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        onProgress?.({ stage: 'Complete', percent: 100 });
        
        return {
            success: true,
            filename,
            size: blob.size,
            recordCount: totalRecords
        };
    } catch (error) {
        console.error('Backup failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Generate backup filename with timestamp
 */
function generateBackupFilename(encrypted: boolean): string {
    const date = new Date().toISOString().split('T')[0];
    const time = new Date().toTimeString().slice(0, 5).replace(':', '');
    const suffix = encrypted ? '_encrypted' : '';
    return `minimarket_backup_${date}_${time}${suffix}.json`;
}

// ============ VALIDATION FUNCTIONS ============

/**
 * Validate a backup file without restoring
 */
export async function validateBackup(
    file: File,
    password?: string
): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    try {
        const content = await file.text();
        let backup: BackupData;
        
        // Check if encrypted
        try {
            const parsed = JSON.parse(content);
            
            if (parsed.encrypted && parsed.format === BACKUP_PREFIX) {
                if (!password) {
                    return {
                        valid: false,
                        encrypted: true,
                        errors: ['Backup is encrypted. Please provide a password.'],
                        warnings: []
                    };
                }
                
                try {
                    const decrypted = await decryptData(parsed.data, password);
                    backup = JSON.parse(decrypted);
                } catch {
                    return {
                        valid: false,
                        encrypted: true,
                        errors: ['Failed to decrypt backup. Check your password.'],
                        warnings: []
                    };
                }
            } else {
                backup = parsed;
            }
        } catch {
            return {
                valid: false,
                errors: ['Invalid JSON format'],
                warnings: []
            };
        }
        
        // Validate schema
        const schemaResult = backupDataSchema.safeParse(backup);
        if (!schemaResult.success) {
            errors.push('Invalid backup structure');
            for (const issue of schemaResult.error.issues) {
                errors.push(`${issue.path.join('.')}: ${issue.message}`);
            }
            return { valid: false, errors, warnings };
        }
        
        // Check version compatibility
        if (backup.metadata.version > CURRENT_BACKUP_VERSION) {
            warnings.push(`Backup version (${backup.metadata.version}) is newer than app version (${CURRENT_BACKUP_VERSION}). Some data may not be fully supported.`);
        }
        
        if (backup.metadata.schemaVersion > CURRENT_SCHEMA_VERSION) {
            warnings.push(`Schema version (${backup.metadata.schemaVersion}) is newer than current (${CURRENT_SCHEMA_VERSION}). Database migration may be needed.`);
        }
        
        // Verify checksum
        const checksumValid = await verifyChecksum(backup);
        if (!checksumValid) {
            errors.push('Checksum verification failed. Backup may be corrupted.');
        }
        
        // Check for missing tables
        const missingTables = ALL_TABLES.filter(
            t => !backup.metadata.tables.includes(t)
        );
        if (missingTables.length > 0) {
            warnings.push(`Missing tables: ${missingTables.join(', ')}. These will be empty after restore.`);
        }
        
        // Check for empty critical tables
        const criticalTables = ['products', 'suppliers', 'customers'];
        const emptyCritical = criticalTables.filter(
            t => (backup.metadata.recordCounts[t] || 0) === 0
        );
        if (emptyCritical.length > 0 && emptyCritical.length < criticalTables.length) {
            warnings.push(`Some critical tables are empty: ${emptyCritical.join(', ')}`);
        }
        
        return {
            valid: errors.length === 0,
            version: backup.metadata.version,
            schemaVersion: backup.metadata.schemaVersion,
            encrypted: backup.metadata.encrypted,
            tables: backup.metadata.tables,
            recordCounts: backup.metadata.recordCounts,
            errors,
            warnings
        };
    } catch (error) {
        return {
            valid: false,
            errors: [error instanceof Error ? error.message : 'Unknown error'],
            warnings: []
        };
    }
}

// ============ RESTORE FUNCTIONS ============

/**
 * Restore database from backup file
 */
export async function restoreBackup(
    file: File,
    options: {
        password?: string;
        clearExisting?: boolean;
        onProgress?: (progress: BackupProgress) => void;
    } = {}
): Promise<RestoreResult> {
    if (!browser || !db) {
        return { success: false, error: 'Restore only available in browser' };
    }
    
    const { password, clearExisting = true, onProgress } = options;
    const warnings: string[] = [];
    
    try {
        onProgress?.({ stage: 'Reading file', percent: 5 });
        
        const content = await file.text();
        let backup: BackupData;
        
        // Parse and decrypt if needed
        onProgress?.({ stage: 'Parsing backup', percent: 10 });
        
        try {
            const parsed = JSON.parse(content);
            
            if (parsed.encrypted && parsed.format === BACKUP_PREFIX) {
                if (!password) {
                    return { success: false, error: 'Backup is encrypted. Password required.' };
                }
                
                onProgress?.({ stage: 'Decrypting', percent: 15 });
                
                try {
                    const decrypted = await decryptData(parsed.data, password);
                    backup = JSON.parse(decrypted);
                } catch {
                    return { success: false, error: 'Decryption failed. Check your password.' };
                }
            } else {
                backup = parsed;
            }
        } catch {
            return { success: false, error: 'Invalid backup file format' };
        }
        
        // Validate
        onProgress?.({ stage: 'Validating', percent: 20 });
        
        const validation = await validateBackup(file, password);
        if (!validation.valid) {
            return { 
                success: false, 
                error: validation.errors.join('; '),
                warnings: validation.warnings
            };
        }
        warnings.push(...validation.warnings);
        
        // Handle legacy backup formats (version 1-3 from old backup function)
        if (!backup.metadata && (backup as Record<string, unknown>).version) {
            backup = convertLegacyBackup(backup as unknown as Record<string, unknown>);
        }
        
        // Verify checksum
        onProgress?.({ stage: 'Verifying integrity', percent: 25 });
        
        const checksumValid = await verifyChecksum(backup);
        if (!checksumValid) {
            warnings.push('Checksum mismatch - backup may have been modified');
        }
        
        // Start restore transaction
        onProgress?.({ stage: 'Preparing database', percent: 30 });
        
        const tablesRestored: string[] = [];
        let totalRecordsRestored = 0;
        
        // Get all table names that exist in the backup
        const tablesToRestore = Object.keys(backup.data).filter(
            t => Array.isArray(backup.data[t as keyof typeof backup.data])
        );
        
        await db.transaction('rw', db.tables, async () => {
            // Clear existing data if requested
            if (clearExisting) {
                onProgress?.({ stage: 'Clearing existing data', percent: 35 });
                
                for (const tableName of ALL_TABLES) {
                    try {
                        const table = (db as Record<string, { clear: () => Promise<void> }>)[tableName];
                        if (table && typeof table.clear === 'function') {
                            await table.clear();
                        }
                    } catch {
                        // Table might not exist
                    }
                }
            }
            
            // Restore each table
            for (let i = 0; i < tablesToRestore.length; i++) {
                const tableName = tablesToRestore[i];
                const records = backup.data[tableName as keyof typeof backup.data];
                
                onProgress?.({
                    stage: 'Restoring data',
                    percent: 40 + Math.round((i / tablesToRestore.length) * 55),
                    currentTable: tableName
                });
                
                if (!Array.isArray(records) || records.length === 0) {
                    continue;
                }
                
                try {
                    const table = (db as Record<string, { bulkAdd: (data: unknown[]) => Promise<unknown> }>)[tableName];
                    if (table && typeof table.bulkAdd === 'function') {
                        // Process records for date fields
                        const processedRecords = records.map(r => processRecordDates(r as Record<string, unknown>));
                        await table.bulkAdd(processedRecords);
                        tablesRestored.push(tableName);
                        totalRecordsRestored += processedRecords.length;
                    }
                } catch (tableError) {
                    console.warn(`Failed to restore table ${tableName}:`, tableError);
                    warnings.push(`Failed to restore ${tableName}: ${tableError instanceof Error ? tableError.message : 'Unknown error'}`);
                }
            }
        });
        
        // Reinitialize defaults if users/roles were cleared
        onProgress?.({ stage: 'Finalizing', percent: 98 });
        await db.initializeDefaults();
        
        onProgress?.({ stage: 'Complete', percent: 100 });
        
        return {
            success: true,
            recordsRestored: totalRecordsRestored,
            tablesRestored,
            warnings: warnings.length > 0 ? warnings : undefined
        };
    } catch (error) {
        console.error('Restore failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            warnings: warnings.length > 0 ? warnings : undefined
        };
    }
}

/**
 * Convert date strings back to Date objects for specific fields
 */
function processRecordDates(record: Record<string, unknown>): Record<string, unknown> {
    const dateFields = ['createdAt', 'updatedAt', 'openedAt', 'closedAt', 'lastLogin', 'lastUsed', 'expiresAt', 'lastUpdated'];
    const result = { ...record };
    
    for (const field of dateFields) {
        if (result[field] && typeof result[field] === 'string') {
            try {
                result[field] = new Date(result[field] as string);
            } catch {
                // Leave as string if parsing fails
            }
        }
    }
    
    return result;
}

/**
 * Convert legacy backup format (version 1-3) to current format
 */
function convertLegacyBackup(legacy: Record<string, unknown>): BackupData {
    const recordCounts: Record<string, number> = {};
    const tables: string[] = [];
    const data: Record<string, unknown[]> = {};
    
    // Map old table names and structure
    const tableMapping: Record<string, string> = {
        invoices: 'invoices',
        suppliers: 'suppliers',
        globalContext: 'globalContext',
        rules: 'rules',
        kbRules: 'rules', // Legacy name
        products: 'products',
        bankAccounts: 'bankAccounts',
        payments: 'payments',
        customers: 'customers',
        sales: 'sales',
        shifts: 'shifts',
        returns: 'returns',
        users: 'users',
        roles: 'roles'
    };
    
    for (const [oldName, newName] of Object.entries(tableMapping)) {
        if (Array.isArray(legacy[oldName])) {
            data[newName] = legacy[oldName] as unknown[];
            recordCounts[newName] = (legacy[oldName] as unknown[]).length;
            if (!tables.includes(newName)) {
                tables.push(newName);
            }
        }
    }
    
    // Fill missing tables with empty arrays
    for (const table of ALL_TABLES) {
        if (!data[table]) {
            data[table] = [];
            recordCounts[table] = 0;
        }
        if (!tables.includes(table)) {
            tables.push(table);
        }
    }
    
    return {
        metadata: {
            version: 1,
            schemaVersion: typeof legacy.version === 'number' ? legacy.version : 1,
            appVersion: 'legacy',
            createdAt: typeof legacy.timestamp === 'string' ? legacy.timestamp : new Date().toISOString(),
            deviceInfo: {
                userAgent: 'legacy',
                language: 'unknown',
                platform: 'unknown'
            },
            checksum: '', // Legacy backups don't have checksums
            encrypted: false,
            tables,
            recordCounts
        },
        data: data as BackupData['data']
    };
}

// ============ AUTO-BACKUP FUNCTIONS ============

/**
 * Auto-backup storage key
 */
const AUTO_BACKUP_KEY = 'minimarket_auto_backup';
const AUTO_BACKUP_TIMESTAMP_KEY = 'minimarket_auto_backup_timestamp';

/**
 * Create an auto-backup to localStorage (for disaster recovery)
 * Limited to critical tables only due to localStorage size limits
 */
export async function createAutoBackup(): Promise<boolean> {
    if (!browser || !db) return false;
    
    try {
        // Only backup critical tables to stay within localStorage limits
        const criticalTables = ['products', 'suppliers', 'customers', 'users', 'roles', 'bankAccounts'];
        const data: Record<string, unknown[]> = {};
        
        for (const tableName of criticalTables) {
            const table = (db as Record<string, { toArray: () => Promise<unknown[]> }>)[tableName];
            if (table && typeof table.toArray === 'function') {
                data[tableName] = await table.toArray();
            }
        }
        
        const backup = {
            timestamp: new Date().toISOString(),
            data
        };
        
        const backupString = JSON.stringify(backup);
        
        // Check size (localStorage typically has ~5MB limit)
        if (backupString.length > 4 * 1024 * 1024) {
            console.warn('Auto-backup too large for localStorage');
            return false;
        }
        
        localStorage.setItem(AUTO_BACKUP_KEY, backupString);
        localStorage.setItem(AUTO_BACKUP_TIMESTAMP_KEY, backup.timestamp);
        
        return true;
    } catch (error) {
        console.error('Auto-backup failed:', error);
        return false;
    }
}

/**
 * Get auto-backup info
 */
export function getAutoBackupInfo(): { timestamp: string; size: number } | null {
    if (!browser) return null;
    
    try {
        const timestamp = localStorage.getItem(AUTO_BACKUP_TIMESTAMP_KEY);
        const backup = localStorage.getItem(AUTO_BACKUP_KEY);
        
        if (timestamp && backup) {
            return {
                timestamp,
                size: backup.length
            };
        }
        return null;
    } catch {
        return null;
    }
}

/**
 * Restore from auto-backup
 */
export async function restoreAutoBackup(): Promise<RestoreResult> {
    if (!browser || !db) {
        return { success: false, error: 'Restore only available in browser' };
    }
    
    try {
        const backupString = localStorage.getItem(AUTO_BACKUP_KEY);
        if (!backupString) {
            return { success: false, error: 'No auto-backup found' };
        }
        
        const backup = JSON.parse(backupString);
        const tablesRestored: string[] = [];
        let totalRecords = 0;
        
        await db.transaction('rw', db.tables, async () => {
            for (const [tableName, records] of Object.entries(backup.data)) {
                if (!Array.isArray(records) || records.length === 0) continue;
                
                try {
                    const table = (db as Record<string, { clear: () => Promise<void>; bulkAdd: (data: unknown[]) => Promise<unknown> }>)[tableName];
                    if (table) {
                        await table.clear();
                        const processedRecords = records.map(r => processRecordDates(r as Record<string, unknown>));
                        await table.bulkAdd(processedRecords);
                        tablesRestored.push(tableName);
                        totalRecords += processedRecords.length;
                    }
                } catch (e) {
                    console.warn(`Failed to restore ${tableName}:`, e);
                }
            }
        });
        
        return {
            success: true,
            recordsRestored: totalRecords,
            tablesRestored
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Clear auto-backup
 */
export function clearAutoBackup(): void {
    if (!browser) return;
    localStorage.removeItem(AUTO_BACKUP_KEY);
    localStorage.removeItem(AUTO_BACKUP_TIMESTAMP_KEY);
}

// ============ SCHEDULED BACKUP ============

let backupInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start scheduled auto-backups (every 4 hours by default)
 */
export function startScheduledBackups(intervalHours = 4): void {
    if (!browser) return;
    
    // Stop any existing schedule
    stopScheduledBackups();
    
    // Create immediate backup
    createAutoBackup();
    
    // Schedule periodic backups
    backupInterval = setInterval(() => {
        createAutoBackup();
    }, intervalHours * 60 * 60 * 1000);
}

/**
 * Stop scheduled backups
 */
export function stopScheduledBackups(): void {
    if (backupInterval) {
        clearInterval(backupInterval);
        backupInterval = null;
    }
}

// ============ EXPORT UTILITIES ============

/**
 * Export specific tables only
 */
export async function exportTables(
    tableNames: string[],
    options: {
        password?: string;
        filename?: string;
    } = {}
): Promise<BackupResult> {
    if (!browser || !db) {
        return { success: false, error: 'Export only available in browser' };
    }
    
    try {
        const data: Record<string, unknown[]> = {};
        const recordCounts: Record<string, number> = {};
        let totalRecords = 0;
        
        for (const tableName of tableNames) {
            const table = (db as Record<string, { toArray: () => Promise<unknown[]> }>)[tableName];
            if (table && typeof table.toArray === 'function') {
                const records = await table.toArray();
                data[tableName] = records;
                recordCounts[tableName] = records.length;
                totalRecords += records.length;
            }
        }
        
        const checksum = await calculateChecksum(JSON.stringify(data));
        
        const backup: BackupData = {
            metadata: {
                version: CURRENT_BACKUP_VERSION,
                schemaVersion: CURRENT_SCHEMA_VERSION,
                appVersion: APP_VERSION,
                createdAt: new Date().toISOString(),
                deviceInfo: {
                    userAgent: navigator.userAgent,
                    language: navigator.language,
                    platform: navigator.platform
                },
                checksum,
                encrypted: !!options.password,
                tables: tableNames,
                recordCounts
            },
            data: data as BackupData['data']
        };
        
        let backupContent = JSON.stringify(backup, null, 2);
        
        if (options.password) {
            const encryptedData = await encryptData(backupContent, options.password);
            backupContent = JSON.stringify({
                format: BACKUP_PREFIX,
                version: CURRENT_BACKUP_VERSION,
                encrypted: true,
                data: encryptedData
            });
        }
        
        const blob = new Blob([backupContent], { type: 'application/json' });
        const filename = options.filename || `minimarket_export_${tableNames.join('-')}_${new Date().toISOString().split('T')[0]}.json`;
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        return {
            success: true,
            filename,
            size: blob.size,
            recordCount: totalRecords
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Import data from file (merges with existing data)
 */
export async function importData(
    file: File,
    options: {
        password?: string;
        tablesToImport?: string[];
        skipDuplicates?: boolean;
    } = {}
): Promise<RestoreResult> {
    if (!browser || !db) {
        return { success: false, error: 'Import only available in browser' };
    }
    
    try {
        const content = await file.text();
        let backup: BackupData;
        
        const parsed = JSON.parse(content);
        
        if (parsed.encrypted && parsed.format === BACKUP_PREFIX) {
            if (!options.password) {
                return { success: false, error: 'File is encrypted. Password required.' };
            }
            const decrypted = await decryptData(parsed.data, options.password);
            backup = JSON.parse(decrypted);
        } else if (parsed.metadata) {
            backup = parsed;
        } else {
            // Legacy format
            backup = convertLegacyBackup(parsed);
        }
        
        const tablesToImport = options.tablesToImport || Object.keys(backup.data);
        const tablesRestored: string[] = [];
        let totalRecords = 0;
        const warnings: string[] = [];
        
        for (const tableName of tablesToImport) {
            const records = backup.data[tableName as keyof typeof backup.data];
            if (!Array.isArray(records) || records.length === 0) continue;
            
            try {
                const table = (db as Record<string, { add: (data: unknown) => Promise<unknown>; bulkAdd: (data: unknown[]) => Promise<unknown> }>)[tableName];
                if (!table) continue;
                
                const processedRecords = records.map(r => {
                    const processed = processRecordDates(r as Record<string, unknown>);
                    // Remove ID to let IndexedDB auto-generate
                    delete processed.id;
                    return processed;
                });
                
                if (options.skipDuplicates) {
                    let added = 0;
                    for (const record of processedRecords) {
                        try {
                            await table.add(record);
                            added++;
                        } catch {
                            // Skip duplicates
                        }
                    }
                    totalRecords += added;
                } else {
                    await table.bulkAdd(processedRecords);
                    totalRecords += processedRecords.length;
                }
                
                tablesRestored.push(tableName);
            } catch (e) {
                warnings.push(`Failed to import ${tableName}: ${e instanceof Error ? e.message : 'Unknown error'}`);
            }
        }
        
        return {
            success: true,
            recordsRestored: totalRecords,
            tablesRestored,
            warnings: warnings.length > 0 ? warnings : undefined
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

