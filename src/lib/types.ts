export interface InvoiceItem {
    description: string;
    productId?: string; // Link to Product Catalog
    quantity: number;
    unitPrice: number;
    taxRate?: number; // 0.18, 0.16, 0
    priceIncludesTax?: boolean;
    value: number;
    itbis: number;
    amount: number;
}

export interface Invoice {
    id?: string; // UUID for Dexie Cloud sync
    // Extracted Data
    providerName: string;
    providerRnc: string;
    clientName?: string;
    clientRnc?: string;
    issueDate: string;
    dueDate?: string;
    ncf: string;
    currency: 'DOP' | 'USD';
    items: InvoiceItem[];

    // Totals
    subtotal: number;
    discount: number;
    itbisTotal: number;
    total: number;

    // Metadata
    rawText: string;
    imageUrl?: string;
    status: 'draft' | 'verified' | 'exported' | 'needs_extraction';
    category?: 'Inventory' | 'Utilities' | 'Maintenance' | 'Payroll' | 'Other';
    createdAt: Date;

    // Security
    securityCode?: string; // QR Code content
    isEcf?: boolean;
    qrUrl?: string;

    // AI Insights
    reasoning?: string;

    // Payment Management
    paymentStatus?: 'pending' | 'partial' | 'paid' | 'overdue';
    paidDate?: string;         // Date when invoice was paid
    paidAmount?: number;       // Amount paid (for partial payments)
    creditDays?: number;       // Credit days from supplier
    
    // Purchase Management
    receiptId?: string;         // Link to receipt if available
}

export interface Supplier {
    id?: string; // UUID for Dexie Cloud sync
    name: string;
    rnc: string;
    alias?: string[];
    customRules?: string;
    examples: Invoice[];
    defaultCreditDays?: number; // Default credit days (e.g., 30 for Comercial Cristobal)
    
    // Type (Individual or Company)
    supplierType?: 'individual' | 'company';
    taxpayerType?: string; // e.g., "Cliente de Consumo"
    
    // Contact Information
    phone?: string;
    mobile?: string;
    email?: string;
    contactPerson?: string;
    contactPhone?: string;
    
    // Address
    address?: string;  // Street line 1
    address2?: string; // Street line 2
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    
    // Business Details
    website?: string;
    notes?: string;
    tags?: string[];   // e.g., ["B2B", "VIP", "consulting"]
    category?: 'Distributor' | 'Manufacturer' | 'Wholesaler' | 'Service' | 'Other';
    isActive?: boolean;
    createdAt?: Date;
}

export type PaymentMethodType = 'cash' | 'bank_transfer' | 'check' | 'credit_card' | 'debit_card' | 'mobile_payment' | 'other';

export interface BankAccount {
    id?: string; // UUID for Dexie Cloud sync
    bankName: string;
    accountName: string;      // Account holder name
    accountNumber: string;    // Last 4 digits or full (encrypted ideally)
    accountType: 'checking' | 'savings' | 'credit';
    currency: 'DOP' | 'USD';
    isDefault?: boolean;
    isActive?: boolean;
    color?: string;           // For UI distinction
    notes?: string;
}

export interface Payment {
    id?: string; // UUID for Dexie Cloud sync
    invoiceId?: string;       // For supplier payments (CxP)
    saleId?: string;          // For customer payments (CxC)
    returnId?: string;        // For refund payments (devoluciones)
    supplierId?: string;
    customerId?: string;
    
    // Payment Details
    amount: number;
    currency: 'DOP' | 'USD';
    paymentDate: string;
    
    // Method & Account
    paymentMethod: PaymentMethodType;
    bankAccountId?: string;   // If paid via bank
    checkNumber?: string;     // If paid by check
    referenceNumber?: string; // Transfer/transaction reference
    
    // Refund indicator
    isRefund?: boolean;       // True if this is a refund payment
    
    // Metadata
    notes?: string;
    createdAt: Date;
}

export interface KnowledgeBaseRule {
    id?: string; // UUID for Dexie Cloud sync
    supplierId: string;
    rule: string;
    createdAt: Date;
}

export interface GlobalContextItem {
    id?: string; // UUID for Dexie Cloud sync
    title: string;
    content: string; // Extracted text
    type: 'text' | 'file';
    category?: 'tax' | 'conversion' | 'business_logic' | 'pricing_rule';
    fileName?: string;
    fileType?: 'pdf' | 'excel' | 'txt';
    createdAt: Date;
    // Analytics fields (optional, for backward compatibility)
    usageCount?: number;
    lastUsed?: Date;
    tags?: string[];
    favorite?: boolean;
}

export interface UserHints {
    supplierName?: string;
    total?: number;
    itbis?: number;
    isMultiPage?: boolean;
}

export interface Product {
    id?: string; // UUID for Dexie Cloud sync
    productId?: string; // Custom SKU/Product ID
    barcode?: string;   // Barcode (EAN-13, UPC, etc.)
    supplierId?: string; // Reference to supplier (cloud sync)
    name: string;
    aliases?: string[]; // Alternative names for fuzzy matching
    category?: string;

    // Pricing & Costs
    lastPrice: number;              // Most recent purchase price (cost)
    lastDate: string;
    averageCost?: number;
    costIncludesTax?: boolean;      // Does cost include ITBIS? (default: true)
    costTaxRate?: number;           // Tax rate on cost (0.18, 0.16, 0)
    sellingPrice?: number;          // Selling price
    priceIncludesTax?: boolean;     // Does selling price include ITBIS? (default: true)
    taxRate?: number;               // Tax rate for sales (0.18, 0.16, 0)
    isExempt?: boolean;             // True for 0% tax (exempt) items
    targetMargin?: number;          // e.g. 0.30 for 30%

    // Inventory
    currentStock?: number;    // Current stock in units
    reorderPoint?: number;    // Reorder point for alerts
    lastStockUpdate?: string; // Last stock update date

    // Sales Data
    salesVolume?: number; // Total units sold
    salesVelocity?: number; // Units/day
    lastSaleDate?: string;

    // AI Analysis
    aiSuggestedPrice?: number;
    aiSuggestedMargin?: number;
    aiReasoning?: string;
    aiAnalystRating?: 'BUY' | 'SELL' | 'HOLD';
    aiCreativeIdea?: string;
}

export interface StockMovement {
    id?: string; // UUID for Dexie Cloud sync
    productId: string;
    type: 'in' | 'out' | 'adjustment' | 'return';
    quantity: number;
    invoiceId?: string;  // Reference to invoice (if applicable)
    receiptId?: string;  // Reference to receipt (if applicable)
    saleId?: string;     // Reference to sale (if applicable)
    returnId?: string;   // Reference to return (if applicable)
    date: string;
    notes?: string;
}

// ============ PURCHASE ORDERS & RECEIPTS ============

export interface PurchaseOrderItem {
    productId?: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    taxRate?: number; // 0.18, 0.16, 0
    priceIncludesTax?: boolean;
    value: number; // Subtotal before tax (quantity * unitPrice or net)
    itbis: number; // Tax amount for this line
    amount: number; // Total for this line (value + itbis)
    expectedDate?: string;
    notes?: string;
}

export interface PurchaseOrder {
    id?: string; // UUID for Dexie Cloud sync
    poNumber: string; // Auto-generated: PO-YYYY-XXXX
    supplierId: string;
    supplierName?: string; // Denormalized
    orderDate: string;
    expectedDate?: string;
    status: 'draft' | 'sent' | 'partial' | 'received' | 'closed' | 'cancelled';
    items: PurchaseOrderItem[];
    subtotal: number; // Total before tax
    itbisTotal: number; // Total tax amount
    total: number; // Total including tax
    notes?: string;
    createdBy?: string;
    createdAt: Date;
    updatedAt?: Date;
}

export interface ReceiptItem {
    productId?: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    receivedQuantity: number; // May differ from ordered quantity
    condition: 'good' | 'damaged' | 'expired' | 'wrong_item';
    notes?: string;
}

export interface Receipt {
    id?: string; // UUID for Dexie Cloud sync
    receiptNumber: string; // Auto-generated: REC-YYYY-XXXX
    purchaseOrderId?: string; // Optional: can receive without PO
    supplierId: string;
    supplierName?: string;
    receiptDate: string;
    invoiceId?: string; // Link to invoice if available
    items: ReceiptItem[];
    total: number;
    notes?: string;
    receivedBy?: string;
    createdAt: Date;
}

// ============ CUSTOMERS & SALES (Phase 1) ============

export interface Customer {
    id?: string; // UUID for Dexie Cloud sync
    name: string;
    type: 'retail' | 'wholesale' | 'corporate';
    rnc?: string;              // Tax ID for businesses
    phone?: string;
    email?: string;
    address?: string;
    creditLimit?: number;      // Maximum credit allowed
    currentBalance?: number;   // Outstanding balance (CxC)
    isActive: boolean;
    notes?: string;
    createdAt: Date;
}

export interface Sale {
    id?: string; // UUID for Dexie Cloud sync
    date: string;
    customerId?: string;       // Optional: cash sale if not specified
    customerName?: string;     // Denormalized for quick display
    
    // Items
    items: InvoiceItem[];      // Reusing InvoiceItem structure
    
    // Totals
    subtotal: number;
    discount: number;
    itbisTotal: number;
    total: number;
    
    // Payment info
    paymentMethod: PaymentMethodType;
    paymentStatus: 'pending' | 'partial' | 'paid';
    paidAmount: number;
    
    // Shift/Register
    shiftId?: number;          // Link to local cash register shift (local ID)
    receiptNumber?: string;    // Sequential receipt number (e.g., "0001")
    
    // User tracking
    cashierId?: number;        // User who made the sale (local user ID)
    cashierName?: string;
    
    // Returns tracking
    hasReturns?: boolean;      // True if any items have been returned
    returnedAmount?: number;   // Total amount returned
    
    // Metadata
    notes?: string;
    createdAt: Date;
}

// ============ CASH REGISTER SHIFTS (Turnos/Cortes) ============

export interface CashRegisterShift {
    id?: number;
    
    // Shift Info
    shiftNumber: string;       // Sequential (e.g., "2024-001")
    cashierId?: number;        // User ID who opened the shift
    cashierName?: string;
    
    // Opening
    openedAt: Date;
    openingCash: number;       // Cash in drawer at start
    
    // Closing (filled when shift ends)
    closedAt?: Date;
    closingCash?: number;      // Actual cash counted
    expectedCash?: number;     // Calculated: opening + cash sales - cash payments
    cashDifference?: number;   // Expected - Actual (positive = over, negative = short)
    
    // Totals (calculated at close)
    totalSales?: number;
    totalCashSales?: number;
    totalCardSales?: number;
    totalTransferSales?: number;
    totalCreditSales?: number;
    salesCount?: number;
    
    // Other movements
    cashIn?: number;           // Cash added during shift (not from sales)
    cashOut?: number;          // Cash removed during shift (not for payments)
    cashInNotes?: string;
    cashOutNotes?: string;
    
    // Status
    status: 'open' | 'closed';
    closingNotes?: string;
}

// Denomination counting for cash register
export interface CashDenomination {
    denomination: number;      // e.g., 2000, 1000, 500, 200, 100, 50, 25, 10, 5, 1
    quantity: number;
    total: number;             // denomination * quantity
}

// ============ RETURNS (Devoluciones) ============

export interface ReturnItem {
    description: string;
    productId?: string;
    quantity: number;           // Quantity returned
    unitPrice: number;
    taxRate?: number;
    value: number;
    itbis: number;
    amount: number;
    originalSaleItemIndex?: number; // Reference to item in original sale
}

export interface Return {
    id?: string; // UUID for Dexie Cloud sync
    date: string;
    originalSaleId: string;     // Reference to original sale
    originalReceiptNumber?: string;
    customerId?: string;
    customerName?: string;
    
    // Items being returned
    items: ReturnItem[];
    
    // Totals (positive amounts = money back to customer)
    subtotal: number;
    itbisTotal: number;
    total: number;
    
    // Refund info
    refundMethod: PaymentMethodType;
    refundStatus: 'pending' | 'completed';
    
    // Reason & Notes
    reason: 'defective' | 'wrong_item' | 'customer_changed_mind' | 'damaged' | 'expired' | 'other';
    reasonNotes?: string;
    
    // Shift & User tracking
    shiftId?: number;           // Local shift ID
    processedBy?: number;       // Local user ID who processed the return
    processedByName?: string;
    
    // Metadata
    createdAt: Date;
}

// ============ USERS & ROLES (Multi-user system) ============

export type PermissionKey = 
    // Sales permissions
    | 'pos.access'              // Can access POS
    | 'pos.sell'                // Can make sales
    | 'pos.apply_discount'      // Can apply discounts
    | 'pos.void_item'           // Can void items from cart
    | 'pos.process_return'      // Can process returns
    | 'pos.view_returns'        // Can view return history
    // Shift permissions
    | 'shifts.open'             // Can open shifts
    | 'shifts.close'            // Can close shifts
    | 'shifts.view_all'         // Can view all shifts (not just own)
    | 'shifts.cash_in_out'      // Can do cash in/out operations
    // Inventory permissions
    | 'inventory.view'          // Can view inventory
    | 'inventory.adjust'        // Can adjust stock
    | 'inventory.view_costs'    // Can see cost prices
    // Catalog permissions
    | 'catalog.view'            // Can view catalog
    | 'catalog.edit'            // Can add/edit products
    | 'catalog.delete'          // Can delete products
    | 'catalog.import'          // Can import products
    // Customer permissions
    | 'customers.view'          // Can view customers
    | 'customers.edit'          // Can add/edit customers
    | 'customers.delete'        // Can delete customers
    | 'customers.view_balance'  // Can view customer balances
    // Finance permissions
    | 'invoices.view'           // Can view purchase invoices
    | 'invoices.capture'        // Can capture new invoices
    | 'invoices.edit'           // Can edit invoices
    | 'invoices.delete'         // Can delete invoices
    | 'payments.record'         // Can record payments
    // Reports permissions
    | 'reports.view'            // Can view reports
    | 'reports.export'          // Can export reports
    | 'reports.view_profit'     // Can see profit margins
    // System permissions
    | 'settings.view'           // Can view settings
    | 'settings.edit'           // Can edit settings
    | 'users.manage'            // Can manage users
    | 'system.backup'           // Can backup/restore data
    | 'system.reset';           // Can factory reset

export interface Role {
    id?: number;
    name: string;
    description?: string;
    permissions: PermissionKey[];
    isSystem?: boolean;         // Built-in roles (admin, cashier, etc)
    createdAt: Date;
}

export interface User {
    id?: number;
    username: string;
    displayName: string;
    pin: string;                // 4-6 digit PIN for login
    roleId: number;
    roleName?: string;          // Denormalized for quick display
    email?: string;
    phone?: string;
    
    // Status
    isActive: boolean;
    lastLogin?: Date;
    
    // Metadata
    createdAt: Date;
    createdBy?: number;         // User who created this user
}

// Default roles with their permissions
export const DEFAULT_ROLES: Omit<Role, 'id' | 'createdAt'>[] = [
    {
        name: 'Administrador',
        description: 'Full system access',
        isSystem: true,
        permissions: [
            'pos.access', 'pos.sell', 'pos.apply_discount', 'pos.void_item', 'pos.process_return', 'pos.view_returns',
            'shifts.open', 'shifts.close', 'shifts.view_all', 'shifts.cash_in_out',
            'inventory.view', 'inventory.adjust', 'inventory.view_costs',
            'catalog.view', 'catalog.edit', 'catalog.delete', 'catalog.import',
            'customers.view', 'customers.edit', 'customers.delete', 'customers.view_balance',
            'invoices.view', 'invoices.capture', 'invoices.edit', 'invoices.delete', 'payments.record',
            'reports.view', 'reports.export', 'reports.view_profit',
            'settings.view', 'settings.edit', 'users.manage', 'system.backup', 'system.reset'
        ]
    },
    {
        name: 'Supervisor',
        description: 'POS supervision and inventory management',
        isSystem: true,
        permissions: [
            'pos.access', 'pos.sell', 'pos.apply_discount', 'pos.void_item', 'pos.process_return', 'pos.view_returns',
            'shifts.open', 'shifts.close', 'shifts.view_all', 'shifts.cash_in_out',
            'inventory.view', 'inventory.adjust', 'inventory.view_costs',
            'catalog.view', 'catalog.edit',
            'customers.view', 'customers.edit', 'customers.view_balance',
            'invoices.view',
            'reports.view', 'reports.export'
        ]
    },
    {
        name: 'Cajero',
        description: 'Basic POS operations',
        isSystem: true,
        permissions: [
            'pos.access', 'pos.sell',
            'shifts.open', 'shifts.close',
            'inventory.view',
            'catalog.view',
            'customers.view'
        ]
    }
];
