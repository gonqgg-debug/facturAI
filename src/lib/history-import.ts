/**
 * Store History Import System
 * 
 * Handles importing historical data from CSV/Excel files:
 * - Products
 * - Sales
 * - Customers
 * - Suppliers
 * - Purchase Invoices
 * 
 * Features:
 * - Column mapping with auto-detection
 * - Data validation and preview
 * - Progress tracking
 * - Error reporting
 */

import * as XLSX from 'xlsx';
import { db, generateId } from './db';
import type { Product, Sale, Customer, Supplier, Invoice, InvoiceItem } from './types';

// ============ TYPES ============

export type ImportType = 'products' | 'sales' | 'customers' | 'suppliers' | 'invoices';

export interface ColumnMapping {
    sourceColumn: string;
    targetField: string;
    required: boolean;
    transform?: (value: unknown) => unknown;
}

export interface ImportPreview {
    headers: string[];
    rows: Record<string, unknown>[];
    totalRows: number;
    sampleRows: Record<string, unknown>[];
    suggestedMappings: Record<string, string>;
}

export interface ValidationError {
    row: number;
    field: string;
    message: string;
    value?: unknown;
}

export interface ImportProgress {
    stage: string;
    percent: number;
    currentRow?: number;
    totalRows?: number;
}

export interface ImportResult {
    success: boolean;
    imported: number;
    updated: number;
    skipped: number;
    errors: ValidationError[];
    warnings: string[];
}

// ============ FIELD DEFINITIONS ============

export const PRODUCT_FIELDS: { field: string; label: string; labelEs: string; required: boolean; aliases: string[] }[] = [
    { field: 'name', label: 'Product Name', labelEs: 'Nombre del Producto', required: true, aliases: ['name', 'producto', 'product', 'descripcion', 'description', 'item', 'articulo'] },
    { field: 'productId', label: 'SKU / Code', labelEs: 'Código / SKU', required: false, aliases: ['sku', 'codigo', 'code', 'productid', 'id', 'ref', 'referencia'] },
    { field: 'barcode', label: 'Barcode', labelEs: 'Código de Barras', required: false, aliases: ['barcode', 'codigobarras', 'ean', 'upc', 'gtin'] },
    { field: 'category', label: 'Category', labelEs: 'Categoría', required: false, aliases: ['category', 'categoria', 'cat', 'tipo', 'type', 'grupo', 'group'] },
    { field: 'supplierName', label: 'Supplier', labelEs: 'Proveedor', required: false, aliases: ['supplier', 'proveedor', 'suplidor', 'vendor', 'vendedor'] },
    { field: 'lastPrice', label: 'Cost Price', labelEs: 'Precio de Costo', required: false, aliases: ['cost', 'costo', 'precio_costo', 'costprice', 'lastprice', 'precio_compra', 'purchaseprice'] },
    { field: 'sellingPrice', label: 'Selling Price', labelEs: 'Precio de Venta', required: false, aliases: ['price', 'precio', 'sellingprice', 'precio_venta', 'retail', 'pvp', 'saleprice'] },
    { field: 'currentStock', label: 'Stock Quantity', labelEs: 'Cantidad en Stock', required: false, aliases: ['stock', 'cantidad', 'quantity', 'qty', 'inventario', 'inventory', 'existencia'] },
    { field: 'reorderPoint', label: 'Reorder Point', labelEs: 'Punto de Reorden', required: false, aliases: ['reorderpoint', 'minstock', 'stockminimo', 'min', 'minimum'] },
    { field: 'taxRate', label: 'Tax Rate (%)', labelEs: 'Tasa de Impuesto (%)', required: false, aliases: ['taxrate', 'tax', 'impuesto', 'itbis', 'iva', 'vat'] },
];

export const SALE_FIELDS: { field: string; label: string; labelEs: string; required: boolean; aliases: string[] }[] = [
    { field: 'date', label: 'Sale Date', labelEs: 'Fecha de Venta', required: true, aliases: ['date', 'fecha', 'saledate', 'fecha_venta', 'transactiondate'] },
    { field: 'total', label: 'Total Amount', labelEs: 'Monto Total', required: true, aliases: ['total', 'amount', 'monto', 'importe', 'valor', 'value'] },
    { field: 'subtotal', label: 'Subtotal', labelEs: 'Subtotal', required: false, aliases: ['subtotal', 'neto', 'net'] },
    { field: 'itbisTotal', label: 'Tax (ITBIS)', labelEs: 'ITBIS', required: false, aliases: ['itbis', 'tax', 'impuesto', 'iva', 'vat'] },
    { field: 'discount', label: 'Discount', labelEs: 'Descuento', required: false, aliases: ['discount', 'descuento', 'desc'] },
    { field: 'paymentMethod', label: 'Payment Method', labelEs: 'Método de Pago', required: false, aliases: ['paymentmethod', 'metodo_pago', 'payment', 'pago', 'forma_pago'] },
    { field: 'customerName', label: 'Customer Name', labelEs: 'Nombre del Cliente', required: false, aliases: ['customer', 'cliente', 'customername', 'nombre_cliente', 'client'] },
    { field: 'receiptNumber', label: 'Receipt Number', labelEs: 'Número de Recibo', required: false, aliases: ['receipt', 'recibo', 'invoice', 'factura', 'ticketnumber', 'ticket'] },
    { field: 'notes', label: 'Notes', labelEs: 'Notas', required: false, aliases: ['notes', 'notas', 'comments', 'comentarios', 'observaciones'] },
];

export const CUSTOMER_FIELDS: { field: string; label: string; labelEs: string; required: boolean; aliases: string[] }[] = [
    { field: 'name', label: 'Customer Name', labelEs: 'Nombre del Cliente', required: true, aliases: ['name', 'nombre', 'customer', 'cliente', 'fullname', 'nombrecompleto'] },
    { field: 'type', label: 'Type', labelEs: 'Tipo', required: false, aliases: ['type', 'tipo', 'customertype'] },
    { field: 'rnc', label: 'RNC / ID', labelEs: 'RNC / Cédula', required: false, aliases: ['rnc', 'cedula', 'taxid', 'ruc', 'nif', 'dni', 'id'] },
    { field: 'phone', label: 'Phone', labelEs: 'Teléfono', required: false, aliases: ['phone', 'telefono', 'tel', 'mobile', 'celular', 'movil'] },
    { field: 'email', label: 'Email', labelEs: 'Correo Electrónico', required: false, aliases: ['email', 'correo', 'mail', 'e-mail'] },
    { field: 'address', label: 'Address', labelEs: 'Dirección', required: false, aliases: ['address', 'direccion', 'domicilio'] },
    { field: 'creditLimit', label: 'Credit Limit', labelEs: 'Límite de Crédito', required: false, aliases: ['creditlimit', 'limite_credito', 'credit', 'credito'] },
    { field: 'notes', label: 'Notes', labelEs: 'Notas', required: false, aliases: ['notes', 'notas', 'comments', 'comentarios'] },
];

export const SUPPLIER_FIELDS: { field: string; label: string; labelEs: string; required: boolean; aliases: string[] }[] = [
    { field: 'name', label: 'Supplier Name', labelEs: 'Nombre del Proveedor', required: true, aliases: ['name', 'nombre', 'supplier', 'proveedor', 'suplidor', 'vendor'] },
    { field: 'rnc', label: 'RNC', labelEs: 'RNC', required: false, aliases: ['rnc', 'taxid', 'ruc', 'nif'] },
    { field: 'phone', label: 'Phone', labelEs: 'Teléfono', required: false, aliases: ['phone', 'telefono', 'tel'] },
    { field: 'email', label: 'Email', labelEs: 'Correo Electrónico', required: false, aliases: ['email', 'correo', 'mail'] },
    { field: 'address', label: 'Address', labelEs: 'Dirección', required: false, aliases: ['address', 'direccion'] },
    { field: 'contactPerson', label: 'Contact Person', labelEs: 'Persona de Contacto', required: false, aliases: ['contact', 'contacto', 'contactperson', 'persona_contacto'] },
    { field: 'category', label: 'Category', labelEs: 'Categoría', required: false, aliases: ['category', 'categoria', 'tipo', 'type'] },
    { field: 'defaultCreditDays', label: 'Credit Days', labelEs: 'Días de Crédito', required: false, aliases: ['creditdays', 'dias_credito', 'credit', 'plazo'] },
    { field: 'notes', label: 'Notes', labelEs: 'Notas', required: false, aliases: ['notes', 'notas'] },
];

export const INVOICE_FIELDS: { field: string; label: string; labelEs: string; required: boolean; aliases: string[] }[] = [
    { field: 'providerName', label: 'Supplier Name', labelEs: 'Nombre del Proveedor', required: true, aliases: ['supplier', 'proveedor', 'provider', 'vendor', 'suplidor'] },
    { field: 'issueDate', label: 'Invoice Date', labelEs: 'Fecha de Factura', required: true, aliases: ['date', 'fecha', 'issuedate', 'fecha_factura', 'invoicedate'] },
    { field: 'ncf', label: 'NCF', labelEs: 'NCF', required: false, aliases: ['ncf', 'invoice_number', 'numero_factura', 'factura', 'invoice'] },
    { field: 'total', label: 'Total', labelEs: 'Total', required: true, aliases: ['total', 'amount', 'monto', 'importe'] },
    { field: 'subtotal', label: 'Subtotal', labelEs: 'Subtotal', required: false, aliases: ['subtotal', 'neto', 'net'] },
    { field: 'itbisTotal', label: 'ITBIS', labelEs: 'ITBIS', required: false, aliases: ['itbis', 'tax', 'impuesto', 'iva'] },
    { field: 'providerRnc', label: 'Supplier RNC', labelEs: 'RNC Proveedor', required: false, aliases: ['rnc', 'supplier_rnc', 'rnc_proveedor', 'taxid'] },
    { field: 'dueDate', label: 'Due Date', labelEs: 'Fecha de Vencimiento', required: false, aliases: ['duedate', 'vencimiento', 'fecha_vencimiento'] },
    { field: 'paymentStatus', label: 'Payment Status', labelEs: 'Estado de Pago', required: false, aliases: ['status', 'estado', 'paymentstatus', 'estado_pago'] },
];

// ============ FILE PARSING ============

/**
 * Parse uploaded file (Excel or CSV) and return raw data
 */
export async function parseFile(file: File): Promise<{ headers: string[]; rows: Record<string, unknown>[] }> {
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    if (extension === 'csv') {
        return parseCSV(file);
    } else if (['xlsx', 'xls'].includes(extension || '')) {
        return parseExcel(file);
    } else {
        throw new Error(`Unsupported file type: ${extension}`);
    }
}

async function parseCSV(file: File): Promise<{ headers: string[]; rows: Record<string, unknown>[] }> {
    const text = await file.text();
    const workbook = XLSX.read(text, { type: 'string', raw: false });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
    const headers = jsonData.length > 0 ? Object.keys(jsonData[0]) : [];
    
    return { headers, rows: jsonData };
}

async function parseExcel(file: File): Promise<{ headers: string[]; rows: Record<string, unknown>[] }> {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array', cellDates: true, dateNF: 'yyyy-mm-dd' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
    const headers = jsonData.length > 0 ? Object.keys(jsonData[0]) : [];
    
    return { headers, rows: jsonData };
}

// ============ COLUMN MAPPING ============

/**
 * Get field definitions for a specific import type
 */
export function getFieldDefinitions(importType: ImportType) {
    switch (importType) {
        case 'products': return PRODUCT_FIELDS;
        case 'sales': return SALE_FIELDS;
        case 'customers': return CUSTOMER_FIELDS;
        case 'suppliers': return SUPPLIER_FIELDS;
        case 'invoices': return INVOICE_FIELDS;
    }
}

/**
 * Auto-detect column mappings based on header names
 */
export function suggestColumnMappings(headers: string[], importType: ImportType): Record<string, string> {
    const fields = getFieldDefinitions(importType);
    const mappings: Record<string, string> = {};
    
    console.log('[Import] suggestColumnMappings - headers:', headers);
    console.log('[Import] suggestColumnMappings - importType:', importType);
    
    for (const header of headers) {
        const normalizedHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '');
        console.log('[Import] Processing header:', header, '-> normalized:', normalizedHeader);
        
        for (const field of fields) {
            // Check if header matches field name or any alias
            const matches = [field.field.toLowerCase(), ...field.aliases.map(a => a.toLowerCase())];
            
            if (matches.some(m => normalizedHeader === m || normalizedHeader.includes(m) || m.includes(normalizedHeader))) {
                console.log('[Import] MATCHED:', header, '->', field.field);
                mappings[header] = field.field;
                break;
            }
        }
        
        if (!mappings[header]) {
            console.log('[Import] NO MATCH for:', header);
        }
    }
    
    console.log('[Import] Final mappings:', mappings);
    return mappings;
}

/**
 * Create import preview with sample data and suggested mappings
 */
export function createImportPreview(
    headers: string[],
    rows: Record<string, unknown>[],
    importType: ImportType
): ImportPreview {
    return {
        headers,
        rows,
        totalRows: rows.length,
        sampleRows: rows.slice(0, 5),
        suggestedMappings: suggestColumnMappings(headers, importType)
    };
}

// ============ DATA TRANSFORMATION ============

/**
 * Transform raw row data using column mappings
 */
function transformRow(
    row: Record<string, unknown>,
    mappings: Record<string, string>,
    importType: ImportType
): Record<string, unknown> {
    const transformed: Record<string, unknown> = {};
    
    for (const [sourceCol, targetField] of Object.entries(mappings)) {
        if (!targetField || targetField === 'skip') continue;
        
        let value = row[sourceCol];
        
        // Apply transformations based on field type
        if (value !== undefined && value !== null && value !== '') {
            // Number fields
            if (['lastPrice', 'sellingPrice', 'currentStock', 'reorderPoint', 'total', 'subtotal', 
                 'itbisTotal', 'discount', 'creditLimit', 'defaultCreditDays', 'taxRate'].includes(targetField)) {
                const numValue = typeof value === 'string' 
                    ? parseFloat(value.replace(/[^0-9.-]/g, ''))
                    : Number(value);
                value = isNaN(numValue) ? 0 : numValue;
                
                // Convert percentage to decimal for taxRate
                if (targetField === 'taxRate' && numValue > 1) {
                    value = numValue / 100;
                }
            }
            
            // Date fields
            if (['date', 'issueDate', 'dueDate'].includes(targetField)) {
                value = parseDate(value);
            }
            
            // Payment method normalization
            if (targetField === 'paymentMethod') {
                value = normalizePaymentMethod(String(value));
            }
            
            // Customer type normalization
            if (targetField === 'type' && importType === 'customers') {
                value = normalizeCustomerType(String(value));
            }
            
            // Supplier category normalization
            if (targetField === 'category' && importType === 'suppliers') {
                value = normalizeSupplierCategory(String(value));
            }
            
            // Payment status normalization
            if (targetField === 'paymentStatus') {
                value = normalizePaymentStatus(String(value));
            }
        }
        
        transformed[targetField] = value;
    }
    
    return transformed;
}

function parseDate(value: unknown): string {
    if (value instanceof Date) {
        return value.toISOString().split('T')[0];
    }
    
    if (typeof value === 'number') {
        // Excel date serial number
        const date = XLSX.SSF.parse_date_code(value);
        return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
    }
    
    if (typeof value === 'string') {
        // Try various date formats
        const dateStr = value.trim();
        
        // ISO format (YYYY-MM-DD)
        if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
            return dateStr.split('T')[0];
        }
        
        // DD/MM/YYYY or MM/DD/YYYY
        const slashMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
        if (slashMatch) {
            const [, a, b, c] = slashMatch;
            const year = c.length === 2 ? `20${c}` : c;
            // Assume DD/MM/YYYY for Dominican Republic
            return `${year}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
        }
        
        // Try native Date parsing
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) {
            return parsed.toISOString().split('T')[0];
        }
    }
    
    return new Date().toISOString().split('T')[0];
}

function normalizePaymentMethod(value: string): string {
    const normalized = value.toLowerCase().trim();
    
    if (['cash', 'efectivo', 'contado'].some(v => normalized.includes(v))) return 'cash';
    if (['card', 'tarjeta', 'credito', 'debito', 'credit', 'debit'].some(v => normalized.includes(v))) return 'credit_card';
    if (['transfer', 'transferencia', 'banco', 'bank'].some(v => normalized.includes(v))) return 'bank_transfer';
    if (['check', 'cheque'].some(v => normalized.includes(v))) return 'check';
    if (['mobile', 'movil', 'app'].some(v => normalized.includes(v))) return 'mobile_payment';
    
    return 'cash';
}

function normalizeCustomerType(value: string): 'retail' | 'wholesale' | 'corporate' {
    const normalized = value.toLowerCase().trim();
    
    if (['wholesale', 'mayorista', 'mayor'].some(v => normalized.includes(v))) return 'wholesale';
    if (['corporate', 'empresa', 'corporativo', 'business'].some(v => normalized.includes(v))) return 'corporate';
    
    return 'retail';
}

function normalizeSupplierCategory(value: string): string {
    const normalized = value.toLowerCase().trim();
    
    if (['distributor', 'distribuidor'].some(v => normalized.includes(v))) return 'Distributor';
    if (['manufacturer', 'fabricante', 'manufact'].some(v => normalized.includes(v))) return 'Manufacturer';
    if (['wholesale', 'mayorista'].some(v => normalized.includes(v))) return 'Wholesaler';
    if (['service', 'servicio'].some(v => normalized.includes(v))) return 'Service';
    
    return 'Other';
}

function normalizePaymentStatus(value: string): string {
    const normalized = value.toLowerCase().trim();
    
    if (['paid', 'pagado', 'pagada'].some(v => normalized.includes(v))) return 'paid';
    if (['partial', 'parcial'].some(v => normalized.includes(v))) return 'partial';
    if (['overdue', 'vencido', 'vencida'].some(v => normalized.includes(v))) return 'overdue';
    
    return 'pending';
}

// ============ VALIDATION ============

/**
 * Validate a single row of data
 */
function validateRow(
    row: Record<string, unknown>,
    rowIndex: number,
    importType: ImportType
): ValidationError[] {
    const errors: ValidationError[] = [];
    const fields = getFieldDefinitions(importType);
    
    // Check required fields
    for (const field of fields) {
        if (field.required) {
            const value = row[field.field];
            if (value === undefined || value === null || value === '') {
                errors.push({
                    row: rowIndex,
                    field: field.field,
                    message: `${field.label} is required`,
                    value
                });
            }
        }
    }
    
    // Type-specific validation
    if (importType === 'sales') {
        const total = row['total'] as number;
        if (total !== undefined && total < 0) {
            errors.push({
                row: rowIndex,
                field: 'total',
                message: 'Total cannot be negative',
                value: total
            });
        }
    }
    
    if (importType === 'products') {
        const stock = row['currentStock'] as number;
        if (stock !== undefined && stock < 0) {
            errors.push({
                row: rowIndex,
                field: 'currentStock',
                message: 'Stock cannot be negative',
                value: stock
            });
        }
    }
    
    return errors;
}

// ============ IMPORT FUNCTIONS ============

/**
 * Import products from mapped data
 */
async function importProducts(
    rows: Record<string, unknown>[],
    mappings: Record<string, string>,
    onProgress: (progress: ImportProgress) => void
): Promise<ImportResult> {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    
    // Load existing products and suppliers for matching
    const existingProducts = await db.products.toArray();
    const existingSuppliers = await db.suppliers.toArray();
    
    for (let i = 0; i < rows.length; i++) {
        onProgress({
            stage: 'Importing products',
            percent: Math.round((i / rows.length) * 100),
            currentRow: i + 1,
            totalRows: rows.length
        });
        
        const transformed = transformRow(rows[i], mappings, 'products');
        const rowErrors = validateRow(transformed, i + 1, 'products');
        
        if (rowErrors.length > 0) {
            errors.push(...rowErrors);
            skipped++;
            continue;
        }
        
        try {
            // Find or create supplier
            let supplierId: string | undefined;
            if (transformed.supplierName) {
                const supplierName = String(transformed.supplierName);
                let supplier = existingSuppliers.find(
                    s => s.name.toLowerCase() === supplierName.toLowerCase()
                );
                
                if (!supplier) {
                    const newSupplierId = generateId();
                    await db.suppliers.add({
                        id: newSupplierId,
                        name: supplierName,
                        rnc: '000000000',
                        examples: []
                    });
                    existingSuppliers.push({ id: newSupplierId, name: supplierName, rnc: '000000000', examples: [] });
                    supplierId = newSupplierId;
                    warnings.push(`Created new supplier: ${supplierName}`);
                } else {
                    supplierId = supplier.id;
                }
            }
            
            // Check for existing product by barcode, productId, or name
            let existingProduct = existingProducts.find(p => 
                (transformed.barcode && p.barcode === transformed.barcode) ||
                (transformed.productId && p.productId === transformed.productId) ||
                p.name.toLowerCase() === String(transformed.name).toLowerCase()
            );
            
            const productData: Partial<Product> = {
                name: String(transformed.name),
                productId: transformed.productId ? String(transformed.productId) : undefined,
                barcode: transformed.barcode ? String(transformed.barcode) : undefined,
                category: transformed.category ? String(transformed.category) : undefined,
                supplierId,
                lastPrice: (transformed.lastPrice as number) || 0,
                sellingPrice: transformed.sellingPrice as number | undefined,
                currentStock: (transformed.currentStock as number) ?? 0,
                reorderPoint: (transformed.reorderPoint as number) ?? 5,
                taxRate: transformed.taxRate as number | undefined,
                lastDate: new Date().toISOString().split('T')[0],
                lastStockUpdate: new Date().toISOString().split('T')[0]
            };
            
            if (existingProduct && existingProduct.id) {
                await db.products.update(existingProduct.id, productData);
                updated++;
            } else {
                await db.products.add({
                    id: generateId(),
                    ...productData
                } as Product);
                imported++;
            }
        } catch (err) {
            errors.push({
                row: i + 1,
                field: 'general',
                message: err instanceof Error ? err.message : 'Unknown error'
            });
            skipped++;
        }
    }
    
    return { success: errors.length === 0, imported, updated, skipped, errors, warnings };
}

/**
 * Import sales from mapped data
 */
async function importSales(
    rows: Record<string, unknown>[],
    mappings: Record<string, string>,
    onProgress: (progress: ImportProgress) => void
): Promise<ImportResult> {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    
    // Load existing customers for matching
    const existingCustomers = await db.customers.toArray();
    
    for (let i = 0; i < rows.length; i++) {
        onProgress({
            stage: 'Importing sales',
            percent: Math.round((i / rows.length) * 100),
            currentRow: i + 1,
            totalRows: rows.length
        });
        
        const transformed = transformRow(rows[i], mappings, 'sales');
        const rowErrors = validateRow(transformed, i + 1, 'sales');
        
        if (rowErrors.length > 0) {
            errors.push(...rowErrors);
            skipped++;
            continue;
        }
        
        try {
            // Find or create customer
            let customerId: string | undefined;
            if (transformed.customerName) {
                const customerName = String(transformed.customerName);
                let customer = existingCustomers.find(
                    c => c.name.toLowerCase() === customerName.toLowerCase()
                );
                
                if (!customer) {
                    const newCustomerId = generateId();
                    await db.customers.add({
                        id: newCustomerId,
                        name: customerName,
                        type: 'retail',
                        isActive: true,
                        createdAt: new Date()
                    });
                    existingCustomers.push({ 
                        id: newCustomerId, 
                        name: customerName, 
                        type: 'retail', 
                        isActive: true, 
                        createdAt: new Date() 
                    });
                    customerId = newCustomerId;
                    warnings.push(`Created new customer: ${customerName}`);
                } else {
                    customerId = customer.id;
                }
            }
            
            const total = (transformed.total as number) || 0;
            const subtotal = (transformed.subtotal as number) || total / 1.18; // Assume 18% ITBIS
            const itbisTotal = (transformed.itbisTotal as number) || total - subtotal;
            
            const saleData: Sale = {
                id: generateId(),
                date: transformed.date as string,
                customerId,
                customerName: transformed.customerName ? String(transformed.customerName) : undefined,
                items: [{
                    description: 'Imported sale',
                    quantity: 1,
                    unitPrice: subtotal,
                    value: subtotal,
                    itbis: itbisTotal,
                    amount: total
                }],
                subtotal,
                discount: (transformed.discount as number) || 0,
                itbisTotal,
                total,
                paymentMethod: (transformed.paymentMethod as string) || 'cash',
                paymentStatus: 'paid',
                paidAmount: total,
                receiptNumber: transformed.receiptNumber ? String(transformed.receiptNumber) : undefined,
                notes: transformed.notes ? String(transformed.notes) : undefined,
                createdAt: new Date()
            };
            
            await db.sales.add(saleData);
            imported++;
        } catch (err) {
            errors.push({
                row: i + 1,
                field: 'general',
                message: err instanceof Error ? err.message : 'Unknown error'
            });
            skipped++;
        }
    }
    
    return { success: errors.length === 0, imported, updated, skipped, errors, warnings };
}

/**
 * Import customers from mapped data
 */
async function importCustomers(
    rows: Record<string, unknown>[],
    mappings: Record<string, string>,
    onProgress: (progress: ImportProgress) => void
): Promise<ImportResult> {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    
    const existingCustomers = await db.customers.toArray();
    
    for (let i = 0; i < rows.length; i++) {
        onProgress({
            stage: 'Importing customers',
            percent: Math.round((i / rows.length) * 100),
            currentRow: i + 1,
            totalRows: rows.length
        });
        
        const transformed = transformRow(rows[i], mappings, 'customers');
        const rowErrors = validateRow(transformed, i + 1, 'customers');
        
        if (rowErrors.length > 0) {
            errors.push(...rowErrors);
            skipped++;
            continue;
        }
        
        try {
            const customerName = String(transformed.name);
            const existing = existingCustomers.find(
                c => c.name.toLowerCase() === customerName.toLowerCase() ||
                     (transformed.rnc && c.rnc === transformed.rnc)
            );
            
            const customerData: Partial<Customer> = {
                name: customerName,
                type: (transformed.type as 'retail' | 'wholesale' | 'corporate') || 'retail',
                rnc: transformed.rnc ? String(transformed.rnc) : undefined,
                phone: transformed.phone ? String(transformed.phone) : undefined,
                email: transformed.email ? String(transformed.email) : undefined,
                address: transformed.address ? String(transformed.address) : undefined,
                creditLimit: transformed.creditLimit as number | undefined,
                notes: transformed.notes ? String(transformed.notes) : undefined,
                isActive: true
            };
            
            if (existing && existing.id) {
                await db.customers.update(existing.id, customerData);
                updated++;
            } else {
                await db.customers.add({
                    id: generateId(),
                    ...customerData,
                    createdAt: new Date()
                } as Customer);
                imported++;
            }
        } catch (err) {
            errors.push({
                row: i + 1,
                field: 'general',
                message: err instanceof Error ? err.message : 'Unknown error'
            });
            skipped++;
        }
    }
    
    return { success: errors.length === 0, imported, updated, skipped, errors, warnings };
}

/**
 * Import suppliers from mapped data
 */
async function importSuppliers(
    rows: Record<string, unknown>[],
    mappings: Record<string, string>,
    onProgress: (progress: ImportProgress) => void
): Promise<ImportResult> {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    
    const existingSuppliers = await db.suppliers.toArray();
    
    for (let i = 0; i < rows.length; i++) {
        onProgress({
            stage: 'Importing suppliers',
            percent: Math.round((i / rows.length) * 100),
            currentRow: i + 1,
            totalRows: rows.length
        });
        
        const transformed = transformRow(rows[i], mappings, 'suppliers');
        const rowErrors = validateRow(transformed, i + 1, 'suppliers');
        
        if (rowErrors.length > 0) {
            errors.push(...rowErrors);
            skipped++;
            continue;
        }
        
        try {
            const supplierName = String(transformed.name);
            const existing = existingSuppliers.find(
                s => s.name.toLowerCase() === supplierName.toLowerCase() ||
                     (transformed.rnc && s.rnc === transformed.rnc)
            );
            
            const supplierData: Partial<Supplier> = {
                name: supplierName,
                rnc: transformed.rnc ? String(transformed.rnc) : '000000000',
                phone: transformed.phone ? String(transformed.phone) : undefined,
                email: transformed.email ? String(transformed.email) : undefined,
                address: transformed.address ? String(transformed.address) : undefined,
                contactPerson: transformed.contactPerson ? String(transformed.contactPerson) : undefined,
                category: transformed.category as Supplier['category'] | undefined,
                defaultCreditDays: transformed.defaultCreditDays as number | undefined,
                notes: transformed.notes ? String(transformed.notes) : undefined,
                isActive: true
            };
            
            if (existing && existing.id) {
                await db.suppliers.update(existing.id, supplierData);
                updated++;
            } else {
                await db.suppliers.add({
                    id: generateId(),
                    ...supplierData,
                    examples: [],
                    createdAt: new Date()
                } as Supplier);
                imported++;
            }
        } catch (err) {
            errors.push({
                row: i + 1,
                field: 'general',
                message: err instanceof Error ? err.message : 'Unknown error'
            });
            skipped++;
        }
    }
    
    return { success: errors.length === 0, imported, updated, skipped, errors, warnings };
}

/**
 * Import purchase invoices from mapped data
 */
async function importInvoices(
    rows: Record<string, unknown>[],
    mappings: Record<string, string>,
    onProgress: (progress: ImportProgress) => void
): Promise<ImportResult> {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    
    const existingSuppliers = await db.suppliers.toArray();
    
    for (let i = 0; i < rows.length; i++) {
        onProgress({
            stage: 'Importing invoices',
            percent: Math.round((i / rows.length) * 100),
            currentRow: i + 1,
            totalRows: rows.length
        });
        
        const transformed = transformRow(rows[i], mappings, 'invoices');
        const rowErrors = validateRow(transformed, i + 1, 'invoices');
        
        if (rowErrors.length > 0) {
            errors.push(...rowErrors);
            skipped++;
            continue;
        }
        
        try {
            // Find or create supplier
            const providerName = String(transformed.providerName);
            let supplier = existingSuppliers.find(
                s => s.name.toLowerCase() === providerName.toLowerCase()
            );
            
            if (!supplier) {
                const newSupplierId = generateId();
                const supplierData: Supplier = {
                    id: newSupplierId,
                    name: providerName,
                    rnc: transformed.providerRnc ? String(transformed.providerRnc) : '000000000',
                    examples: []
                };
                await db.suppliers.add(supplierData);
                existingSuppliers.push(supplierData);
                supplier = supplierData;
                warnings.push(`Created new supplier: ${providerName}`);
            }
            
            const total = (transformed.total as number) || 0;
            const subtotal = (transformed.subtotal as number) || total / 1.18;
            const itbisTotal = (transformed.itbisTotal as number) || total - subtotal;
            
            const invoiceData: Invoice = {
                id: generateId(),
                providerName,
                providerRnc: transformed.providerRnc ? String(transformed.providerRnc) : supplier.rnc,
                issueDate: transformed.issueDate as string,
                dueDate: transformed.dueDate as string | undefined,
                ncf: transformed.ncf ? String(transformed.ncf) : `IMP-${Date.now()}`,
                currency: 'DOP',
                items: [{
                    description: 'Imported invoice',
                    quantity: 1,
                    unitPrice: subtotal,
                    value: subtotal,
                    itbis: itbisTotal,
                    amount: total
                }],
                subtotal,
                discount: 0,
                itbisTotal,
                total,
                rawText: 'Imported from file',
                status: 'verified',
                paymentStatus: (transformed.paymentStatus as Invoice['paymentStatus']) || 'pending',
                createdAt: new Date()
            };
            
            await db.invoices.add(invoiceData);
            imported++;
        } catch (err) {
            errors.push({
                row: i + 1,
                field: 'general',
                message: err instanceof Error ? err.message : 'Unknown error'
            });
            skipped++;
        }
    }
    
    return { success: errors.length === 0, imported, updated, skipped, errors, warnings };
}

// ============ MAIN IMPORT FUNCTION ============

/**
 * Execute import with the specified type, data, and mappings
 */
export async function executeImport(
    importType: ImportType,
    rows: Record<string, unknown>[],
    mappings: Record<string, string>,
    onProgress: (progress: ImportProgress) => void
): Promise<ImportResult> {
    switch (importType) {
        case 'products':
            return importProducts(rows, mappings, onProgress);
        case 'sales':
            return importSales(rows, mappings, onProgress);
        case 'customers':
            return importCustomers(rows, mappings, onProgress);
        case 'suppliers':
            return importSuppliers(rows, mappings, onProgress);
        case 'invoices':
            return importInvoices(rows, mappings, onProgress);
    }
}

// ============ TEMPLATE GENERATION ============

/**
 * Generate a template Excel file for the specified import type
 */
export function generateTemplate(importType: ImportType, locale: 'en' | 'es' = 'es'): void {
    const fields = getFieldDefinitions(importType);
    
    // Create header row with localized labels
    const headers = fields.map(f => locale === 'es' ? f.labelEs : f.label);
    
    // Create sample data row
    const sampleData: Record<string, string> = {};
    fields.forEach(f => {
        const label = locale === 'es' ? f.labelEs : f.label;
        sampleData[label] = f.required ? `(${locale === 'es' ? 'Requerido' : 'Required'})` : '';
    });
    
    // Create worksheet
    const ws = XLSX.utils.json_to_sheet([sampleData], { header: headers });
    
    // Set column widths
    const colWidths = headers.map(h => ({ wch: Math.max(h.length + 2, 15) }));
    ws['!cols'] = colWidths;
    
    // Create workbook and download
    const wb = XLSX.utils.book_new();
    const sheetName = {
        products: locale === 'es' ? 'Productos' : 'Products',
        sales: locale === 'es' ? 'Ventas' : 'Sales',
        customers: locale === 'es' ? 'Clientes' : 'Customers',
        suppliers: locale === 'es' ? 'Proveedores' : 'Suppliers',
        invoices: locale === 'es' ? 'Facturas' : 'Invoices'
    }[importType];
    
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${importType}_template.xlsx`);
}

