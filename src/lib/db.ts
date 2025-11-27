import Dexie, { type Table } from 'dexie';
import { browser } from '$app/environment';
import type { Invoice, Supplier, KnowledgeBaseRule, GlobalContextItem, Product, StockMovement, BankAccount, Payment, Customer, Sale, CashRegisterShift, Return, User, Role } from './types';
import type { CustomerSegment, TransactionFeatures, RealTimeInsight } from './customer-insights/types';
import type { WeatherRecord } from './weather';

export class MinimarketDatabase extends Dexie {
    invoices!: Table<Invoice>;
    suppliers!: Table<Supplier>;
    rules!: Table<KnowledgeBaseRule>;
    globalContext!: Table<GlobalContextItem>;
    products!: Table<Product>;
    stockMovements!: Table<StockMovement>;
    bankAccounts!: Table<BankAccount>;
    payments!: Table<Payment>;
    customers!: Table<Customer>;
    sales!: Table<Sale>;
    shifts!: Table<CashRegisterShift>;
    returns!: Table<Return>;
    users!: Table<User>;
    roles!: Table<Role>;
    customerSegments!: Table<CustomerSegment>;
    transactionFeatures!: Table<TransactionFeatures>;
    realTimeInsights!: Table<RealTimeInsight>;
    weatherRecords!: Table<WeatherRecord>;

    constructor() {
        super('Jardines3MinimarketDB');
        
        // Version 10: Added cash register shifts for turn management (cortes de caja)
        this.version(10).stores({
            invoices: '++id, providerName, issueDate, ncf, status, paymentStatus, dueDate, [issueDate+providerName]',
            suppliers: '++id, name, rnc, isActive, category',
            rules: '++id, supplierId',
            globalContext: '++id, title, type, category',
            products: '++id, supplierId, name, category, barcode, productId, [supplierId+name]',
            stockMovements: '++id, productId, type, date, invoiceId, saleId',
            bankAccounts: '++id, bankName, isDefault, isActive',
            payments: '++id, invoiceId, saleId, supplierId, customerId, paymentDate, paymentMethod, bankAccountId',
            customers: '++id, name, type, isActive, rnc',
            sales: '++id, date, customerId, paymentStatus, shiftId, receiptNumber',
            shifts: '++id, shiftNumber, status, openedAt, closedAt'
        });
        
        // Version 11: Added returns, users, and roles for multi-user POS with returns capability
        this.version(11).stores({
            invoices: '++id, providerName, issueDate, ncf, status, paymentStatus, dueDate, [issueDate+providerName]',
            suppliers: '++id, name, rnc, isActive, category',
            rules: '++id, supplierId',
            globalContext: '++id, title, type, category',
            products: '++id, supplierId, name, category, barcode, productId, [supplierId+name]',
            stockMovements: '++id, productId, type, date, invoiceId, saleId, returnId',
            bankAccounts: '++id, bankName, isDefault, isActive',
            payments: '++id, invoiceId, saleId, returnId, supplierId, customerId, paymentDate, paymentMethod, bankAccountId',
            customers: '++id, name, type, isActive, rnc',
            sales: '++id, date, customerId, paymentStatus, shiftId, receiptNumber, cashierId, hasReturns',
            shifts: '++id, shiftNumber, status, openedAt, closedAt, cashierId',
            returns: '++id, date, originalSaleId, originalReceiptNumber, customerId, shiftId, processedBy, refundStatus',
            users: '++id, username, roleId, isActive, &pin',
            roles: '++id, name, isSystem'
        });
        
        // Version 12: Added customer insights tables for AI-powered analytics
        this.version(12).stores({
            invoices: '++id, providerName, issueDate, ncf, status, paymentStatus, dueDate, [issueDate+providerName]',
            suppliers: '++id, name, rnc, isActive, category',
            rules: '++id, supplierId',
            globalContext: '++id, title, type, category',
            products: '++id, supplierId, name, category, barcode, productId, [supplierId+name]',
            stockMovements: '++id, productId, type, date, invoiceId, saleId, returnId',
            bankAccounts: '++id, bankName, isDefault, isActive',
            payments: '++id, invoiceId, saleId, returnId, supplierId, customerId, paymentDate, paymentMethod, bankAccountId',
            customers: '++id, name, type, isActive, rnc',
            sales: '++id, date, customerId, paymentStatus, shiftId, receiptNumber, cashierId, hasReturns',
            shifts: '++id, shiftNumber, status, openedAt, closedAt, cashierId',
            returns: '++id, date, originalSaleId, originalReceiptNumber, customerId, shiftId, processedBy, refundStatus',
            users: '++id, username, roleId, isActive, &pin',
            roles: '++id, name, isSystem',
            customerSegments: '++id, segmentId, segmentName, segmentType, confidenceScore, lastUpdated',
            transactionFeatures: '++id, timestamp, hourOfDay, dayOfWeek, totalValue, shiftId',
            realTimeInsights: '++id, insightType, expiresAt, createdAt'
        });
        
        // Version 13: Added weather records for weather-based insights
        this.version(13).stores({
            invoices: '++id, providerName, issueDate, ncf, status, paymentStatus, dueDate, [issueDate+providerName]',
            suppliers: '++id, name, rnc, isActive, category',
            rules: '++id, supplierId',
            globalContext: '++id, title, type, category',
            products: '++id, supplierId, name, category, barcode, productId, [supplierId+name]',
            stockMovements: '++id, productId, type, date, invoiceId, saleId, returnId',
            bankAccounts: '++id, bankName, isDefault, isActive',
            payments: '++id, invoiceId, saleId, returnId, supplierId, customerId, paymentDate, paymentMethod, bankAccountId',
            customers: '++id, name, type, isActive, rnc',
            sales: '++id, date, customerId, paymentStatus, shiftId, receiptNumber, cashierId, hasReturns',
            shifts: '++id, shiftNumber, status, openedAt, closedAt, cashierId',
            returns: '++id, date, originalSaleId, originalReceiptNumber, customerId, shiftId, processedBy, refundStatus',
            users: '++id, username, roleId, isActive, &pin',
            roles: '++id, name, isSystem',
            customerSegments: '++id, segmentId, segmentName, segmentType, confidenceScore, lastUpdated',
            transactionFeatures: '++id, timestamp, hourOfDay, dayOfWeek, totalValue, shiftId',
            realTimeInsights: '++id, insightType, expiresAt, createdAt',
            weatherRecords: '++id, date, condition, precipitationLevel, location'
        });
    }
    
    // Initialize default roles and admin user if needed
    async initializeDefaults() {
        const rolesCount = await this.roles.count();
        if (rolesCount === 0) {
            // Import DEFAULT_ROLES dynamically to avoid circular dependency
            const { DEFAULT_ROLES } = await import('./types');
            
            // Add default roles
            for (const role of DEFAULT_ROLES) {
                await this.roles.add({
                    ...role,
                    createdAt: new Date()
                });
            }
            
            // Create default admin user with PIN 2024
            const adminRole = await this.roles.where('name').equals('Administrador').first();
            if (adminRole?.id) {
                await this.users.add({
                    username: 'admin',
                    displayName: 'Administrador',
                    pin: '2024',
                    roleId: adminRole.id,
                    roleName: adminRole.name,
                    isActive: true,
                    createdAt: new Date()
                });
            }
        }
    }
}

// Only create the database instance in the browser
export const db = browser ? new MinimarketDatabase() : (null as unknown as MinimarketDatabase);

// Ensure database is open and ready (only in browser)
if (browser && db) {
    db.open()
        .then(() => {
            // Initialize default roles and admin user
            return db.initializeDefaults();
        })
        .catch(err => {
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
