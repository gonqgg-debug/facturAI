/**
 * Double-Entry Journal System for Dominican Republic Accounting
 * 
 * Implements proper accounting entries for:
 * - Sales (Revenue recognition)
 * - COGS (Cost of Goods Sold)
 * - Inventory adjustments (Shrinkage, waste, expiration)
 * - Card payment settlements (Fees and ITBIS retention)
 * - Purchase invoice entries
 */

import { db, generateId } from './db';
import type { 
    JournalEntry, JournalEntryLine, AccountCode, 
    Sale, Invoice, CashRegisterShift,
    ACCOUNT_NAMES
} from './types';
import { getCOGSForShift } from './fifo';
import { logAccountingAction } from './accounting-audit';

// Re-export account names for convenience
export { ACCOUNT_NAMES } from './types';

// ============ JOURNAL ENTRY NUMBER GENERATION ============

/**
 * Generate a sequential journal entry number
 * Format: JE-YYYY-XXXXX
 */
export async function generateEntryNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const yearPrefix = `JE-${year}-`;
    
    // Count existing entries for this year
    const entries = await db.journalEntries
        .where('entryNumber')
        .startsWith(yearPrefix)
        .toArray();
    
    const nextNumber = entries.length + 1;
    return `${yearPrefix}${String(nextNumber).padStart(5, '0')}`;
}

// ============ HELPER FUNCTIONS ============

/**
 * Create a journal entry line
 */
function createLine(
    accountCode: AccountCode,
    debit: number,
    credit: number,
    description?: string,
    taxRate?: number
): JournalEntryLine {
    // Import ACCOUNT_NAMES dynamically to get the name
    const accountNames: Record<AccountCode, string> = {
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
    
    return {
        accountCode,
        accountName: accountNames[accountCode],
        description,
        debit: Number(debit.toFixed(2)),
        credit: Number(credit.toFixed(2)),
        taxRate
    };
}

/**
 * Validate that a journal entry balances (debits = credits)
 */
export function validateEntry(entry: JournalEntry): boolean {
    const totalDebit = entry.lines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredit = entry.lines.reduce((sum, line) => sum + line.credit, 0);
    
    // Allow for small rounding differences (0.01)
    return Math.abs(totalDebit - totalCredit) < 0.02;
}

// ============ SALE JOURNAL ENTRIES ============

/**
 * Create journal entry for a cash sale
 * 
 * Debit: Cash (1101)
 * Credit: Sales Revenue (4101)
 * Credit: ITBIS Payable (2102)
 */
export async function createCashSaleEntry(
    sale: Sale,
    createdBy?: string
): Promise<JournalEntry> {
    const lines: JournalEntryLine[] = [];
    
    // Debit: Cash received (total including ITBIS)
    lines.push(createLine('1101', sale.total, 0, `Venta efectivo #${sale.receiptNumber}`));
    
    // Credit: Sales revenue (net of ITBIS)
    lines.push(createLine('4101', 0, sale.subtotal, `Venta #${sale.receiptNumber}`));
    
    // Credit: ITBIS Payable (collected from customer)
    if (sale.itbisTotal > 0) {
        lines.push(createLine('2102', 0, sale.itbisTotal, `ITBIS venta #${sale.receiptNumber}`));
    }
    
    const entry: JournalEntry = {
        id: generateId(),
        entryNumber: await generateEntryNumber(),
        date: sale.date,
        description: `Venta efectivo #${sale.receiptNumber}${sale.customerName ? ` - ${sale.customerName}` : ''}`,
        sourceType: 'sale',
        sourceId: sale.id,
        shiftId: sale.shiftId,
        lines,
        totalDebit: lines.reduce((sum, l) => sum + l.debit, 0),
        totalCredit: lines.reduce((sum, l) => sum + l.credit, 0),
        status: 'posted',
        postedAt: new Date(),
        createdAt: new Date(),
        createdBy
    };
    
    await db.journalEntries.add(entry);
    await logAccountingAction({
        action: 'journal_entry_created',
        entityType: 'journal_entry',
        entityId: entry.id!,
        userName: createdBy,
        details: { sourceType: 'sale', entryNumber: entry.entryNumber }
    });
    return entry;
}

/**
 * Create journal entry for a card sale
 * 
 * Debit: Card Receivables (1106) - will be settled later
 * Credit: Sales Revenue (4101)
 * Credit: ITBIS Payable (2102)
 */
export async function createCardSaleEntry(
    sale: Sale,
    createdBy?: string
): Promise<JournalEntry> {
    const lines: JournalEntryLine[] = [];
    
    // Debit: Card receivables (pending settlement)
    lines.push(createLine('1106', sale.total, 0, `Venta tarjeta #${sale.receiptNumber}`));
    
    // Credit: Sales revenue (net of ITBIS)
    lines.push(createLine('4101', 0, sale.subtotal, `Venta #${sale.receiptNumber}`));
    
    // Credit: ITBIS Payable
    if (sale.itbisTotal > 0) {
        lines.push(createLine('2102', 0, sale.itbisTotal, `ITBIS venta #${sale.receiptNumber}`));
    }
    
    const entry: JournalEntry = {
        id: generateId(),
        entryNumber: await generateEntryNumber(),
        date: sale.date,
        description: `Venta tarjeta #${sale.receiptNumber}${sale.customerName ? ` - ${sale.customerName}` : ''}`,
        sourceType: 'sale',
        sourceId: sale.id,
        shiftId: sale.shiftId,
        lines,
        totalDebit: lines.reduce((sum, l) => sum + l.debit, 0),
        totalCredit: lines.reduce((sum, l) => sum + l.credit, 0),
        status: 'posted',
        postedAt: new Date(),
        createdAt: new Date(),
        createdBy
    };
    
    await db.journalEntries.add(entry);
    await logAccountingAction({
        action: 'journal_entry_created',
        entityType: 'journal_entry',
        entityId: entry.id!,
        userName: createdBy,
        details: { sourceType: 'sale', entryNumber: entry.entryNumber }
    });
    return entry;
}

/**
 * Create journal entry for a credit sale
 * 
 * Debit: Accounts Receivable (1103)
 * Credit: Sales Revenue (4101)
 * Credit: ITBIS Payable (2102)
 */
export async function createCreditSaleEntry(
    sale: Sale,
    createdBy?: string
): Promise<JournalEntry> {
    const lines: JournalEntryLine[] = [];
    
    // Debit: Accounts Receivable
    lines.push(createLine('1103', sale.total, 0, `Venta crédito #${sale.receiptNumber} - ${sale.customerName || 'Cliente'}`));
    
    // Credit: Sales revenue
    lines.push(createLine('4101', 0, sale.subtotal, `Venta #${sale.receiptNumber}`));
    
    // Credit: ITBIS Payable
    if (sale.itbisTotal > 0) {
        lines.push(createLine('2102', 0, sale.itbisTotal, `ITBIS venta #${sale.receiptNumber}`));
    }
    
    const entry: JournalEntry = {
        id: generateId(),
        entryNumber: await generateEntryNumber(),
        date: sale.date,
        description: `Venta crédito #${sale.receiptNumber} - ${sale.customerName || 'Cliente'}`,
        sourceType: 'sale',
        sourceId: sale.id,
        shiftId: sale.shiftId,
        lines,
        totalDebit: lines.reduce((sum, l) => sum + l.debit, 0),
        totalCredit: lines.reduce((sum, l) => sum + l.credit, 0),
        status: 'posted',
        postedAt: new Date(),
        createdAt: new Date(),
        createdBy
    };
    
    await db.journalEntries.add(entry);
    await logAccountingAction({
        action: 'journal_entry_created',
        entityType: 'journal_entry',
        entityId: entry.id!,
        userName: createdBy,
        details: { sourceType: 'sale', entryNumber: entry.entryNumber }
    });
    return entry;
}

// ============ COGS JOURNAL ENTRIES ============

/**
 * Create COGS journal entry for a shift close
 * This is the "magic entry" that turns purchases into real expense
 * 
 * Debit: Cost of Goods Sold (5101)
 * Credit: Inventory (1201)
 */
export async function createShiftCOGSEntry(
    shift: CashRegisterShift,
    totalCOGS: number,
    createdBy?: string
): Promise<JournalEntry | null> {
    // Don't create entry if no COGS
    if (totalCOGS <= 0) {
        return null;
    }
    
    const dateStr = shift.closedAt 
        ? new Date(shift.closedAt).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];
    
    const lines: JournalEntryLine[] = [
        // Debit: Cost of Goods Sold
        createLine('5101', totalCOGS, 0, `Costo de ventas - Turno #${shift.shiftNumber}`),
        // Credit: Inventory reduction
        createLine('1201', 0, totalCOGS, `Salida inventario - Turno #${shift.shiftNumber}`)
    ];
    
    const entry: JournalEntry = {
        id: generateId(),
        entryNumber: await generateEntryNumber(),
        date: dateStr,
        description: `Costo de mercancía vendida - Cierre turno #${shift.shiftNumber}`,
        sourceType: 'shift_close',
        shiftId: shift.id,
        lines,
        totalDebit: totalCOGS,
        totalCredit: totalCOGS,
        status: 'posted',
        postedAt: new Date(),
        createdAt: new Date(),
        createdBy
    };
    
    await db.journalEntries.add(entry);
    await logAccountingAction({
        action: 'journal_entry_created',
        entityType: 'journal_entry',
        entityId: entry.id!,
        userName: createdBy,
        details: { sourceType: 'shift_close', entryNumber: entry.entryNumber }
    });
    return entry;
}

// ============ SHRINKAGE/WASTE JOURNAL ENTRIES ============

/**
 * Expense account mapping for shrinkage reasons
 */
const SHRINKAGE_ACCOUNTS: Record<string, AccountCode> = {
    'damage': '6101',      // Gastos por Merma/Rotura
    'physical_count': '6101',
    'expiration': '6102',  // Gastos por Vencimiento
    'theft': '6103',       // Gastos por Pérdida/Robo
    'return_supplier': '1201', // Inventory (not an expense - returned to supplier)
    'found': '1201',       // Inventory (not an expense - found goods)
    'correction': '6101',  // Gastos por Merma
    'other': '6101'        // Default to shrinkage
};

/**
 * Create journal entry for inventory shrinkage/waste/breakage
 * 
 * Debit: Shrinkage Expense (6101/6102/6103)
 * Credit: Inventory (1201)
 */
export async function createShrinkageEntry(
    reason: string,
    productName: string,
    quantity: number,
    cost: number,
    adjustmentId?: string,
    notes?: string,
    createdBy?: string
): Promise<JournalEntry | null> {
    // Don't create entry for zero cost
    if (cost <= 0) {
        return null;
    }
    
    // Special cases that don't create expense entries
    if (reason === 'found') {
        // Found goods increase inventory (debit inventory, credit adjustment account)
        const lines: JournalEntryLine[] = [
            createLine('1201', cost, 0, `Producto encontrado: ${productName} (${quantity} unidades)`),
            createLine('6101', 0, cost, `Reverso merma: ${productName}`)
        ];
        
        const entry: JournalEntry = {
            id: generateId(),
            entryNumber: await generateEntryNumber(),
            date: new Date().toISOString().split('T')[0],
            description: `Producto encontrado: ${productName}`,
            sourceType: 'adjustment',
            sourceId: adjustmentId,
            lines,
            totalDebit: cost,
            totalCredit: cost,
            status: 'posted',
            postedAt: new Date(),
            createdAt: new Date(),
            createdBy
        };
        
        await db.journalEntries.add(entry);
        await logAccountingAction({
            action: 'journal_entry_created',
            entityType: 'journal_entry',
            entityId: entry.id!,
            userName: createdBy,
            details: { sourceType: 'adjustment', entryNumber: entry.entryNumber }
        });
        return entry;
    }
    
    if (reason === 'return_supplier') {
        // Return to supplier creates A/R from supplier
        const lines: JournalEntryLine[] = [
            createLine('1105', cost, 0, `Devolución a proveedor: ${productName} (${quantity} unidades)`),
            createLine('1201', 0, cost, `Salida inventario: ${productName}`)
        ];
        
        const entry: JournalEntry = {
            id: generateId(),
            entryNumber: await generateEntryNumber(),
            date: new Date().toISOString().split('T')[0],
            description: `Devolución a proveedor: ${productName}`,
            sourceType: 'adjustment',
            sourceId: adjustmentId,
            lines,
            totalDebit: cost,
            totalCredit: cost,
            status: 'posted',
            postedAt: new Date(),
            createdAt: new Date(),
            createdBy
        };
        
        await db.journalEntries.add(entry);
        await logAccountingAction({
            action: 'journal_entry_created',
            entityType: 'journal_entry',
            entityId: entry.id!,
            userName: createdBy,
            details: { sourceType: 'adjustment', entryNumber: entry.entryNumber }
        });
        return entry;
    }
    
    // Standard shrinkage entry (expense)
    const expenseAccount = SHRINKAGE_ACCOUNTS[reason] || '6101';
    const reasonLabel = {
        'damage': 'Daño/Rotura',
        'physical_count': 'Diferencia conteo',
        'expiration': 'Vencimiento',
        'theft': 'Pérdida/Robo',
        'correction': 'Corrección',
        'other': 'Otro'
    }[reason] || reason;
    
    const lines: JournalEntryLine[] = [
        createLine(expenseAccount, cost, 0, `${reasonLabel}: ${productName} (${quantity} unidades)${notes ? ` - ${notes}` : ''}`),
        createLine('1201', 0, cost, `Baja inventario: ${productName}`)
    ];
    
    const entry: JournalEntry = {
        id: generateId(),
        entryNumber: await generateEntryNumber(),
        date: new Date().toISOString().split('T')[0],
        description: `Ajuste inventario - ${reasonLabel}: ${productName}`,
        sourceType: 'adjustment',
        sourceId: adjustmentId,
        lines,
        totalDebit: cost,
        totalCredit: cost,
        status: 'posted',
        postedAt: new Date(),
        createdAt: new Date(),
        createdBy
    };
    
    await db.journalEntries.add(entry);
    await logAccountingAction({
        action: 'journal_entry_created',
        entityType: 'journal_entry',
        entityId: entry.id!,
        userName: createdBy,
        details: { sourceType: 'adjustment', entryNumber: entry.entryNumber }
    });
    return entry;
}

// ============ CARD SETTLEMENT JOURNAL ENTRIES ============

/**
 * Create journal entry for card payment settlement
 * Handles: Net amount, commission, 2% ITBIS retention
 * 
 * Debit: Bank (1102) - net amount received
 * Debit: Card Commission Expense (6104)
 * Debit: ITBIS Retained (2103) - credit against ITBIS payable
 * Credit: Card Receivables (1106)
 */
export async function createCardSettlementEntry(
    grossAmount: number,
    commissionPercent: number,
    itbisRetentionPercent: number = 0.02,
    settlementDate: string,
    reference?: string,
    bankAccountId?: string,
    createdBy?: string
): Promise<JournalEntry> {
    const commission = grossAmount * commissionPercent;
    const itbisRetention = grossAmount * itbisRetentionPercent;
    const netDeposit = grossAmount - commission - itbisRetention;
    
    const lines: JournalEntryLine[] = [
        // Debit: Bank (net amount received)
        createLine('1102', netDeposit, 0, `Depósito neto tarjetas${reference ? ` - ${reference}` : ''}`),
        // Debit: Commission expense
        createLine('6104', commission, 0, `Comisión tarjeta ${(commissionPercent * 100).toFixed(2)}%`),
        // Debit: ITBIS Retained by processor (reduces our ITBIS liability)
        createLine('2103', itbisRetention, 0, `Retención ITBIS 2%`),
        // Credit: Clear card receivables
        createLine('1106', 0, grossAmount, `Liquidación ventas tarjeta${reference ? ` - ${reference}` : ''}`)
    ];
    
    const entry: JournalEntry = {
        id: generateId(),
        entryNumber: await generateEntryNumber(),
        date: settlementDate,
        description: `Liquidación tarjetas${reference ? ` - ${reference}` : ''} (Bruto: $${grossAmount.toLocaleString()})`,
        sourceType: 'card_settlement',
        lines,
        totalDebit: Number((netDeposit + commission + itbisRetention).toFixed(2)),
        totalCredit: grossAmount,
        status: 'posted',
        postedAt: new Date(),
        createdAt: new Date(),
        createdBy
    };
    
    await db.journalEntries.add(entry);
    await logAccountingAction({
        action: 'journal_entry_created',
        entityType: 'journal_entry',
        entityId: entry.id!,
        userName: createdBy,
        details: { sourceType: 'card_settlement', entryNumber: entry.entryNumber }
    });
    return entry;
}

// ============ PURCHASE INVOICE JOURNAL ENTRIES ============

/**
 * Create journal entry for a purchase invoice
 * 
 * Debit: Inventory (1201) - for inventory purchases
 * Debit: ITBIS Paid (1104) - input VAT credit
 * Credit: Accounts Payable (2101)
 */
export async function createPurchaseInvoiceEntry(
    invoice: Invoice,
    createdBy?: string
): Promise<JournalEntry> {
    const lines: JournalEntryLine[] = [];
    
    // Determine account based on category
    const isInventory = invoice.category === 'Inventory';
    const expenseAccount: AccountCode = isInventory ? '1201' : 
        invoice.category === 'Utilities' ? '6105' :
        invoice.category === 'Maintenance' ? '6106' :
        invoice.category === 'Payroll' ? '6107' : '6199';
    
    // Debit: Inventory or Expense
    lines.push(createLine(
        expenseAccount, 
        invoice.subtotal, 
        0, 
        `${isInventory ? 'Compra' : 'Gasto'}: ${invoice.providerName} - NCF ${invoice.ncf}`
    ));
    
    // Debit: ITBIS Paid (creditable)
    if (invoice.itbisTotal > 0) {
        lines.push(createLine('1104', invoice.itbisTotal, 0, `ITBIS compra NCF ${invoice.ncf}`));
    }
    
    // Credit: Accounts Payable
    lines.push(createLine('2101', 0, invoice.total, `CxP ${invoice.providerName} - NCF ${invoice.ncf}`));
    
    const entry: JournalEntry = {
        id: generateId(),
        entryNumber: await generateEntryNumber(),
        date: invoice.issueDate,
        description: `Compra ${invoice.providerName} - NCF ${invoice.ncf}`,
        sourceType: 'purchase',
        sourceId: invoice.id,
        lines,
        totalDebit: lines.reduce((sum, l) => sum + l.debit, 0),
        totalCredit: lines.reduce((sum, l) => sum + l.credit, 0),
        status: 'posted',
        postedAt: new Date(),
        createdAt: new Date(),
        createdBy
    };
    
    await db.journalEntries.add(entry);
    await logAccountingAction({
        action: 'journal_entry_created',
        entityType: 'journal_entry',
        entityId: entry.id!,
        userName: createdBy,
        details: { sourceType: 'purchase', entryNumber: entry.entryNumber }
    });
    return entry;
}

/**
 * Create journal entry for a supplier payment
 * Clears the Accounts Payable liability
 * 
 * Debit: Accounts Payable (2101) - Clear liability
 * Credit: Cash (1101) or Bank (1102) - Reduce asset
 */
export async function createSupplierPaymentEntry(
    payment: {
        id?: string;
        invoiceId?: string;
        amount: number;
        paymentDate: string;
        paymentMethod: string;
        referenceNumber?: string;
    },
    invoice: {
        providerName: string;
        ncf?: string;
    },
    createdBy?: string
): Promise<JournalEntry> {
    const lines: JournalEntryLine[] = [];
    
    // Debit: Accounts Payable (clear liability)
    lines.push(createLine(
        '2101', 
        payment.amount, 
        0, 
        `Pago a ${invoice.providerName}${invoice.ncf ? ` - NCF ${invoice.ncf}` : ''}`
    ));
    
    // Credit: Cash or Bank depending on payment method
    const creditAccount: AccountCode = 
        payment.paymentMethod === 'cash' ? '1101' : 
        payment.paymentMethod === 'check' ? '1102' : 
        payment.paymentMethod === 'bank_transfer' ? '1102' : 
        payment.paymentMethod === 'credit_card' ? '1102' : 
        payment.paymentMethod === 'debit_card' ? '1102' : '1101';
    
    const paymentMethodLabel = 
        payment.paymentMethod === 'cash' ? 'efectivo' :
        payment.paymentMethod === 'check' ? `cheque ${payment.referenceNumber || ''}` :
        payment.paymentMethod === 'bank_transfer' ? `transferencia ${payment.referenceNumber || ''}` :
        payment.paymentMethod === 'credit_card' ? 'tarjeta crédito' :
        payment.paymentMethod === 'debit_card' ? 'tarjeta débito' : 'otro';
    
    lines.push(createLine(
        creditAccount, 
        0, 
        payment.amount, 
        `Pago ${paymentMethodLabel} a ${invoice.providerName}`
    ));
    
    const entry: JournalEntry = {
        id: generateId(),
        entryNumber: await generateEntryNumber(),
        date: payment.paymentDate,
        description: `Pago a proveedor ${invoice.providerName}${invoice.ncf ? ` - NCF ${invoice.ncf}` : ''}`,
        sourceType: 'supplier_payment',
        sourceId: payment.id,
        lines,
        totalDebit: lines.reduce((sum, l) => sum + l.debit, 0),
        totalCredit: lines.reduce((sum, l) => sum + l.credit, 0),
        status: 'posted',
        postedAt: new Date(),
        createdBy
    };
    
    await db.journalEntries.add(entry);
    await logAccountingAction({
        action: 'journal_entry_created',
        entityType: 'journal_entry',
        entityId: entry.id!,
        userName: createdBy,
        details: { sourceType: 'supplier_payment', entryNumber: entry.entryNumber, amount: payment.amount }
    });
    return entry;
}

// ============ RETURN JOURNAL ENTRIES ============

/**
 * Create journal entry for a sales return
 * 
 * Debit: Sales Returns (4103)
 * Debit: ITBIS Payable (2102) - reduce ITBIS liability
 * Credit: Cash or A/R (depending on refund method)
 */
export async function createSalesReturnEntry(
    returnRecord: {
        id?: string;
        originalReceiptNumber?: string;
        customerName?: string;
        subtotal: number;
        itbisTotal: number;
        total: number;
        refundMethod: string;
        date: string;
    },
    createdBy?: string
): Promise<JournalEntry> {
    const lines: JournalEntryLine[] = [];
    
    // Debit: Sales Returns (contra-revenue)
    lines.push(createLine('4103', returnRecord.subtotal, 0, `Devolución venta #${returnRecord.originalReceiptNumber}`));
    
    // Debit: ITBIS Payable (reduce liability)
    if (returnRecord.itbisTotal > 0) {
        lines.push(createLine('2102', returnRecord.itbisTotal, 0, `Reverso ITBIS devolución #${returnRecord.originalReceiptNumber}`));
    }
    
    // Credit: Cash or A/R (depending on refund method)
    const creditAccount: AccountCode = returnRecord.refundMethod === 'cash' ? '1101' : 
        returnRecord.refundMethod === 'credit_card' ? '1106' : '1103';
    lines.push(createLine(creditAccount, 0, returnRecord.total, `Reembolso devolución #${returnRecord.originalReceiptNumber}`));
    
    const entry: JournalEntry = {
        id: generateId(),
        entryNumber: await generateEntryNumber(),
        date: returnRecord.date,
        description: `Devolución venta #${returnRecord.originalReceiptNumber}${returnRecord.customerName ? ` - ${returnRecord.customerName}` : ''}`,
        sourceType: 'return',
        sourceId: returnRecord.id,
        lines,
        totalDebit: lines.reduce((sum, l) => sum + l.debit, 0),
        totalCredit: lines.reduce((sum, l) => sum + l.credit, 0),
        status: 'posted',
        postedAt: new Date(),
        createdAt: new Date(),
        createdBy
    };
    
    await db.journalEntries.add(entry);
    await logAccountingAction({
        action: 'journal_entry_created',
        entityType: 'journal_entry',
        entityId: entry.id!,
        userName: createdBy,
        details: { sourceType: 'return', entryNumber: entry.entryNumber }
    });
    return entry;
}

// ============ VOID/REVERSAL ENTRIES ============

/**
 * Void a journal entry by creating a reversal entry
 */
export async function voidJournalEntry(
    entryId: string,
    reason: string,
    voidedBy?: string
): Promise<JournalEntry | null> {
    const original = await db.journalEntries.get(entryId);
    if (!original || original.status === 'voided') {
        return null;
    }
    
    // Mark original as voided
    await db.journalEntries.update(entryId, {
        status: 'voided',
        voidedAt: new Date(),
        voidedBy,
        voidReason: reason
    });
    await logAccountingAction({
        action: 'journal_entry_voided',
        entityType: 'journal_entry',
        entityId: entryId,
        userName: voidedBy,
        details: { reason }
    });
    
    // Create reversal entry (swap debits and credits)
    const reversalLines = original.lines.map(line => ({
        ...line,
        debit: line.credit,
        credit: line.debit,
        description: `REVERSO: ${line.description || ''}`
    }));
    
    const reversal: JournalEntry = {
        id: generateId(),
        entryNumber: await generateEntryNumber(),
        date: new Date().toISOString().split('T')[0],
        description: `REVERSO ${original.entryNumber}: ${reason}`,
        sourceType: original.sourceType,
        sourceId: original.sourceId,
        lines: reversalLines,
        totalDebit: reversalLines.reduce((sum, l) => sum + l.debit, 0),
        totalCredit: reversalLines.reduce((sum, l) => sum + l.credit, 0),
        status: 'posted',
        postedAt: new Date(),
        createdAt: new Date(),
        createdBy: voidedBy
    };
    
    await db.journalEntries.add(reversal);
    await logAccountingAction({
        action: 'journal_entry_created',
        entityType: 'journal_entry',
        entityId: reversal.id!,
        userName: voidedBy,
        details: { sourceType: reversal.sourceType, entryNumber: reversal.entryNumber, reversalOf: entryId }
    });
    return reversal;
}

// ============ REPORTING ============

/**
 * Get account balance for a specific account
 */
export async function getAccountBalance(
    accountCode: AccountCode,
    startDate?: string,
    endDate?: string
): Promise<{ debit: number; credit: number; balance: number }> {
    let entries = db.journalEntries.where('status').equals('posted');
    
    const allEntries = await entries.toArray();
    
    // Filter by date if provided
    const filteredEntries = allEntries.filter(entry => {
        if (startDate && entry.date < startDate) return false;
        if (endDate && entry.date > endDate) return false;
        return true;
    });
    
    let totalDebit = 0;
    let totalCredit = 0;
    
    for (const entry of filteredEntries) {
        for (const line of entry.lines) {
            if (line.accountCode === accountCode) {
                totalDebit += line.debit;
                totalCredit += line.credit;
            }
        }
    }
    
    // Balance calculation depends on account type
    // Assets & Expenses: Debit - Credit (positive = debit balance)
    // Liabilities, Equity & Revenue: Credit - Debit (positive = credit balance)
    const isDebitNormal = accountCode.startsWith('1') || accountCode.startsWith('5') || accountCode.startsWith('6');
    const balance = isDebitNormal ? totalDebit - totalCredit : totalCredit - totalDebit;
    
    return { debit: totalDebit, credit: totalCredit, balance };
}

/**
 * Get all journal entries for a period
 */
export async function getJournalEntriesForPeriod(
    startDate: string,
    endDate: string
): Promise<JournalEntry[]> {
    return db.journalEntries
        .where('date')
        .between(startDate, endDate, true, true)
        .and(entry => entry.status === 'posted')
        .toArray();
}

/**
 * Get journal entries by source type
 */
export async function getJournalEntriesBySourceType(
    sourceType: JournalEntry['sourceType'],
    startDate?: string,
    endDate?: string
): Promise<JournalEntry[]> {
    let entries = await db.journalEntries
        .where('sourceType').equals(sourceType)
        .and(entry => entry.status === 'posted')
        .toArray();
    
    if (startDate || endDate) {
        entries = entries.filter(entry => {
            if (startDate && entry.date < startDate) return false;
            if (endDate && entry.date > endDate) return false;
            return true;
        });
    }
    
    return entries;
}

/**
 * Get trial balance (all account balances)
 */
export async function getTrialBalance(
    startDate?: string,
    endDate?: string
): Promise<Map<AccountCode, { debit: number; credit: number; balance: number }>> {
    const accounts: AccountCode[] = [
        '1101', '1102', '1103', '1104', '1105', '1106', '1201',
        '2101', '2102', '2103', '2104',
        '4101', '4102', '4103',
        '5101',
        '6101', '6102', '6103', '6104', '6105', '6106', '6107', '6199'
    ];
    
    const balances = new Map<AccountCode, { debit: number; credit: number; balance: number }>();
    
    for (const account of accounts) {
        const balance = await getAccountBalance(account, startDate, endDate);
        if (balance.debit !== 0 || balance.credit !== 0) {
            balances.set(account, balance);
        }
    }
    
    return balances;
}

