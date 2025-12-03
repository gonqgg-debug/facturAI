/**
 * Test Data Seeder with Backup/Restore
 * 
 * Features:
 * - Backup real data before seeding test data
 * - Restore real data after testing
 * - Download backup as JSON file
 * - Generates realistic 3-month sample data (from 3 months ago to today)
 */

import { db, dbReady, generateId } from './db';
import type { Supplier, Product, Customer, Sale, Invoice, InvoiceItem, CashRegisterShift, Payment, StockMovement, PurchaseOrder, PurchaseOrderItem } from './types';

// ============ UUID GENERATOR ============
// Generate a UUID for Dexie Cloud @id fields
// Note: When using Dexie Cloud's @id schema, the ID is auto-generated.
// We only use this for local-only tables that still use manual IDs.
function generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// ============ DEXIE CLOUD COMPATIBILITY ============
// With Dexie Cloud's @id schema, IDs are auto-generated.
// We need to add records without id and get the generated id back.

// ============ BACKUP KEY ============
const BACKUP_KEY = 'minimarket_real_data_backup';
const TEST_MODE_KEY = 'minimarket_test_mode';

// ============ CONFIGURATION ============
// Generate data from 3 months ago to today (so it shows up in recent filters)
const now = new Date();
const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

const CONFIG = {
    startDate: threeMonthsAgo,
    endDate: today,
    avgSalesPerDay: 25,
    numProducts: 80,
    numSuppliers: 12,
    numCustomers: 25,
};

// ============ STATUS FUNCTIONS ============

/**
 * Check if currently in test data mode
 */
export function isTestMode(): boolean {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(TEST_MODE_KEY) === 'true';
}

/**
 * Check if there's a backup available to restore
 */
export function hasBackup(): boolean {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(BACKUP_KEY) !== null;
}

/**
 * Get backup info (date, size)
 */
export function getBackupInfo(): { date: string; tables: string[] } | null {
    if (typeof window === 'undefined') return null;
    const backup = localStorage.getItem(BACKUP_KEY);
    if (!backup) return null;
    
    try {
        const data = JSON.parse(backup);
        return {
            date: data.backupDate,
            tables: Object.keys(data.data || {}),
        };
    } catch {
        return null;
    }
}

// ============ BACKUP FUNCTIONS ============

interface BackupData {
    backupDate: string;
    version: string;
    data: {
        suppliers: Supplier[];
        products: Product[];
        customers: Customer[];
        sales: Sale[];
        invoices: Invoice[];
        shifts: CashRegisterShift[];
        payments: Payment[];
        stockMovements: StockMovement[];
        purchaseOrders: PurchaseOrder[];
        receipts: any[];
    };
}

/**
 * Backup all current data to localStorage and optionally download
 */
export async function backupRealData(download = true): Promise<BackupData> {
    console.log('💾 Backing up real data...');
    
    // Ensure database is ready
    await dbReady;
    
    const backup: BackupData = {
        backupDate: new Date().toISOString(),
        version: '1.0',
        data: {
            suppliers: await db.suppliers.toArray(),
            products: await db.products.toArray(),
            customers: await db.customers.toArray(),
            sales: await db.sales.toArray(),
            invoices: await db.invoices.toArray(),
            shifts: await db.shifts.toArray(),
            payments: await db.payments.toArray(),
            stockMovements: await db.stockMovements.toArray(),
            purchaseOrders: await db.purchaseOrders.toArray(),
            receipts: await db.receipts.toArray(),
        },
    };
    
    // Save to localStorage
    localStorage.setItem(BACKUP_KEY, JSON.stringify(backup));
    
    // Download as file
    if (download) {
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `minimarket-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        console.log('📥 Backup file downloaded');
    }
    
    const totalRecords = Object.values(backup.data).reduce((sum, arr) => sum + arr.length, 0);
    console.log(`✅ Backed up ${totalRecords} records`);
    
    return backup;
}

/**
 * Restore data from localStorage backup
 */
export async function restoreRealData(): Promise<boolean> {
    console.log('🔄 Restoring real data from backup...');
    
    // Ensure database is ready
    await dbReady;
    
    const backupStr = localStorage.getItem(BACKUP_KEY);
    if (!backupStr) {
        console.error('❌ No backup found');
        return false;
    }
    
    try {
        const backup: BackupData = JSON.parse(backupStr);
        
        // Clear current data
        await clearAllData();
        
        // Restore each table
        if (backup.data.suppliers?.length) {
            await db.suppliers.bulkAdd(backup.data.suppliers);
        }
        if (backup.data.products?.length) {
            await db.products.bulkAdd(backup.data.products);
        }
        if (backup.data.customers?.length) {
            await db.customers.bulkAdd(backup.data.customers);
        }
        if (backup.data.sales?.length) {
            await db.sales.bulkAdd(backup.data.sales);
        }
        if (backup.data.invoices?.length) {
            await db.invoices.bulkAdd(backup.data.invoices);
        }
        if (backup.data.shifts?.length) {
            await db.shifts.bulkAdd(backup.data.shifts);
        }
        if (backup.data.payments?.length) {
            await db.payments.bulkAdd(backup.data.payments);
        }
        if (backup.data.stockMovements?.length) {
            await db.stockMovements.bulkAdd(backup.data.stockMovements);
        }
        if (backup.data.purchaseOrders?.length) {
            await db.purchaseOrders.bulkAdd(backup.data.purchaseOrders);
        }
        if (backup.data.receipts?.length) {
            await db.receipts.bulkAdd(backup.data.receipts);
        }
        
        // Clear test mode flag
        localStorage.removeItem(TEST_MODE_KEY);
        
        const totalRecords = Object.values(backup.data).reduce((sum, arr) => sum + arr.length, 0);
        console.log(`✅ Restored ${totalRecords} records from backup dated ${backup.backupDate}`);
        
        return true;
    } catch (error) {
        console.error('❌ Failed to restore backup:', error);
        return false;
    }
}

/**
 * Restore from a JSON file
 */
export async function restoreFromFile(file: File): Promise<boolean> {
    console.log('📂 Restoring from file...');
    
    try {
        const text = await file.text();
        const backup: BackupData = JSON.parse(text);
        
        // Save to localStorage for safety
        localStorage.setItem(BACKUP_KEY, text);
        
        // Restore using the same function
        return await restoreRealData();
    } catch (error) {
        console.error('❌ Failed to restore from file:', error);
        return false;
    }
}

// ============ CLEAR DATA ============

async function clearAllData(): Promise<void> {
    console.log('🗑️  Clearing all data...');
    
    await db.sales.clear();
    await db.invoices.clear();
    await db.products.clear();
    await db.suppliers.clear();
    await db.customers.clear();
    await db.shifts.clear();
    await db.stockMovements.clear();
    await db.payments.clear();
    await db.purchaseOrders.clear();
    await db.receipts.clear();
    // Note: Keeping users, roles, bankAccounts, rules, globalContext
    
    console.log('✅ Data cleared');
}

// ============ SAMPLE DATA POOLS ============

const SUPPLIER_DATA = [
    { name: 'Distribuidora Nacional', rnc: '101234567', category: 'Distributor' as const },
    { name: 'Importadora del Caribe', rnc: '102345678', category: 'Wholesaler' as const },
    { name: 'Comercial Cristobal', rnc: '103456789', category: 'Distributor' as const },
    { name: 'Suplidora San Juan', rnc: '104567890', category: 'Wholesaler' as const },
    { name: 'Alimentos del Valle', rnc: '105678901', category: 'Manufacturer' as const },
    { name: 'Bebidas Tropicales', rnc: '106789012', category: 'Manufacturer' as const },
    { name: 'Lacteos del Norte', rnc: '107890123', category: 'Manufacturer' as const },
    { name: 'Granos y Cereales RD', rnc: '108901234', category: 'Distributor' as const },
    { name: 'Productos de Limpieza SA', rnc: '109012345', category: 'Manufacturer' as const },
    { name: 'Carnes Premium', rnc: '110123456', category: 'Wholesaler' as const },
    { name: 'Frutas y Vegetales Express', rnc: '111234567', category: 'Distributor' as const },
    { name: 'Panadería Industrial', rnc: '112345678', category: 'Manufacturer' as const },
];

const PRODUCT_CATEGORIES = [
    { name: 'Bebidas', products: ['Agua 20oz', 'Coca-Cola 2L', 'Pepsi 2L', 'Jugo de Naranja 1L', 'Cerveza Presidente', 'Red Bull', 'Gatorade', 'Malta India'] },
    { name: 'Lácteos', products: ['Leche Entera 1L', 'Leche Descremada 1L', 'Yogurt Natural', 'Queso Cheddar', 'Mantequilla', 'Crema Agria'] },
    { name: 'Snacks', products: ['Doritos', 'Cheetos', 'Lays Clásicas', 'Galletas Oreo', 'Chocolates M&M', 'Barras de Granola'] },
    { name: 'Carnes', products: ['Pollo Entero', 'Pechuga de Pollo', 'Carne Molida', 'Chuletas de Cerdo', 'Salchichas', 'Jamón'] },
    { name: 'Frutas', products: ['Manzanas', 'Bananas', 'Naranjas', 'Aguacates', 'Limones', 'Piña'] },
    { name: 'Vegetales', products: ['Tomates', 'Cebollas', 'Papas', 'Zanahorias', 'Lechuga', 'Pimientos'] },
    { name: 'Granos', products: ['Arroz Premium 5lb', 'Habichuelas Rojas', 'Habichuelas Negras', 'Lentejas', 'Maíz'] },
    { name: 'Limpieza', products: ['Detergente Líquido', 'Cloro', 'Jabón de Platos', 'Desinfectante', 'Papel Higiénico 12pk'] },
    { name: 'Panadería', products: ['Pan de Agua', 'Pan Sobao', 'Bizcocho', 'Donas', 'Galletas de Mantequilla'] },
    { name: 'Condimentos', products: ['Aceite Vegetal 1L', 'Salsa de Tomate', 'Mayonesa', 'Mostaza', 'Sal', 'Azúcar 5lb'] },
];

const CUSTOMER_NAMES = [
    'María García', 'Juan Pérez', 'Ana Rodríguez', 'Carlos Martínez', 'Rosa López',
    'Pedro Sánchez', 'Carmen Díaz', 'Luis González', 'Elena Fernández', 'Miguel Torres',
    'Restaurante El Buen Sabor', 'Cafetería Central', 'Hotel Paradise', 'Colmado Don Juan',
    'Supermercado La Familia', 'Comedor Universitario', 'Bar La Esquina', 'Panadería San José',
    'José Hernández', 'Laura Reyes', 'Roberto Castro', 'Patricia Núñez', 'Diego Morales',
    'Farmacia Central', 'Ferretería El Martillo',
];

// ============ HELPER FUNCTIONS ============

function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals = 2): number {
    return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function randomElement<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(start: Date, end: Date): Date {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
}

function generateNCF(): string {
    const types = ['B01', 'B02', 'B14', 'B15'];
    const type = randomElement(types);
    const number = String(randomInt(1, 99999999)).padStart(8, '0');
    return `${type}${number}`;
}

// ============ SEEDERS ============

async function seedSuppliers(): Promise<Supplier[]> {
    console.log('🏭 Seeding suppliers...');
    const suppliers: Supplier[] = [];
    
    for (const data of SUPPLIER_DATA) {
        // Use generateId() from db.ts for Dexie Cloud @id fields
        const supplier: Supplier = {
            id: generateId(),
            name: data.name,
            rnc: data.rnc,
            category: data.category,
            isActive: true,
            defaultCreditDays: randomElement([15, 30, 45, 60]),
            phone: `809-${randomInt(200, 999)}-${randomInt(1000, 9999)}`,
            email: `ventas@${data.name.toLowerCase().replace(/\s+/g, '')}.com.do`,
            address: `Calle ${randomInt(1, 50)}, Sector ${randomElement(['Los Prados', 'Gazcue', 'Naco', 'Piantini'])}`,
            city: randomElement(['Santo Domingo', 'Santiago', 'La Romana', 'San Pedro']),
            examples: [],
            createdAt: new Date(),
        };
        
        try {
            await db.suppliers.add(supplier);
            suppliers.push(supplier);
        } catch (error: any) {
            console.error('Error adding supplier:', data.name, error?.message || error?.name || JSON.stringify(error));
        }
    }
    
    console.log(`✅ Created ${suppliers.length} suppliers`);
    return suppliers;
}

async function seedProducts(suppliers: Supplier[]): Promise<Product[]> {
    console.log('📦 Seeding products...');
    const products: Product[] = [];
    
    for (const category of PRODUCT_CATEGORIES) {
        for (const productName of category.products) {
            const supplier = randomElement(suppliers);
            const cost = randomFloat(20, 500);
            // Margins: minimum 25%, ideally around 35% (range 30-40% with some variation)
            // Use weighted distribution: 70% chance of 30-40%, 30% chance of 25-30% or 40-45%
            let margin: number;
            if (Math.random() < 0.7) {
                // 70% chance: ideal range 30-40% (centered around 35%)
                margin = randomFloat(0.30, 0.40);
            } else {
                // 30% chance: wider range 25-45% (still above 25% minimum)
                margin = randomFloat(0.25, 0.45);
            }
            const sellingPrice = cost * (1 + margin);
            
            // Use generateId() from db.ts for Dexie Cloud @id fields
            const product: Product = {
                id: generateId(),
                productId: `SKU-${String(products.length + 1).padStart(5, '0')}`,
                barcode: String(randomInt(1000000000000, 9999999999999)),
                supplierId: supplier.id,
                name: productName,
                category: category.name,
                lastPrice: cost,
                lastDate: formatDate(randomDate(CONFIG.startDate, CONFIG.endDate)),
                averageCost: cost,
                costIncludesTax: true,
                costTaxRate: 0.18,
                sellingPrice: parseFloat(sellingPrice.toFixed(2)),
                priceIncludesTax: true,
                taxRate: 0.18,
                targetMargin: margin,
                currentStock: randomInt(10, 200),
                reorderPoint: randomInt(5, 20),
                salesVolume: randomInt(100, 5000),
                salesVelocity: randomFloat(1, 20),
            };
            
            try {
                await db.products.add(product);
                products.push(product);
            } catch (error) {
                console.error('Error adding product:', productName, error);
            }
        }
    }
    
    console.log(`✅ Created ${products.length} products`);
    return products;
}

async function seedCustomers(): Promise<Customer[]> {
    console.log('👥 Seeding customers...');
    const customers: Customer[] = [];
    
    for (const name of CUSTOMER_NAMES) {
        const isBusiness = name.includes('Restaurante') || name.includes('Hotel') || 
                           name.includes('Colmado') || name.includes('Supermercado') ||
                           name.includes('Cafetería') || name.includes('Comedor') ||
                           name.includes('Farmacia') || name.includes('Ferretería');
        
        // Use generateId() from db.ts for Dexie Cloud @id fields
        const customer: Customer = {
            id: generateId(),
            name,
            type: isBusiness ? 'corporate' : (Math.random() > 0.7 ? 'wholesale' : 'retail'),
            rnc: isBusiness ? String(randomInt(100000000, 999999999)) : undefined,
            phone: `809-${randomInt(200, 999)}-${randomInt(1000, 9999)}`,
            email: isBusiness ? `contacto@${name.toLowerCase().replace(/\s+/g, '')}.com` : undefined,
            creditLimit: isBusiness ? randomInt(10000, 100000) : randomInt(1000, 10000),
            currentBalance: 0,
            isActive: true,
            createdAt: new Date(),
        };
        
        try {
            await db.customers.add(customer);
            customers.push(customer);
        } catch (error) {
            console.error('Error adding customer:', name, error);
        }
    }
    
    console.log(`✅ Created ${customers.length} customers`);
    return customers;
}

async function seedSales(products: Product[], customers: Customer[], onProgress?: (progress: number) => void): Promise<number> {
    console.log('🛒 Seeding sales (this may take a moment)...');
    
    const startDate = CONFIG.startDate;
    const endDate = CONFIG.endDate;
    const dayMs = 24 * 60 * 60 * 1000;
    const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / dayMs);
    
    let totalSales = 0;
    let currentShift: CashRegisterShift | null = null;
    let shiftSalesCount = 0;
    
    // Use <= to include the current day (endDate)
    for (let day = 0; day <= totalDays; day++) {
        const currentDate = new Date(startDate.getTime() + day * dayMs);
        const dayOfWeek = currentDate.getDay();
        
        // Weekend has more sales
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const salesMultiplier = isWeekend ? 1.4 : 1;
        
        // Seasonal adjustments
        const month = currentDate.getMonth();
        const isHoliday = (month === 11) || (month === 0);
        const seasonMultiplier = isHoliday ? 1.3 : 1;
        
        const numSales = Math.floor(CONFIG.avgSalesPerDay * salesMultiplier * seasonMultiplier * randomFloat(0.7, 1.3));
        
        // Create new shift every ~50 sales
        // Shifts use ++id (auto-increment) so we add without id and get it back
        if (!currentShift || shiftSalesCount > 50) {
            if (currentShift) {
                await db.shifts.update(currentShift.id!, {
                    closedAt: new Date(currentDate.getTime() + randomInt(8, 12) * 60 * 60 * 1000),
                    status: 'closed',
                    salesCount: shiftSalesCount,
                });
            }
            
            const shiftData: Omit<CashRegisterShift, 'id'> = {
                shiftNumber: `${currentDate.getFullYear()}-${String(day + 1).padStart(4, '0')}`,
                openedAt: new Date(currentDate.getTime() + 7 * 60 * 60 * 1000),
                openingCash: randomInt(5000, 15000),
                status: 'open',
            };
            const shiftId = await db.shifts.add(shiftData as CashRegisterShift) as number;
            currentShift = { ...shiftData, id: shiftId };
            shiftSalesCount = 0;
        }
        
        for (let s = 0; s < numSales; s++) {
            const numItems = randomInt(1, 8);
            const items: InvoiceItem[] = [];
            let subtotal = 0;
            let itbisTotal = 0;
            
            const usedProducts = new Set<string>(); // UUID set
            
            for (let i = 0; i < numItems; i++) {
                let product: Product;
                do {
                    product = randomElement(products);
                } while (usedProducts.has(product.id!) && usedProducts.size < products.length);
                
                usedProducts.add(product.id!);
                
                const quantity = randomInt(1, 5);
                const unitPrice = product.sellingPrice || product.lastPrice * 1.3;
                const value = unitPrice * quantity;
                const taxRate = product.taxRate || 0.18;
                const itbis = value * taxRate / (1 + taxRate);
                
                items.push({
                    description: product.name,
                    productId: product.productId,
                    quantity,
                    unitPrice,
                    taxRate,
                    priceIncludesTax: true,
                    value: value - itbis,
                    itbis,
                    amount: value,
                });
                
                subtotal += value - itbis;
                itbisTotal += itbis;
            }
            
            const total = subtotal + itbisTotal;
            const discount = Math.random() > 0.9 ? total * randomFloat(0.05, 0.15) : 0;
            
            const customer = Math.random() > 0.6 ? randomElement(customers) : undefined;
            const saleTime = new Date(currentDate.getTime() + randomInt(7, 21) * 60 * 60 * 1000);
            
            // Use generateId() from db.ts for Dexie Cloud @id fields
            const sale: Sale = {
                id: generateId(),
                date: formatDate(saleTime),
                customerId: customer?.id,
                customerName: customer?.name || 'Cliente General',
                items,
                subtotal,
                discount,
                itbisTotal,
                total: total - discount,
                paymentMethod: randomElement(['cash', 'cash', 'cash', 'credit_card', 'debit_card', 'bank_transfer']),
                paymentStatus: 'paid',
                paidAmount: total - discount,
                shiftId: currentShift.id,
                receiptNumber: String(totalSales + 1).padStart(6, '0'),
                createdAt: saleTime,
            };
            
            await db.sales.add(sale);
            totalSales++;
            shiftSalesCount++;
        }
        
        // Report progress
        if (onProgress && day % 10 === 0) {
            onProgress(Math.round((day / totalDays) * 100));
        }
    }
    
    // Close final shift
    if (currentShift) {
        await db.shifts.update(currentShift.id!, {
            closedAt: new Date(),
            status: 'closed',
            salesCount: shiftSalesCount,
        });
    }
    
    console.log(`✅ Created ${totalSales} sales over ${totalDays} days`);
    return totalSales;
}

async function seedInvoices(suppliers: Supplier[], products: Product[]): Promise<number> {
    console.log('📄 Seeding purchase invoices...');
    
    const startDate = CONFIG.startDate;
    const endDate = CONFIG.endDate;
    const dayMs = 24 * 60 * 60 * 1000;
    const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / dayMs);
    let totalInvoices = 0;
    
    // Generate invoices roughly every 3-4 days (use <= to include current day)
    for (let day = 0; day <= totalDays; day += randomInt(3, 4)) {
        const numInvoices = randomInt(1, 2); // 1-2 invoices per period
        
        for (let i = 0; i < numInvoices; i++) {
            const supplier = randomElement(suppliers);
            const invoiceDate = randomDate(
                new Date(startDate.getTime() + day * dayMs),
                new Date(startDate.getTime() + Math.min(day + 3, totalDays) * dayMs)
            );
            
            const supplierProducts = products.filter(p => p.supplierId === supplier.id);
            const productsToOrder = supplierProducts.length > 0 ? supplierProducts : products.slice(0, 10);
            
            const numItems = randomInt(3, 15);
            const items: InvoiceItem[] = [];
            let subtotal = 0;
            let itbisTotal = 0;
            
            for (let j = 0; j < numItems; j++) {
                const product = randomElement(productsToOrder);
                const quantity = randomInt(5, 50);
                const unitPrice = product.lastPrice;
                const value = unitPrice * quantity;
                const itbis = value * 0.18 / 1.18;
                
                items.push({
                    description: product.name,
                    productId: product.productId,
                    quantity,
                    unitPrice,
                    taxRate: 0.18,
                    priceIncludesTax: true,
                    value: value - itbis,
                    itbis,
                    amount: value,
                });
                
                subtotal += value - itbis;
                itbisTotal += itbis;
            }
            
            // Use generateId() from db.ts for Dexie Cloud @id fields
            const invoice: Invoice = {
                id: generateId(),
                providerName: supplier.name,
                providerRnc: supplier.rnc,
                issueDate: formatDate(invoiceDate),
                ncf: generateNCF(),
                currency: 'DOP',
                items,
                subtotal,
                discount: 0,
                itbisTotal,
                total: subtotal + itbisTotal,
                rawText: `Invoice from ${supplier.name}`,
                status: 'verified',
                category: 'Inventory',
                paymentStatus: Math.random() > 0.2 ? 'paid' : 'pending',
                createdAt: invoiceDate,
            };
            
            await db.invoices.add(invoice);
            totalInvoices++;
        }
    }
    
    console.log(`✅ Created ${totalInvoices} purchase invoices`);
    return totalInvoices;
}

async function seedPurchaseOrders(suppliers: Supplier[], products: Product[]): Promise<number> {
    console.log('📋 Seeding purchase orders...');
    
    if (!suppliers || suppliers.length === 0) {
        console.error('❌ No suppliers available for purchase orders');
        return 0;
    }
    
    if (!products || products.length === 0) {
        console.error('❌ No products available for purchase orders');
        return 0;
    }
    
    // Filter suppliers that have valid IDs
    const validSuppliers = suppliers.filter(s => s.id !== undefined);
    if (validSuppliers.length === 0) {
        console.error('❌ No suppliers with valid IDs');
        return 0;
    }
    
    const startDate = CONFIG.startDate;
    const endDate = CONFIG.endDate;
    const dayMs = 24 * 60 * 60 * 1000;
    const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / dayMs);
    
    let totalPOs = 0;
    let poCounter = 1;
    
    console.log(`📋 Generating POs over ${totalDays} days with ${validSuppliers.length} suppliers and ${products.length} products`);
    
    // Generate POs roughly every 3-5 days (use <= to include current day)
    for (let day = 0; day <= totalDays; day += randomInt(3, 5)) {
        const numPOs = randomInt(1, 2); // 1-2 POs per period
        
        for (let i = 0; i < numPOs; i++) {
            // Declare variables outside try block for error logging
            let currentSupplier: Supplier | null = null;
            let productsToOrder: Product[] = [];
            
            try {
                currentSupplier = randomElement(validSuppliers);
                
                if (!currentSupplier.id) {
                    console.warn('⚠️ Supplier without ID skipped:', currentSupplier.name);
                    continue;
                }
                
                const orderDate = randomDate(
                    new Date(startDate.getTime() + day * dayMs),
                    new Date(startDate.getTime() + Math.min(day + 5, totalDays) * dayMs)
                );
                
                // Expected delivery 3-14 days after order
                const expectedDate = new Date(orderDate.getTime() + randomInt(3, 14) * dayMs);
                
                const supplierProducts = products.filter(p => p.supplierId === currentSupplier!.id);
                productsToOrder = supplierProducts.length > 0 ? supplierProducts : products.slice(0, 15);
                
                if (productsToOrder.length === 0) {
                    console.warn('⚠️ No products available for PO');
                    continue;
                }
                
                const numItems = randomInt(5, Math.min(20, productsToOrder.length));
                const items: PurchaseOrderItem[] = [];
                let subtotal = 0;
                let itbisTotal = 0;
                
                for (let j = 0; j < numItems; j++) {
                    const product = randomElement(productsToOrder);
                    if (!product.lastPrice || product.lastPrice <= 0) {
                        continue; // Skip products without valid price
                    }
                    
                    const quantity = randomInt(10, 100);
                    const unitPrice = product.lastPrice;
                    const taxRate = 0.18;
                    const value = unitPrice * quantity;
                    const itbis = value * taxRate / (1 + taxRate);
                    
                    items.push({
                        productId: product.id,
                        productName: product.name,
                        quantity,
                        unitPrice,
                        taxRate,
                        priceIncludesTax: true,
                        value: value - itbis,
                        itbis,
                        amount: value,
                    });
                    
                    subtotal += value - itbis;
                    itbisTotal += itbis;
                }
                
                if (items.length === 0) {
                    console.warn('⚠️ PO skipped - no valid items');
                    continue;
                }
                
                // Determine status based on dates
                const now = new Date();
                let status: PurchaseOrder['status'];
                if (expectedDate > now) {
                    // Future delivery - could be draft, sent, or partial
                    status = randomElement(['draft', 'sent', 'sent', 'partial']); // More likely sent
                } else {
                    // Past expected date - could be received, partial, or closed
                    status = randomElement(['received', 'received', 'partial', 'closed']);
                }
                
                const poNumber = `PO-${orderDate.getFullYear()}-${String(poCounter++).padStart(4, '0')}`;
                
                // Use generateId() from db.ts for Dexie Cloud @id fields
                const purchaseOrder: PurchaseOrder = {
                    id: generateId(),
                    poNumber,
                    supplierId: currentSupplier!.id!,
                    supplierName: currentSupplier!.name,
                    orderDate: formatDate(orderDate),
                    expectedDate: formatDate(expectedDate),
                    status,
                    items,
                    subtotal,
                    itbisTotal,
                    total: subtotal + itbisTotal,
                    notes: status === 'partial' ? 'Partial delivery received' : undefined,
                    createdAt: orderDate,
                    updatedAt: status !== 'draft' ? new Date(orderDate.getTime() + randomInt(1, 5) * dayMs) : undefined,
                };
                
                const poId = await db.purchaseOrders.add(purchaseOrder);
                if (poId) {
                    totalPOs++;
                    if (totalPOs % 5 === 0) {
                        console.log(`  ✓ Created ${totalPOs} purchase orders so far...`);
                    }
                } else {
                    console.warn('⚠️ Failed to add purchase order - no ID returned');
                }
            } catch (error) {
                console.error('❌ Error creating purchase order:', error);
                console.error('  Supplier:', currentSupplier?.name, 'ID:', currentSupplier?.id);
                console.error('  Products available:', productsToOrder?.length ?? 0);
            }
        }
    }
    
    console.log(`✅ Created ${totalPOs} purchase orders`);
    return totalPOs;
}

// ============ MAIN FUNCTIONS ============

export interface SeedProgress {
    stage: string;
    percent: number;
}

export interface SeedResult {
    success: boolean;
    suppliers: number;
    products: number;
    customers: number;
    sales: number;
    invoices: number;
    purchaseOrders: number;
    duration: number;
}

/**
 * Activate test data mode
 * 1. Backs up real data
 * 2. Clears database
 * 3. Seeds test data
 */
export async function activateTestData(onProgress?: (progress: SeedProgress) => void): Promise<SeedResult> {
    console.log('🚀 Activating test data mode...');
    const startTime = Date.now();
    
    try {
        // Ensure database is ready before proceeding
        await dbReady;
        console.log('✅ Database ready for seeding');
        // Step 1: Backup real data
        onProgress?.({ stage: 'Backing up real data...', percent: 5 });
        await backupRealData(true); // Downloads backup file
        
        // Step 2: Clear database
        onProgress?.({ stage: 'Clearing current data...', percent: 10 });
        await clearAllData();
        
        // Step 3: Seed suppliers
        onProgress?.({ stage: 'Creating suppliers...', percent: 15 });
        const suppliers = await seedSuppliers();
        
        // Step 4: Seed products
        onProgress?.({ stage: 'Creating products...', percent: 25 });
        const products = await seedProducts(suppliers);
        
        // Step 5: Seed customers
        onProgress?.({ stage: 'Creating customers...', percent: 35 });
        const customers = await seedCustomers();
        
        // Step 6: Seed sales (longest step)
        const salesCount = await seedSales(products, customers, (p) => {
            onProgress?.({ stage: `Creating sales... ${p}%`, percent: 35 + (p * 0.5) });
        });
        
        // Step 7: Seed invoices
        onProgress?.({ stage: 'Creating invoices...', percent: 85 });
        const invoicesCount = await seedInvoices(suppliers, products);
        
        // Step 8: Seed purchase orders
        onProgress?.({ stage: 'Creating purchase orders...', percent: 92 });
        const purchaseOrdersCount = await seedPurchaseOrders(suppliers, products);
        
        // Set test mode flag
        localStorage.setItem(TEST_MODE_KEY, 'true');
        
        onProgress?.({ stage: 'Complete!', percent: 100 });
        
        const duration = (Date.now() - startTime) / 1000;
        
        console.log('');
        console.log('✅ ============ TEST DATA ACTIVATED ============');
        console.log(`⏱️  Duration: ${duration.toFixed(1)} seconds`);
        console.log(`🏭 Suppliers: ${suppliers.length}`);
        console.log(`📦 Products: ${products.length}`);
        console.log(`👥 Customers: ${customers.length}`);
        console.log(`🛒 Sales: ${salesCount}`);
        console.log(`📄 Invoices: ${invoicesCount}`);
        console.log(`📋 Purchase Orders: ${purchaseOrdersCount}`);
        console.log('');
        console.log('💾 Your real data has been backed up and downloaded!');
        console.log('🔄 Refresh the page to see the test data.');
        
        return {
            success: true,
            suppliers: suppliers.length,
            products: products.length,
            customers: customers.length,
            sales: salesCount,
            invoices: invoicesCount,
            purchaseOrders: purchaseOrdersCount,
            duration,
        };
    } catch (error) {
        console.error('❌ Failed to activate test data:', error);
        return {
            success: false,
            suppliers: 0,
            products: 0,
            customers: 0,
            sales: 0,
            invoices: 0,
            purchaseOrders: 0,
            duration: (Date.now() - startTime) / 1000,
        };
    }
}

/**
 * Deactivate test data mode and restore real data
 */
export async function deactivateTestData(): Promise<boolean> {
    console.log('🔄 Deactivating test data mode...');
    
    const success = await restoreRealData();
    
    if (success) {
        console.log('✅ Real data restored! Refresh the page.');
    }
    
    return success;
}

/**
 * Clear backup (use with caution!)
 */
export function clearBackup(): void {
    localStorage.removeItem(BACKUP_KEY);
    localStorage.removeItem(TEST_MODE_KEY);
    console.log('🗑️  Backup cleared');
}

/**
 * Force seed test data - clears existing data and generates fresh test data
 * This is a direct function that bypasses the UI flow for easier testing
 * 
 * Usage in browser console:
 * import('/src/lib/seed-test-data.ts').then(m => m.forceSeedTestData())
 */
export async function forceSeedTestData(): Promise<SeedResult> {
    console.log('🚀 Force seeding test data (skipping backup)...');
    const startTime = Date.now();
    
    // Clear the test mode flags first
    localStorage.removeItem(BACKUP_KEY);
    localStorage.removeItem(TEST_MODE_KEY);
    
    try {
        // Ensure database is ready before proceeding
        await dbReady;
        console.log('✅ Database ready for seeding');
        // Clear database
        console.log('🗑️  Clearing current data...');
        await clearAllData();
        
        // Seed suppliers
        console.log('🏭 Creating suppliers...');
        const suppliers = await seedSuppliers();
        
        // Seed products
        console.log('📦 Creating products...');
        const products = await seedProducts(suppliers);
        
        // Seed customers
        console.log('👥 Creating customers...');
        const customers = await seedCustomers();
        
        // Seed sales
        console.log('🛒 Creating sales (this may take a moment)...');
        const salesCount = await seedSales(products, customers, (p) => {
            if (p % 20 === 0) console.log(`  Sales progress: ${p}%`);
        });
        
        // Seed invoices
        console.log('📄 Creating invoices...');
        const invoicesCount = await seedInvoices(suppliers, products);
        
        // Seed purchase orders
        console.log('📋 Creating purchase orders...');
        const purchaseOrdersCount = await seedPurchaseOrders(suppliers, products);
        
        // Set test mode flag
        localStorage.setItem(TEST_MODE_KEY, 'true');
        
        const duration = (Date.now() - startTime) / 1000;
        
        console.log('');
        console.log('✅ ============ TEST DATA CREATED ============');
        console.log(`⏱️  Duration: ${duration.toFixed(1)} seconds`);
        console.log(`🏭 Suppliers: ${suppliers.length}`);
        console.log(`📦 Products: ${products.length}`);
        console.log(`👥 Customers: ${customers.length}`);
        console.log(`🛒 Sales: ${salesCount}`);
        console.log(`📄 Invoices: ${invoicesCount}`);
        console.log(`📋 Purchase Orders: ${purchaseOrdersCount}`);
        console.log('');
        console.log('🔄 Refresh the page to see the test data!');
        
        return {
            success: true,
            suppliers: suppliers.length,
            products: products.length,
            customers: customers.length,
            sales: salesCount,
            invoices: invoicesCount,
            purchaseOrders: purchaseOrdersCount,
            duration,
        };
    } catch (error) {
        console.error('❌ Failed to seed test data:', error);
        return {
            success: false,
            suppliers: 0,
            products: 0,
            customers: 0,
            sales: 0,
            invoices: 0,
            purchaseOrders: 0,
            duration: (Date.now() - startTime) / 1000,
        };
    }
}

// Expose to window for easy console access
if (typeof window !== 'undefined') {
    // @ts-ignore
    window.seedTestData = forceSeedTestData;
    // @ts-ignore
    window.clearTestData = clearBackup;
    console.log('💡 Test data functions available: window.seedTestData() and window.clearTestData()');
}

