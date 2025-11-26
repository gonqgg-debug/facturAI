import Dexie, { type Table } from 'dexie';
import { browser } from '$app/environment';
import type { Invoice, Supplier, KnowledgeBaseRule, GlobalContextItem, Product, StockMovement, BankAccount, Payment } from './types';

export class MinimarketDatabase extends Dexie {
    invoices!: Table<Invoice>;
    suppliers!: Table<Supplier>;
    rules!: Table<KnowledgeBaseRule>;
    globalContext!: Table<GlobalContextItem>;
    products!: Table<Product>;
    stockMovements!: Table<StockMovement>;
    bankAccounts!: Table<BankAccount>;
    payments!: Table<Payment>;

    constructor() {
        super('Jardines3MinimarketDB');
        
        // Version 8: Added bank accounts and payments tables for complete payment tracking
        this.version(8).stores({
            invoices: '++id, providerName, issueDate, ncf, status, paymentStatus, dueDate, [issueDate+providerName]',
            suppliers: '++id, name, rnc, isActive, category',
            rules: '++id, supplierId',
            globalContext: '++id, title, type, category',
            products: '++id, supplierId, name, category, barcode, productId, [supplierId+name]',
            stockMovements: '++id, productId, type, date, invoiceId',
            bankAccounts: '++id, bankName, isDefault, isActive',
            payments: '++id, invoiceId, supplierId, paymentDate, paymentMethod, bankAccountId'
        });
    }
}

// Only create the database instance in the browser
export const db = browser ? new MinimarketDatabase() : (null as unknown as MinimarketDatabase);

// Ensure database is open and ready (only in browser)
if (browser && db) {
    db.open().catch(err => {
        console.error('Failed to open database:', err);
        // If there's a version error, try to recover by deleting and recreating
        if (err.name === 'VersionError') {
            console.warn('Database version mismatch - attempting recovery...');
            Dexie.delete('Jardines3MinimarketDB').then(() => {
                window.location.reload();
            });
        }
    });
}
