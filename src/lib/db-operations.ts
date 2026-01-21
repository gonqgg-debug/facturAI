/**
 * Database Operations Module
 * 
 * Wrapper functions for database operations that automatically track
 * changes for Supabase sync. 
 * 
 * NOTE: With auto-tracking hooks in db.ts, direct db.table.add/put/delete 
 * calls are now automatically tracked. These wrapper functions remain for 
 * backward compatibility and explicit usage, but are no longer strictly required.
 */

import { db, generateId, setTrackingFromWrapper, type PendingChangeRecord } from './db';
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
// CHANGE TRACKING (Now handled by hooks in db.ts)
// ============================================================
// The trackChange function is now exported from db.ts and called
// automatically by Dexie hooks. These wrapper functions set a flag
// to prevent double-tracking when both wrapper and hooks would fire.

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
// Note: trackChange is now automatic via Dexie hooks

export async function saveSupplier(supplier: Supplier): Promise<string> {
    if (!db) throw new Error('Database not initialized');
    const record = ensureId(supplier);
    await db.suppliers.put(record);
    return record.id;
}

export async function deleteSupplier(id: string): Promise<void> {
    if (!db) throw new Error('Database not initialized');
    await db.suppliers.delete(id);
}

// ============================================================
// PRODUCT OPERATIONS
// ============================================================

export async function saveProduct(product: Product): Promise<string> {
    if (!db) throw new Error('Database not initialized');
    const record = ensureId(product);
    await db.products.put(record);
    return record.id;
}

export async function deleteProduct(id: string): Promise<void> {
    if (!db) throw new Error('Database not initialized');
    await db.products.delete(id);
}

// ============================================================
// CUSTOMER OPERATIONS
// ============================================================

export async function saveCustomer(customer: Customer): Promise<string> {
    if (!db) throw new Error('Database not initialized');
    const record = ensureId(customer);
    await db.customers.put(record);
    return record.id;
}

export async function deleteCustomer(id: string): Promise<void> {
    if (!db) throw new Error('Database not initialized');
    await db.customers.delete(id);
}

// ============================================================
// INVOICE OPERATIONS
// ============================================================

export async function saveInvoice(invoice: Invoice): Promise<string> {
    if (!db) throw new Error('Database not initialized');
    const record = ensureId(invoice);
    await db.invoices.put(record);
    return record.id;
}

export async function deleteInvoice(id: string): Promise<void> {
    if (!db) throw new Error('Database not initialized');
    await db.invoices.delete(id);
}

// ============================================================
// SALE OPERATIONS
// ============================================================

export async function saveSale(sale: Sale): Promise<string> {
    if (!db) throw new Error('Database not initialized');
    const record = ensureId(sale);
    await db.sales.put(record);
    return record.id;
}

export async function deleteSale(id: string): Promise<void> {
    if (!db) throw new Error('Database not initialized');
    await db.sales.delete(id);
}

// ============================================================
// PAYMENT OPERATIONS
// ============================================================

export async function savePayment(payment: Payment): Promise<string> {
    if (!db) throw new Error('Database not initialized');
    const record = ensureId(payment);
    await db.payments.put(record);
    return record.id;
}

export async function deletePayment(id: string): Promise<void> {
    if (!db) throw new Error('Database not initialized');
    await db.payments.delete(id);
}

// ============================================================
// RETURN OPERATIONS
// ============================================================

export async function saveReturn(returnRecord: Return): Promise<string> {
    if (!db) throw new Error('Database not initialized');
    const record = ensureId(returnRecord);
    await db.returns.put(record);
    return record.id;
}

export async function deleteReturn(id: string): Promise<void> {
    if (!db) throw new Error('Database not initialized');
    await db.returns.delete(id);
}

// ============================================================
// BANK ACCOUNT OPERATIONS
// ============================================================

export async function saveBankAccount(account: BankAccount): Promise<string> {
    if (!db) throw new Error('Database not initialized');
    const record = ensureId(account);
    await db.bankAccounts.put(record);
    return record.id;
}

export async function deleteBankAccount(id: string): Promise<void> {
    if (!db) throw new Error('Database not initialized');
    await db.bankAccounts.delete(id);
}

// ============================================================
// STOCK MOVEMENT OPERATIONS
// ============================================================

export async function saveStockMovement(movement: StockMovement): Promise<string> {
    if (!db) throw new Error('Database not initialized');
    const record = ensureId(movement);
    await db.stockMovements.put(record);
    return record.id;
}

export async function deleteStockMovement(id: string): Promise<void> {
    if (!db) throw new Error('Database not initialized');
    await db.stockMovements.delete(id);
}

// ============================================================
// PURCHASE ORDER OPERATIONS
// ============================================================

export async function savePurchaseOrder(po: PurchaseOrder): Promise<string> {
    if (!db) throw new Error('Database not initialized');
    const record = ensureId(po);
    await db.purchaseOrders.put(record);
    return record.id;
}

export async function deletePurchaseOrder(id: string): Promise<void> {
    if (!db) throw new Error('Database not initialized');
    await db.purchaseOrders.delete(id);
}

// ============================================================
// RECEIPT OPERATIONS
// ============================================================

export async function saveReceipt(receipt: Receipt): Promise<string> {
    if (!db) throw new Error('Database not initialized');
    const record = ensureId(receipt);
    await db.receipts.put(record);
    return record.id;
}

export async function deleteReceipt(id: string): Promise<void> {
    if (!db) throw new Error('Database not initialized');
    await db.receipts.delete(id);
}

// ============================================================
// KNOWLEDGE BASE RULE OPERATIONS
// ============================================================

export async function saveRule(rule: KnowledgeBaseRule): Promise<string> {
    if (!db) throw new Error('Database not initialized');
    const record = ensureId(rule);
    await db.rules.put(record);
    return record.id;
}

export async function deleteRule(id: string): Promise<void> {
    if (!db) throw new Error('Database not initialized');
    await db.rules.delete(id);
}

// ============================================================
// GLOBAL CONTEXT OPERATIONS
// ============================================================

export async function saveGlobalContext(context: GlobalContextItem): Promise<string> {
    if (!db) throw new Error('Database not initialized');
    const record = ensureId(context);
    await db.globalContext.put(record);
    return record.id;
}

export async function deleteGlobalContext(id: string): Promise<void> {
    if (!db) throw new Error('Database not initialized');
    await db.globalContext.delete(id);
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

