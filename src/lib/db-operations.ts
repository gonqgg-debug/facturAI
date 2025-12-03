/**
 * Database Operations Module
 * 
 * Wrapper functions for database operations that automatically track
 * changes for Supabase sync. Use these instead of direct db.table.put()
 * calls to ensure changes are synced across devices.
 */

import { browser } from '$app/environment';
import { db, generateId, type PendingChangeRecord } from './db';
import { SYNCED_TABLES } from './supabase';
import { setPendingChanges } from './sync-store';
import type { 
    Invoice, 
    Supplier, 
    Product, 
    Customer, 
    Sale, 
    Payment, 
    Return,
    BankAccount,
    StockMovement,
    PurchaseOrder,
    Receipt,
    KnowledgeBaseRule,
    GlobalContextItem
} from './types';

// ============================================================
// CHANGE TRACKING
// ============================================================

/**
 * Track a change for sync
 */
async function trackChange(
    tableName: string,
    recordId: string,
    action: 'insert' | 'update' | 'delete',
    data: Record<string, unknown>
): Promise<void> {
    console.log(`[TrackChange] Called for ${tableName} ${action} ${recordId}`);
    
    if (!browser || !db?.pendingChanges) {
        console.log('[TrackChange] Skipped - no browser or pendingChanges table');
        return;
    }
    
    // Only track synced tables
    if (!SYNCED_TABLES.includes(tableName)) {
        console.log(`[TrackChange] Skipped - ${tableName} not in SYNCED_TABLES`);
        return;
    }
    
    const change: Omit<PendingChangeRecord, 'id'> = {
        tableName,
        recordId,
        action,
        data,
        timestamp: Date.now(),
        synced: false
    };
    
    await db.pendingChanges.add(change);
    console.log(`[TrackChange] Added pending change for ${tableName}`);
    
    // Update pending changes count
    const count = await db.pendingChanges.count();
    console.log(`[TrackChange] Total pending changes: ${count}`);
    setPendingChanges(count);
}

/**
 * Generate ID for new record if not provided
 */
function ensureId<T extends { id?: string }>(record: T): T & { id: string } {
    if (!record.id) {
        return { ...record, id: generateId() };
    }
    return record as T & { id: string };
}

// ============================================================
// SUPPLIER OPERATIONS
// ============================================================

export async function saveSupplier(supplier: Supplier): Promise<string> {
    if (!db) throw new Error('Database not initialized');
    
    const isNew = !supplier.id;
    const record = ensureId(supplier);
    
    await db.suppliers.put(record);
    await trackChange('suppliers', record.id, isNew ? 'insert' : 'update', record as unknown as Record<string, unknown>);
    
    return record.id;
}

export async function deleteSupplier(id: string): Promise<void> {
    if (!db) throw new Error('Database not initialized');
    
    const existing = await db.suppliers.get(id);
    if (existing) {
        await db.suppliers.delete(id);
        await trackChange('suppliers', id, 'delete', existing as unknown as Record<string, unknown>);
    }
}

// ============================================================
// PRODUCT OPERATIONS
// ============================================================

export async function saveProduct(product: Product): Promise<string> {
    if (!db) throw new Error('Database not initialized');
    
    const isNew = !product.id;
    const record = ensureId(product);
    
    await db.products.put(record);
    await trackChange('products', record.id, isNew ? 'insert' : 'update', record as unknown as Record<string, unknown>);
    
    return record.id;
}

export async function deleteProduct(id: string): Promise<void> {
    if (!db) throw new Error('Database not initialized');
    
    const existing = await db.products.get(id);
    if (existing) {
        await db.products.delete(id);
        await trackChange('products', id, 'delete', existing as unknown as Record<string, unknown>);
    }
}

// ============================================================
// CUSTOMER OPERATIONS
// ============================================================

export async function saveCustomer(customer: Customer): Promise<string> {
    if (!db) throw new Error('Database not initialized');
    
    const isNew = !customer.id;
    const record = ensureId(customer);
    
    await db.customers.put(record);
    await trackChange('customers', record.id, isNew ? 'insert' : 'update', record as unknown as Record<string, unknown>);
    
    return record.id;
}

export async function deleteCustomer(id: string): Promise<void> {
    if (!db) throw new Error('Database not initialized');
    
    const existing = await db.customers.get(id);
    if (existing) {
        await db.customers.delete(id);
        await trackChange('customers', id, 'delete', existing as unknown as Record<string, unknown>);
    }
}

// ============================================================
// INVOICE OPERATIONS
// ============================================================

export async function saveInvoice(invoice: Invoice): Promise<string> {
    if (!db) throw new Error('Database not initialized');
    
    const isNew = !invoice.id;
    const record = ensureId(invoice);
    
    await db.invoices.put(record);
    await trackChange('invoices', record.id, isNew ? 'insert' : 'update', record as unknown as Record<string, unknown>);
    
    return record.id;
}

export async function deleteInvoice(id: string): Promise<void> {
    if (!db) throw new Error('Database not initialized');
    
    const existing = await db.invoices.get(id);
    if (existing) {
        await db.invoices.delete(id);
        await trackChange('invoices', id, 'delete', existing as unknown as Record<string, unknown>);
    }
}

// ============================================================
// SALE OPERATIONS
// ============================================================

export async function saveSale(sale: Sale): Promise<string> {
    if (!db) throw new Error('Database not initialized');
    
    const isNew = !sale.id;
    const record = ensureId(sale);
    
    await db.sales.put(record);
    await trackChange('sales', record.id, isNew ? 'insert' : 'update', record as unknown as Record<string, unknown>);
    
    return record.id;
}

export async function deleteSale(id: string): Promise<void> {
    if (!db) throw new Error('Database not initialized');
    
    const existing = await db.sales.get(id);
    if (existing) {
        await db.sales.delete(id);
        await trackChange('sales', id, 'delete', existing as unknown as Record<string, unknown>);
    }
}

// ============================================================
// PAYMENT OPERATIONS
// ============================================================

export async function savePayment(payment: Payment): Promise<string> {
    if (!db) throw new Error('Database not initialized');
    
    const isNew = !payment.id;
    const record = ensureId(payment);
    
    await db.payments.put(record);
    await trackChange('payments', record.id, isNew ? 'insert' : 'update', record as unknown as Record<string, unknown>);
    
    return record.id;
}

export async function deletePayment(id: string): Promise<void> {
    if (!db) throw new Error('Database not initialized');
    
    const existing = await db.payments.get(id);
    if (existing) {
        await db.payments.delete(id);
        await trackChange('payments', id, 'delete', existing as unknown as Record<string, unknown>);
    }
}

// ============================================================
// RETURN OPERATIONS
// ============================================================

export async function saveReturn(returnRecord: Return): Promise<string> {
    if (!db) throw new Error('Database not initialized');
    
    const isNew = !returnRecord.id;
    const record = ensureId(returnRecord);
    
    await db.returns.put(record);
    await trackChange('returns', record.id, isNew ? 'insert' : 'update', record as unknown as Record<string, unknown>);
    
    return record.id;
}

export async function deleteReturn(id: string): Promise<void> {
    if (!db) throw new Error('Database not initialized');
    
    const existing = await db.returns.get(id);
    if (existing) {
        await db.returns.delete(id);
        await trackChange('returns', id, 'delete', existing as unknown as Record<string, unknown>);
    }
}

// ============================================================
// BANK ACCOUNT OPERATIONS
// ============================================================

export async function saveBankAccount(account: BankAccount): Promise<string> {
    if (!db) throw new Error('Database not initialized');
    
    const isNew = !account.id;
    const record = ensureId(account);
    
    await db.bankAccounts.put(record);
    await trackChange('bankAccounts', record.id, isNew ? 'insert' : 'update', record as unknown as Record<string, unknown>);
    
    return record.id;
}

export async function deleteBankAccount(id: string): Promise<void> {
    if (!db) throw new Error('Database not initialized');
    
    const existing = await db.bankAccounts.get(id);
    if (existing) {
        await db.bankAccounts.delete(id);
        await trackChange('bankAccounts', id, 'delete', existing as unknown as Record<string, unknown>);
    }
}

// ============================================================
// STOCK MOVEMENT OPERATIONS
// ============================================================

export async function saveStockMovement(movement: StockMovement): Promise<string> {
    if (!db) throw new Error('Database not initialized');
    
    const isNew = !movement.id;
    const record = ensureId(movement);
    
    await db.stockMovements.put(record);
    await trackChange('stockMovements', record.id, isNew ? 'insert' : 'update', record as unknown as Record<string, unknown>);
    
    return record.id;
}

export async function deleteStockMovement(id: string): Promise<void> {
    if (!db) throw new Error('Database not initialized');
    
    const existing = await db.stockMovements.get(id);
    if (existing) {
        await db.stockMovements.delete(id);
        await trackChange('stockMovements', id, 'delete', existing as unknown as Record<string, unknown>);
    }
}

// ============================================================
// PURCHASE ORDER OPERATIONS
// ============================================================

export async function savePurchaseOrder(po: PurchaseOrder): Promise<string> {
    if (!db) throw new Error('Database not initialized');
    
    const isNew = !po.id;
    const record = ensureId(po);
    
    await db.purchaseOrders.put(record);
    await trackChange('purchaseOrders', record.id, isNew ? 'insert' : 'update', record as unknown as Record<string, unknown>);
    
    return record.id;
}

export async function deletePurchaseOrder(id: string): Promise<void> {
    if (!db) throw new Error('Database not initialized');
    
    const existing = await db.purchaseOrders.get(id);
    if (existing) {
        await db.purchaseOrders.delete(id);
        await trackChange('purchaseOrders', id, 'delete', existing as unknown as Record<string, unknown>);
    }
}

// ============================================================
// RECEIPT OPERATIONS
// ============================================================

export async function saveReceipt(receipt: Receipt): Promise<string> {
    if (!db) throw new Error('Database not initialized');
    
    const isNew = !receipt.id;
    const record = ensureId(receipt);
    
    await db.receipts.put(record);
    await trackChange('receipts', record.id, isNew ? 'insert' : 'update', record as unknown as Record<string, unknown>);
    
    return record.id;
}

export async function deleteReceipt(id: string): Promise<void> {
    if (!db) throw new Error('Database not initialized');
    
    const existing = await db.receipts.get(id);
    if (existing) {
        await db.receipts.delete(id);
        await trackChange('receipts', id, 'delete', existing as unknown as Record<string, unknown>);
    }
}

// ============================================================
// KNOWLEDGE BASE RULE OPERATIONS
// ============================================================

export async function saveRule(rule: KnowledgeBaseRule): Promise<string> {
    if (!db) throw new Error('Database not initialized');
    
    const isNew = !rule.id;
    const record = ensureId(rule);
    
    await db.rules.put(record);
    await trackChange('rules', record.id, isNew ? 'insert' : 'update', record as unknown as Record<string, unknown>);
    
    return record.id;
}

export async function deleteRule(id: string): Promise<void> {
    if (!db) throw new Error('Database not initialized');
    
    const existing = await db.rules.get(id);
    if (existing) {
        await db.rules.delete(id);
        await trackChange('rules', id, 'delete', existing as unknown as Record<string, unknown>);
    }
}

// ============================================================
// GLOBAL CONTEXT OPERATIONS
// ============================================================

export async function saveGlobalContext(context: GlobalContextItem): Promise<string> {
    if (!db) throw new Error('Database not initialized');
    
    const isNew = !context.id;
    const record = ensureId(context);
    
    await db.globalContext.put(record);
    await trackChange('globalContext', record.id, isNew ? 'insert' : 'update', record as unknown as Record<string, unknown>);
    
    return record.id;
}

export async function deleteGlobalContext(id: string): Promise<void> {
    if (!db) throw new Error('Database not initialized');
    
    const existing = await db.globalContext.get(id);
    if (existing) {
        await db.globalContext.delete(id);
        await trackChange('globalContext', id, 'delete', existing as unknown as Record<string, unknown>);
    }
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Get count of pending changes
 */
export async function getPendingChangesCount(): Promise<number> {
    if (!db?.pendingChanges) return 0;
    return db.pendingChanges.count();
}

/**
 * Clear all pending changes (use after successful sync or for reset)
 */
export async function clearPendingChanges(): Promise<void> {
    if (!db?.pendingChanges) return;
    await db.pendingChanges.clear();
    setPendingChanges(0);
}

/**
 * Get all pending changes
 */
export async function getPendingChanges(): Promise<PendingChangeRecord[]> {
    if (!db?.pendingChanges) return [];
    return db.pendingChanges.toArray();
}

