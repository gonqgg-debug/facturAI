/**
 * Zod Validation Schemas
 * 
 * Comprehensive input validation for all core data models.
 * Use these schemas to validate user input before saving to IndexedDB.
 */

import { z } from 'zod';

// ============ COMMON SCHEMAS ============

/** Currency validation (DOP or USD) */
export const currencySchema = z.enum(['DOP', 'USD']);

/** RNC/Cédula validation (Dominican tax ID) */
export const rncSchema = z.string()
    .min(9, 'RNC must be at least 9 characters')
    .max(11, 'RNC cannot exceed 11 characters')
    .regex(/^[\d-]+$/, 'RNC can only contain numbers and hyphens')
    .optional();

/** Phone number validation */
export const phoneSchema = z.string()
    .regex(/^[\d\s\-\+\(\)]+$/, 'Invalid phone number format')
    .min(7, 'Phone number too short')
    .max(20, 'Phone number too long')
    .optional();

/** Email validation */
export const emailSchema = z.string()
    .email('Invalid email address')
    .max(255, 'Email too long')
    .optional();

/** Date string validation (ISO format or common formats) */
export const dateStringSchema = z.string()
    .min(8, 'Date too short')
    .max(25, 'Date too long')
    .refine((val) => !isNaN(Date.parse(val)), 'Invalid date format');

/** Optional date string */
export const optionalDateStringSchema = dateStringSchema.optional();

/** Positive number validation */
export const positiveNumberSchema = z.number()
    .nonnegative('Value must be positive or zero');

/** Tax rate validation (0, 0.16, 0.18) */
export const taxRateSchema = z.number()
    .min(0, 'Tax rate cannot be negative')
    .max(1, 'Tax rate cannot exceed 100%')
    .refine((val) => [0, 0.16, 0.18].includes(val) || val >= 0, 'Invalid tax rate');

/** Payment method types */
export const paymentMethodSchema = z.enum([
    'cash', 'bank_transfer', 'check', 'credit_card', 
    'debit_card', 'mobile_payment', 'other'
]);

// ============ INVOICE SCHEMAS ============

/** Invoice item schema */
export const invoiceItemSchema = z.object({
    description: z.string()
        .min(1, 'Description is required')
        .max(500, 'Description too long'),
    productId: z.string().optional(),
    quantity: z.number()
        .positive('Quantity must be positive')
        .max(999999, 'Quantity too large'),
    unitPrice: positiveNumberSchema,
    taxRate: taxRateSchema.optional(),
    priceIncludesTax: z.boolean().optional(),
    value: positiveNumberSchema,
    itbis: positiveNumberSchema,
    amount: positiveNumberSchema
});

/** NCF (Número de Comprobante Fiscal) validation */
export const ncfSchema = z.string()
    .regex(/^[A-Z]\d{10,11}$|^E\d{10}$|^B\d{10}$/, 'Invalid NCF format')
    .optional()
    .or(z.literal(''));

/** Full invoice schema */
export const invoiceSchema = z.object({
    id: z.number().optional(),
    providerName: z.string()
        .min(1, 'Provider name is required')
        .max(255, 'Provider name too long'),
    providerRnc: rncSchema.or(z.literal('')),
    clientName: z.string().max(255).optional(),
    clientRnc: rncSchema,
    issueDate: dateStringSchema,
    dueDate: optionalDateStringSchema,
    ncf: z.string().max(20).optional().or(z.literal('')),
    currency: currencySchema,
    items: z.array(invoiceItemSchema).min(0),
    subtotal: positiveNumberSchema,
    discount: positiveNumberSchema.default(0),
    itbisTotal: positiveNumberSchema,
    total: positiveNumberSchema,
    rawText: z.string().max(50000).default(''),
    imageUrl: z.string().url().optional().or(z.literal('')),
    status: z.enum(['draft', 'verified', 'exported', 'needs_extraction']),
    category: z.enum(['Inventory', 'Utilities', 'Maintenance', 'Payroll', 'Other']).optional(),
    createdAt: z.date().or(z.string().transform(s => new Date(s))),
    securityCode: z.string().max(500).optional(),
    isEcf: z.boolean().optional(),
    qrUrl: z.string().url().optional().or(z.literal('')),
    reasoning: z.string().max(5000).optional(),
    paymentStatus: z.enum(['pending', 'partial', 'paid', 'overdue']).optional(),
    paidDate: optionalDateStringSchema,
    paidAmount: positiveNumberSchema.optional(),
    creditDays: z.number().int().min(0).max(365).optional(),
    receiptId: z.number().optional()
});

/** Invoice creation (without id) */
export const createInvoiceSchema = invoiceSchema.omit({ id: true });

// ============ PRODUCT SCHEMAS ============

/** Barcode validation (EAN-13, UPC, etc.) */
export const barcodeSchema = z.string()
    .regex(/^[\d\w-]+$/, 'Invalid barcode format')
    .min(3, 'Barcode too short')
    .max(50, 'Barcode too long')
    .optional();

/** Product schema */
export const productSchema = z.object({
    id: z.number().optional(),
    productId: z.string().max(50).optional(),
    barcode: barcodeSchema,
    supplierId: z.number().optional(),
    name: z.string()
        .min(1, 'Product name is required')
        .max(255, 'Product name too long'),
    aliases: z.array(z.string().max(100)).max(20).optional(),
    category: z.string().max(100).optional(),
    
    // Pricing & Costs
    lastPrice: positiveNumberSchema,
    lastDate: dateStringSchema,
    averageCost: positiveNumberSchema.optional(),
    costIncludesTax: z.boolean().optional(),
    costTaxRate: taxRateSchema.optional(),
    sellingPrice: positiveNumberSchema.optional(),
    priceIncludesTax: z.boolean().optional(),
    taxRate: taxRateSchema.optional(),
    isExempt: z.boolean().optional(),
    targetMargin: z.number().min(0).max(5).optional(), // 0-500% margin
    
    // Inventory
    currentStock: z.number().int().optional(),
    reorderPoint: z.number().int().min(0).optional(),
    lastStockUpdate: optionalDateStringSchema,
    
    // Sales Data
    salesVolume: z.number().int().min(0).optional(),
    salesVelocity: z.number().min(0).optional(),
    lastSaleDate: optionalDateStringSchema,
    
    // AI Analysis
    aiSuggestedPrice: positiveNumberSchema.optional(),
    aiSuggestedMargin: z.number().min(0).max(5).optional(),
    aiReasoning: z.string().max(5000).optional(),
    aiAnalystRating: z.enum(['BUY', 'SELL', 'HOLD']).optional(),
    aiCreativeIdea: z.string().max(2000).optional()
});

/** Product creation */
export const createProductSchema = productSchema.omit({ id: true });

/** Product update (all fields optional except id) */
export const updateProductSchema = productSchema.partial().required({ id: true });

// ============ SUPPLIER SCHEMAS ============

/** Supplier schema */
export const supplierSchema = z.object({
    id: z.number().optional(),
    name: z.string()
        .min(1, 'Supplier name is required')
        .max(255, 'Supplier name too long'),
    rnc: rncSchema.or(z.literal('')),
    alias: z.array(z.string().max(100)).max(10).optional(),
    customRules: z.string().max(10000).optional(),
    examples: z.array(z.any()).optional(), // Invoice examples
    defaultCreditDays: z.number().int().min(0).max(365).optional(),
    
    // Type
    supplierType: z.enum(['individual', 'company']).optional(),
    taxpayerType: z.string().max(100).optional(),
    
    // Contact Information
    phone: phoneSchema,
    mobile: phoneSchema,
    email: emailSchema,
    contactPerson: z.string().max(255).optional(),
    contactPhone: phoneSchema,
    
    // Address
    address: z.string().max(500).optional(),
    address2: z.string().max(500).optional(),
    city: z.string().max(100).optional(),
    state: z.string().max(100).optional(),
    postalCode: z.string().max(20).optional(),
    country: z.string().max(100).optional(),
    
    // Business Details
    website: z.string().url().optional().or(z.literal('')),
    notes: z.string().max(5000).optional(),
    tags: z.array(z.string().max(50)).max(20).optional(),
    category: z.enum(['Distributor', 'Manufacturer', 'Wholesaler', 'Service', 'Other']).optional(),
    isActive: z.boolean().optional(),
    createdAt: z.date().optional()
});

/** Supplier creation */
export const createSupplierSchema = supplierSchema.omit({ id: true });

// ============ CUSTOMER SCHEMAS ============

/** Customer schema */
export const customerSchema = z.object({
    id: z.number().optional(),
    name: z.string()
        .min(1, 'Customer name is required')
        .max(255, 'Customer name too long'),
    type: z.enum(['retail', 'wholesale', 'corporate']),
    rnc: rncSchema,
    phone: phoneSchema,
    email: emailSchema,
    address: z.string().max(500).optional(),
    creditLimit: positiveNumberSchema.optional(),
    currentBalance: z.number().optional(), // Can be negative
    isActive: z.boolean(),
    notes: z.string().max(5000).optional(),
    createdAt: z.date().or(z.string().transform(s => new Date(s)))
});

/** Customer creation */
export const createCustomerSchema = customerSchema.omit({ id: true });

// ============ SALE SCHEMAS ============

/** Sale schema */
export const saleSchema = z.object({
    id: z.number().optional(),
    date: dateStringSchema,
    customerId: z.number().optional(),
    customerName: z.string().max(255).optional(),
    
    // Items
    items: z.array(invoiceItemSchema).min(1, 'Sale must have at least one item'),
    
    // Totals
    subtotal: positiveNumberSchema,
    discount: positiveNumberSchema.default(0),
    itbisTotal: positiveNumberSchema,
    total: positiveNumberSchema,
    
    // Payment info
    paymentMethod: paymentMethodSchema,
    paymentStatus: z.enum(['pending', 'partial', 'paid']),
    paidAmount: positiveNumberSchema,
    
    // Shift/Register
    shiftId: z.number().optional(),
    receiptNumber: z.string().max(50).optional(),
    
    // User tracking
    cashierId: z.number().optional(),
    cashierName: z.string().max(255).optional(),
    
    // Returns tracking
    hasReturns: z.boolean().optional(),
    returnedAmount: positiveNumberSchema.optional(),
    
    // Metadata
    notes: z.string().max(2000).optional(),
    createdAt: z.date().or(z.string().transform(s => new Date(s)))
});

/** Sale creation */
export const createSaleSchema = saleSchema.omit({ id: true });

// ============ USER SCHEMAS ============

/** PIN validation (4-6 digits) */
export const pinSchema = z.string()
    .regex(/^\d{4,6}$/, 'PIN must be 4-6 digits');

/** Username validation */
export const usernameSchema = z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username too long')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores');

/** User schema */
export const userSchema = z.object({
    id: z.number().optional(),
    username: usernameSchema,
    displayName: z.string()
        .min(1, 'Display name is required')
        .max(100, 'Display name too long'),
    pin: pinSchema,
    roleId: z.number().int().positive('Role is required'),
    roleName: z.string().max(100).optional(),
    email: emailSchema,
    phone: phoneSchema,
    isActive: z.boolean(),
    lastLogin: z.date().optional(),
    createdAt: z.date().or(z.string().transform(s => new Date(s))),
    createdBy: z.number().optional()
});

/** User creation */
export const createUserSchema = userSchema.omit({ id: true, lastLogin: true });

/** User login */
export const loginSchema = z.object({
    username: usernameSchema.or(z.string().min(1)),
    pin: pinSchema
});

// ============ PAYMENT SCHEMAS ============

/** Payment schema */
export const paymentSchema = z.object({
    id: z.number().optional(),
    invoiceId: z.number().optional(),
    saleId: z.number().optional(),
    returnId: z.number().optional(),
    supplierId: z.number().optional(),
    customerId: z.number().optional(),
    
    amount: positiveNumberSchema,
    currency: currencySchema,
    paymentDate: dateStringSchema,
    
    paymentMethod: paymentMethodSchema,
    bankAccountId: z.number().optional(),
    checkNumber: z.string().max(50).optional(),
    referenceNumber: z.string().max(100).optional(),
    
    isRefund: z.boolean().optional(),
    notes: z.string().max(2000).optional(),
    createdAt: z.date().or(z.string().transform(s => new Date(s)))
});

/** Payment creation */
export const createPaymentSchema = paymentSchema.omit({ id: true });

// ============ RETURN SCHEMAS ============

/** Return item schema */
export const returnItemSchema = z.object({
    description: z.string()
        .min(1, 'Description is required')
        .max(500, 'Description too long'),
    productId: z.string().optional(),
    quantity: z.number()
        .positive('Quantity must be positive')
        .max(999999, 'Quantity too large'),
    unitPrice: positiveNumberSchema,
    taxRate: taxRateSchema.optional(),
    value: positiveNumberSchema,
    itbis: positiveNumberSchema,
    amount: positiveNumberSchema,
    originalSaleItemIndex: z.number().int().min(0).optional()
});

/** Return schema */
export const returnSchema = z.object({
    id: z.number().optional(),
    date: dateStringSchema,
    originalSaleId: z.number().int().positive('Original sale is required'),
    originalReceiptNumber: z.string().max(50).optional(),
    customerId: z.number().optional(),
    customerName: z.string().max(255).optional(),
    
    items: z.array(returnItemSchema).min(1, 'Return must have at least one item'),
    
    subtotal: positiveNumberSchema,
    itbisTotal: positiveNumberSchema,
    total: positiveNumberSchema,
    
    refundMethod: paymentMethodSchema,
    refundStatus: z.enum(['pending', 'completed']),
    
    reason: z.enum(['defective', 'wrong_item', 'customer_changed_mind', 'damaged', 'expired', 'other']),
    reasonNotes: z.string().max(1000).optional(),
    
    shiftId: z.number().optional(),
    processedBy: z.number().optional(),
    processedByName: z.string().max(255).optional(),
    
    createdAt: z.date().or(z.string().transform(s => new Date(s)))
});

/** Return creation */
export const createReturnSchema = returnSchema.omit({ id: true });

// ============ CASH REGISTER SHIFT SCHEMAS ============

/** Cash register shift schema */
export const cashRegisterShiftSchema = z.object({
    id: z.number().optional(),
    shiftNumber: z.string()
        .min(1, 'Shift number is required')
        .max(50, 'Shift number too long'),
    cashierId: z.number().optional(),
    cashierName: z.string().max(255).optional(),
    
    openedAt: z.date().or(z.string().transform(s => new Date(s))),
    openingCash: positiveNumberSchema,
    
    closedAt: z.date().optional().or(z.string().transform(s => new Date(s)).optional()),
    closingCash: positiveNumberSchema.optional(),
    expectedCash: positiveNumberSchema.optional(),
    cashDifference: z.number().optional(),
    
    totalSales: positiveNumberSchema.optional(),
    totalCashSales: positiveNumberSchema.optional(),
    totalCardSales: positiveNumberSchema.optional(),
    totalTransferSales: positiveNumberSchema.optional(),
    totalCreditSales: positiveNumberSchema.optional(),
    salesCount: z.number().int().min(0).optional(),
    
    cashIn: positiveNumberSchema.optional(),
    cashOut: positiveNumberSchema.optional(),
    cashInNotes: z.string().max(500).optional(),
    cashOutNotes: z.string().max(500).optional(),
    
    status: z.enum(['open', 'closed']),
    closingNotes: z.string().max(2000).optional()
});

/** Open shift schema */
export const openShiftSchema = z.object({
    openingCash: positiveNumberSchema,
    cashierId: z.number().optional(),
    cashierName: z.string().max(255).optional()
});

/** Close shift schema */
export const closeShiftSchema = z.object({
    closingCash: positiveNumberSchema,
    closingNotes: z.string().max(2000).optional()
});

// ============ BANK ACCOUNT SCHEMAS ============

/** Bank account schema */
export const bankAccountSchema = z.object({
    id: z.number().optional(),
    bankName: z.string()
        .min(1, 'Bank name is required')
        .max(100, 'Bank name too long'),
    accountName: z.string()
        .min(1, 'Account name is required')
        .max(255, 'Account name too long'),
    accountNumber: z.string()
        .min(4, 'Account number must be at least 4 characters')
        .max(50, 'Account number too long'),
    accountType: z.enum(['checking', 'savings', 'credit']),
    currency: currencySchema,
    isDefault: z.boolean().optional(),
    isActive: z.boolean().optional(),
    color: z.string().max(20).optional(),
    notes: z.string().max(500).optional()
});

// ============ GLOBAL CONTEXT SCHEMAS ============

/** Global context item schema (for AI context) */
export const globalContextItemSchema = z.object({
    id: z.number().optional(),
    title: z.string()
        .min(1, 'Title is required')
        .max(255, 'Title too long'),
    content: z.string()
        .min(1, 'Content is required')
        .max(100000, 'Content too long'),
    type: z.enum(['text', 'file']),
    category: z.enum(['tax', 'conversion', 'business_logic', 'pricing_rule']).optional(),
    fileName: z.string().max(255).optional(),
    fileType: z.enum(['pdf', 'excel', 'txt']).optional(),
    createdAt: z.date().or(z.string().transform(s => new Date(s))),
    usageCount: z.number().int().min(0).optional(),
    lastUsed: z.date().optional(),
    tags: z.array(z.string().max(50)).max(20).optional(),
    favorite: z.boolean().optional()
});

// ============ PURCHASE ORDER SCHEMAS ============

/** Purchase order item schema */
export const purchaseOrderItemSchema = z.object({
    productId: z.number().optional(),
    productName: z.string()
        .min(1, 'Product name is required')
        .max(255, 'Product name too long'),
    quantity: z.number()
        .positive('Quantity must be positive')
        .max(999999, 'Quantity too large'),
    unitPrice: positiveNumberSchema,
    taxRate: taxRateSchema.optional(),
    priceIncludesTax: z.boolean().optional(),
    value: positiveNumberSchema,
    itbis: positiveNumberSchema,
    amount: positiveNumberSchema,
    expectedDate: optionalDateStringSchema,
    notes: z.string().max(500).optional()
});

/** Purchase order schema */
export const purchaseOrderSchema = z.object({
    id: z.number().optional(),
    poNumber: z.string()
        .min(1, 'PO number is required')
        .max(50, 'PO number too long'),
    supplierId: z.number().int().positive('Supplier is required'),
    supplierName: z.string().max(255).optional(),
    orderDate: dateStringSchema,
    expectedDate: optionalDateStringSchema,
    status: z.enum(['draft', 'sent', 'partial', 'received', 'closed', 'cancelled']),
    items: z.array(purchaseOrderItemSchema).min(1, 'Order must have at least one item'),
    subtotal: positiveNumberSchema,
    itbisTotal: positiveNumberSchema,
    total: positiveNumberSchema,
    notes: z.string().max(2000).optional(),
    createdBy: z.number().optional(),
    createdAt: z.date().or(z.string().transform(s => new Date(s))),
    updatedAt: z.date().optional()
});

// ============ API INPUT SCHEMAS ============

/** Grok API request schema */
export const grokRequestSchema = z.object({
    imageBase64: z.string()
        .min(1, 'Image is required')
        .max(10000000, 'Image too large'), // ~7.5MB base64
    context: z.string().max(50000).optional(),
    hints: z.object({
        supplierName: z.string().max(255).optional(),
        total: z.number().optional(),
        itbis: z.number().optional(),
        isMultiPage: z.boolean().optional()
    }).optional()
});

/** Weather API request schema */
export const weatherRequestSchema = z.object({
    city: z.string()
        .min(1, 'City is required')
        .max(100, 'City name too long'),
    country: z.string().length(2, 'Country code must be 2 characters').optional()
});

// ============ FILE UPLOAD VALIDATION ============

/** File upload validation */
export const fileUploadSchema = z.object({
    name: z.string().max(255),
    size: z.number().max(20 * 1024 * 1024, 'File too large (max 20MB)'),
    type: z.string().refine(
        (type) => [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            'application/pdf',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain', 'text/csv'
        ].includes(type),
        'Invalid file type'
    )
});

// ============ UTILITY FUNCTIONS ============

/**
 * Validate data against a schema and return typed result
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): { 
    success: true; data: T 
} | { 
    success: false; errors: z.ZodError 
} {
    const result = schema.safeParse(data);
    if (result.success) {
        return { success: true, data: result.data };
    }
    return { success: false, errors: result.error };
}

/**
 * Get formatted error messages from Zod errors
 */
export function getErrorMessages(errors: z.ZodError): string[] {
    return errors.issues.map(issue => {
        const path = issue.path.join('.');
        return path ? `${path}: ${issue.message}` : issue.message;
    });
}

/**
 * Get error messages as a single string
 */
export function getErrorString(errors: z.ZodError): string {
    return getErrorMessages(errors).join('; ');
}

/**
 * Create a safe parser that returns undefined on failure
 */
export function safeParse<T>(schema: z.ZodSchema<T>, data: unknown): T | undefined {
    const result = schema.safeParse(data);
    return result.success ? result.data : undefined;
}

/**
 * Sanitize string input (trim, remove excessive whitespace)
 */
export function sanitizeString(input: string): string {
    return input
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[<>]/g, ''); // Basic XSS prevention
}

/**
 * Sanitize object string fields
 */
export function sanitizeStrings<T extends Record<string, unknown>>(obj: T): T {
    const result = { ...obj };
    for (const [key, value] of Object.entries(result)) {
        if (typeof value === 'string') {
            (result as Record<string, unknown>)[key] = sanitizeString(value);
        }
    }
    return result;
}

// ============ TYPE EXPORTS ============

export type InvoiceInput = z.infer<typeof invoiceSchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type SupplierInput = z.infer<typeof supplierSchema>;
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type CustomerInput = z.infer<typeof customerSchema>;
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type SaleInput = z.infer<typeof saleSchema>;
export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type UserInput = z.infer<typeof userSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type ReturnInput = z.infer<typeof returnSchema>;
export type CreateReturnInput = z.infer<typeof createReturnSchema>;
export type CashRegisterShiftInput = z.infer<typeof cashRegisterShiftSchema>;
export type OpenShiftInput = z.infer<typeof openShiftSchema>;
export type CloseShiftInput = z.infer<typeof closeShiftSchema>;
export type BankAccountInput = z.infer<typeof bankAccountSchema>;
export type GlobalContextItemInput = z.infer<typeof globalContextItemSchema>;
export type PurchaseOrderInput = z.infer<typeof purchaseOrderSchema>;
export type GrokRequestInput = z.infer<typeof grokRequestSchema>;
export type WeatherRequestInput = z.infer<typeof weatherRequestSchema>;
export type FileUploadInput = z.infer<typeof fileUploadSchema>;

