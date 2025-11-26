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
    id?: number;
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
}

export interface Supplier {
    id?: number;
    name: string;
    rnc: string;
    alias?: string[];
    customRules?: string;
    examples: Invoice[];
    defaultCreditDays?: number; // Default credit days (e.g., 30 for Comercial Cristobal)
    
    // Contact Information
    phone?: string;
    email?: string;
    address?: string;
    city?: string;
    contactPerson?: string;
    contactPhone?: string;
    
    // Business Details
    website?: string;
    notes?: string;
    category?: 'Distributor' | 'Manufacturer' | 'Wholesaler' | 'Service' | 'Other';
    isActive?: boolean;
    createdAt?: Date;
}

export type PaymentMethodType = 'cash' | 'bank_transfer' | 'check' | 'credit_card' | 'debit_card' | 'mobile_payment' | 'other';

export interface BankAccount {
    id?: number;
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
    id?: number;
    invoiceId: number;
    supplierId?: number;
    
    // Payment Details
    amount: number;
    currency: 'DOP' | 'USD';
    paymentDate: string;
    
    // Method & Account
    paymentMethod: PaymentMethodType;
    bankAccountId?: number;   // If paid via bank
    checkNumber?: string;     // If paid by check
    referenceNumber?: string; // Transfer/transaction reference
    
    // Metadata
    notes?: string;
    createdAt: Date;
}

export interface KnowledgeBaseRule {
    id?: number;
    supplierId: number;
    rule: string;
    createdAt: Date;
}

export interface GlobalContextItem {
    id?: number;
    title: string;
    content: string; // Extracted text
    type: 'text' | 'file';
    category?: 'tax' | 'conversion' | 'business_logic' | 'pricing_rule';
    fileName?: string;
    fileType?: 'pdf' | 'excel' | 'txt';
    createdAt: Date;
}

export interface UserHints {
    supplierName?: string;
    total?: number;
    itbis?: number;
    isMultiPage?: boolean;
}

export interface Product {
    id?: number;
    productId?: string; // Custom SKU/Product ID
    barcode?: string;   // Barcode (EAN-13, UPC, etc.)
    supplierId?: number;
    name: string;
    aliases?: string[]; // Alternative names for fuzzy matching
    category?: string;

    // Pricing & Costs
    lastPrice: number; // Most recent purchase price
    lastDate: string;
    averageCost?: number;
    sellingPrice?: number;
    targetMargin?: number; // e.g. 0.30 for 30%

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
    id?: number;
    productId: number;
    type: 'in' | 'out' | 'adjustment';
    quantity: number;
    invoiceId?: number;  // Reference to invoice (if applicable)
    date: string;
    notes?: string;
}
