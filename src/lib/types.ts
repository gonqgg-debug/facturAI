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
    // FIFO cost tracking
    unitCost?: number;   // FIFO cost at time of movement
    totalCost?: number;  // Total cost for this movement
}

// ============ FIFO INVENTORY LAYERS ============

/**
 * Inventory Lot for FIFO costing
 * Each purchase creates a new lot with its cost
 * Sales consume from oldest lots first
 */
export interface InventoryLot {
    id?: string;
    productId: string;
    invoiceId?: string;           // Source purchase invoice
    receiptId?: string;           // Source receipt
    
    // Lot Details
    lotNumber?: string;           // Optional: supplier lot number
    purchaseDate: string;         // When purchased (FIFO sort key)
    expirationDate?: string;      // For perishables
    
    // FIFO Tracking
    originalQuantity: number;     // Initial quantity in this lot
    remainingQuantity: number;    // Current available quantity
    unitCost: number;             // Cost per unit (ex-tax)
    unitCostIncTax?: number;      // Cost per unit (inc-tax) for reference
    taxRate: number;              // ITBIS rate on purchase (0.18, 0.16, 0)
    
    // Status
    status: 'active' | 'depleted' | 'expired' | 'returned';
    createdAt: Date;
    depletedAt?: Date;
}

/**
 * Records each consumption of inventory lots
 * Links to sales, returns, or adjustments
 */
export interface CostConsumption {
    id?: string;
    saleId?: string;              // If from a sale
    returnId?: string;            // If from a return (negative consumption)
    adjustmentId?: string;        // If from stock adjustment (shrinkage/waste)
    
    // What was consumed
    lotId: string;                // Which lot was consumed
    productId: string;
    quantity: number;             // Quantity consumed from this lot
    unitCost: number;             // FIFO cost per unit
    totalCost: number;            // quantity * unitCost
    
    // When
    date: string;
    createdAt: Date;
}

// ============ DOUBLE-ENTRY JOURNAL SYSTEM ============

/**
 * Chart of Accounts for Dominican Republic Mini Market
 * Based on Dominican accounting standards
 */
export type AccountCode = 
    // Assets (1xxx)
    | '1101'  // Caja (Cash)
    | '1102'  // Bancos (Bank Accounts)
    | '1103'  // Cuentas por Cobrar Clientes (Accounts Receivable)
    | '1104'  // ITBIS Pagado (Input VAT / ITBIS Receivable)
    | '1105'  // Anticipos a Proveedores (Supplier Advances)
    | '1106'  // Cuentas por Cobrar Tarjetas (Card Receivables)
    | '1201'  // Inventario de Mercancías (Merchandise Inventory)
    // Liabilities (2xxx)
    | '2101'  // Cuentas por Pagar Proveedores (Accounts Payable)
    | '2102'  // ITBIS Por Pagar (Output VAT / ITBIS Payable)
    | '2103'  // ITBIS Retenido por Terceros (VAT Withheld by Card Processors)
    | '2104'  // Retenciones ISR (Income Tax Withholdings)
    // Revenue (4xxx)
    | '4101'  // Ventas de Mercancías (Sales Revenue)
    | '4102'  // Descuentos en Ventas (Sales Discounts - contra)
    | '4103'  // Devoluciones en Ventas (Sales Returns - contra)
    // Cost of Sales (5xxx)
    | '5101'  // Costo de Mercancía Vendida (Cost of Goods Sold)
    // Operating Expenses (6xxx)
    | '6101'  // Gastos por Merma/Rotura (Shrinkage/Breakage)
    | '6102'  // Gastos por Vencimiento (Expiration Losses)
    | '6103'  // Gastos por Pérdida/Robo (Theft/Loss)
    | '6104'  // Comisiones Bancarias/Tarjetas (Bank/Card Fees)
    | '6105'  // Gastos de Servicios Públicos (Utilities)
    | '6106'  // Gastos de Mantenimiento (Maintenance)
    | '6107'  // Gastos de Nómina (Payroll)
    | '6199'  // Otros Gastos Operativos (Other Operating Expenses);

/**
 * Account names in Spanish (DR standard)
 */
export const ACCOUNT_NAMES: Record<AccountCode, string> = {
    '1101': 'Caja',
    '1102': 'Bancos',
    '1103': 'Cuentas por Cobrar Clientes',
    '1104': 'ITBIS Pagado',
    '1105': 'Anticipos a Proveedores',
    '1106': 'Cuentas por Cobrar Tarjetas',
    '1201': 'Inventario de Mercancías',
    '2101': 'Cuentas por Pagar Proveedores',
    '2102': 'ITBIS Por Pagar',
    '2103': 'ITBIS Retenido por Terceros',
    '2104': 'Retenciones ISR',
    '4101': 'Ventas de Mercancías',
    '4102': 'Descuentos en Ventas',
    '4103': 'Devoluciones en Ventas',
    '5101': 'Costo de Mercancía Vendida',
    '6101': 'Gastos por Merma/Rotura',
    '6102': 'Gastos por Vencimiento',
    '6103': 'Gastos por Pérdida/Robo',
    '6104': 'Comisiones Bancarias/Tarjetas',
    '6105': 'Gastos de Servicios Públicos',
    '6106': 'Gastos de Mantenimiento',
    '6107': 'Gastos de Nómina',
    '6199': 'Otros Gastos Operativos'
};

/**
 * A single line in a journal entry
 * Either debit OR credit should be non-zero, not both
 */
export interface JournalEntryLine {
    accountCode: AccountCode;
    accountName: string;          // Denormalized for display
    description?: string;         // Line-specific description
    
    debit: number;                // Debit amount (0 if credit)
    credit: number;               // Credit amount (0 if debit)
    
    // Tax breakdown (for ITBIS accounts)
    taxRate?: number;             // 0.18, 0.16, or 0
}

/**
 * Journal Entry - the core of double-entry accounting
 * Total debits must equal total credits
 */
export interface JournalEntry {
    id?: string;
    entryNumber: string;          // Sequential: JE-2024-00001
    date: string;                 // Entry date (YYYY-MM-DD)
    description: string;          // Entry description
    
    // Source reference - what created this entry
    sourceType: 'sale' | 'purchase' | 'adjustment' | 'card_settlement' | 'shift_close' | 'return' | 'manual';
    sourceId?: string;            // ID of the source document
    shiftId?: number;             // If related to a shift
    
    // Entry lines (minimum 2)
    lines: JournalEntryLine[];
    
    // Totals (must be equal for valid entry)
    totalDebit: number;
    totalCredit: number;
    
    // Status
    status: 'draft' | 'posted' | 'voided';
    postedAt?: Date;
    postedBy?: string;
    voidedAt?: Date;
    voidedBy?: string;
    voidReason?: string;
    
    // Metadata
    createdAt: Date;
    createdBy?: string;
}

// ============ FINANCIAL REPORTING ============

export interface AccountBalance {
    account: AccountCode;
    name: string;
    debit: number;
    credit: number;
    balance: number;
}

export interface IncomeStatement {
    period: { start: string; end: string };
    revenue: { account: AccountCode; name: string; amount: number }[];
    totalRevenue: number;
    costOfGoodsSold: number;
    grossProfit: number;
    operatingExpenses: { account: AccountCode; name: string; amount: number }[];
    totalExpenses: number;
    netIncome: number;
}

export interface BalanceSheet {
    asOfDate: string;
    assets: { current: AccountBalance[]; total: number };
    liabilities: { current: AccountBalance[]; total: number };
    equity: { retained: number; total: number };
}

export interface CashFlowStatement {
    period: { start: string; end: string };
    operating: { label: string; amount: number }[];
    investing: { label: string; amount: number }[];
    financing: { label: string; amount: number }[];
    netChange: number;
    beginningCash: number;
    endingCash: number;
}

export interface AgingBucket {
    current: number;      // 0-30 days
    days31to60: number;
    days61to90: number;
    over90: number;
    total: number;
}

export interface ARAgingReport {
    customers: { id: string; name: string; aging: AgingBucket }[];
    totals: AgingBucket;
}

export interface APAgingReport {
    suppliers: { id: string; name: string; aging: AgingBucket }[];
    totals: AgingBucket;
}

// ============ NCF (TAX RECEIPT) ============

export type NCFType = 'B01' | 'B02' | 'B03' | 'B04' | 'B11' | 'B13' | 'B14' | 'B15';

export interface NCFRange {
    id?: string;
    type: NCFType;
    prefix: string;
    startNumber: number;
    endNumber: number;
    currentNumber: number;
    expirationDate: string;
    isActive: boolean;
    createdAt: Date;
}

export interface NCFUsage {
    id?: string;
    ncf: string;
    type: NCFType;
    saleId?: string;
    customerId?: string;
    issuedAt: Date;
    amount: number;
    voided: boolean;
    voidedAt?: Date;
    voidReason?: string;
}

// ============ ACCOUNTING AUDIT LOG ============

export type AuditAction =
    | 'journal_entry_created'
    | 'journal_entry_voided'
    | 'ncf_issued'
    | 'ncf_voided'
    | 'period_closed'
    | 'period_reopened'
    | 'itbis_recalculated'
    | 'settlement_created'
    | 'fifo_lot_created'
    | 'fifo_consumption';

export interface AccountingAuditEntry {
    id?: string;
    timestamp: Date;
    action: AuditAction;
    entityType: 'journal_entry' | 'ncf' | 'itbis_period' | 'settlement' | 'fifo_lot';
    entityId: string;
    userId?: number;
    userName?: string;
    details: Record<string, unknown>;
    previousState?: Record<string, unknown>;
}

// ============ ITBIS TRACKING ============

/**
 * Monthly ITBIS Summary for tax reporting
 * Tracks collected (payable) and paid (receivable) ITBIS by rate
 */
export interface ITBISSummary {
    id?: string;
    period: string;               // YYYY-MM format
    
    // ITBIS Collected from Sales (Liability - must pay to DGII)
    itbis18Collected: number;     // 18% rate collected
    itbis16Collected: number;     // 16% rate collected
    salesExempt: number;          // Exempt sales amount (for reporting)
    totalItbisCollected: number;  // Sum of collected
    
    // ITBIS Paid on Purchases (Asset - credit against payable)
    itbis18Paid: number;          // 18% rate paid
    itbis16Paid: number;          // 16% rate paid
    purchasesExempt: number;      // Exempt purchases amount
    totalItbisPaid: number;       // Sum of paid
    
    // ITBIS Retained by Third Parties (Card processors, etc.)
    itbisRetainedByCards: number; // 2% retention by card processors
    otherRetentions: number;      // Other withholdings
    totalItbisRetained: number;   // Sum of retained
    
    // Calculated: Net ITBIS Due to DGII
    // = Collected - Paid - Retained
    netItbisDue: number;
    
    // Filing status
    status: 'open' | 'closed' | 'filed';
    filedAt?: Date;
    dgiiConfirmation?: string;    // DGII confirmation number
    
    // Metadata
    createdAt: Date;
    updatedAt?: Date;
}

// ============ CARD SETTLEMENT ============

/**
 * Card payment settlement record
 * Tracks pending card sales and their reconciliation
 */
export interface CardSettlement {
    id?: string;
    
    // Settlement period
    settlementDate: string;       // Date of bank deposit
    periodStart: string;          // Start of sales period
    periodEnd: string;            // End of sales period
    
    // Amounts
    grossAmount: number;          // Total card sales
    commissionRate: number;       // e.g., 0.038 for 3.8%
    commissionAmount: number;     // Gross * commissionRate
    itbisRetentionRate: number;   // Standard 0.02 (2%) ITBIS retention
    itbisRetentionAmount: number; // Gross * itbisRetentionRate
    netDeposit: number;           // Gross - commission - retention
    
    // Bank info
    bankAccountId?: string;
    depositReference?: string;    // Bank reference number
    
    // Related sales
    saleIds: string[];            // IDs of sales included
    
    // Journal entry created
    journalEntryId?: string;
    
    // Status
    status: 'pending' | 'reconciled' | 'disputed';
    reconciledAt?: Date;
    
    // Metadata
    notes?: string;
    createdAt: Date;
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
    ncf?: string;              // Assigned tax receipt number (optional)
    
    // Items
    items: InvoiceItem[];      // Reusing InvoiceItem structure
    
    // Totals
    subtotal: number;
    discount: number;
    itbisTotal: number;
    total: number;
    
    // Payment info
    paymentMethod: PaymentMethodType;
    paymentStatus: 'pending' | 'partial' | 'paid' | 'delivery';
    paidAmount: number;
    
    // Delivery info
    isDelivery?: boolean;           // True if this is a delivery order
    deliveryAddress?: string;       // Delivery address
    deliveryPhone?: string;         // Contact phone for delivery
    deliveryNotes?: string;         // Special delivery instructions
    deliveredAt?: Date;             // When delivery was completed
    deliveredBy?: string;           // Who made the delivery
    
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
    cogsTotal?: number;
    grossMargin?: number;
    cogsJournalEntryId?: string;
    
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
    
    // Multi-tenant sync support
    realmId?: string;           // Store/tenant ID for sync
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
    
    // Firebase linking (for full web access)
    firebaseUid?: string;       // Links to Firebase account
    hasFullAccess?: boolean;    // Can login via email (not just PIN)
    
    // Status
    isActive: boolean;
    lastLogin?: Date;
    
    // Metadata
    createdAt: Date;
    createdBy?: number;         // User who created this user
    
    // Multi-tenant sync support
    realmId?: string;           // Store/tenant ID for sync
}

// ============ TEAM INVITES ============

export type InviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface TeamInvite {
    id?: string;
    userId: number;              // The local user being invited
    email: string;               // Email to send invite to
    token: string;               // Unique invite token
    storeId: string;             // Store this invite belongs to
    invitedBy: number;           // User ID of inviter
    status: InviteStatus;
    createdAt: Date;
    expiresAt: Date;             // 7 days from creation
    acceptedAt?: Date;
}

// ============ RECEIPT SETTINGS ============

export interface ReceiptSettings {
    id?: string;
    // Business Info
    businessName: string;
    rnc: string;
    address: string;
    phone: string;
    email: string;
    website: string;
    
    // Display Options
    showLogo: boolean;
    logoUrl: string;
    showRnc: boolean;
    showAddress: boolean;
    showPhone: boolean;
    showEmail: boolean;
    showWebsite: boolean;
    
    // Receipt Content
    showNcf: boolean;
    showShiftNumber: boolean;
    showCashierName: boolean;
    showItemSku: boolean;
    showTaxBreakdown: boolean;
    showPaymentDetails: boolean;
    
    // Footer
    footerLine1: string;
    footerLine2: string;
    footerLine3: string;
    showNoReturnsPolicy: boolean;
    noReturnsPolicyText: string;
    
    // Formatting
    paperWidth: '58mm' | '80mm';
    fontSize: 'small' | 'medium' | 'large';
    
    // Timestamps
    createdAt?: Date;
    updatedAt?: Date;
}

export const DEFAULT_RECEIPT_SETTINGS: ReceiptSettings = {
    businessName: 'Mi Negocio',
    rnc: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    showLogo: false,
    logoUrl: '',
    showRnc: true,
    showAddress: true,
    showPhone: true,
    showEmail: false,
    showWebsite: false,
    showNcf: true,
    showShiftNumber: true,
    showCashierName: true,
    showItemSku: false,
    showTaxBreakdown: true,
    showPaymentDetails: true,
    footerLine1: '¡Gracias por su compra!',
    footerLine2: 'Vuelva pronto',
    footerLine3: '',
    showNoReturnsPolicy: true,
    noReturnsPolicyText: 'No se aceptan devoluciones sin recibo',
    paperWidth: '80mm',
    fontSize: 'medium'
};

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
