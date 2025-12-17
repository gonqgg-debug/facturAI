/**
 * ITBIS (Dominican Republic VAT) Tracking Service
 * 
 * Tracks ITBIS by rate (18%, 16%, 0%) for:
 * - Sales (ITBIS Collected / Payable to DGII)
 * - Purchases (ITBIS Paid / Receivable credit)
 * - Card Retentions (ITBIS withheld by card processors)
 * 
 * Calculates net ITBIS due: Collected - Paid - Retained
 */

import { db, generateId } from './db';
import type { ITBISSummary, Sale, Invoice, InvoiceItem } from './types';
import { logAccountingAction } from './accounting-audit';

// ============ PERIOD HELPERS ============

/**
 * Get the period string (YYYY-MM) for a date
 */
export function getPeriod(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}

/**
 * Get current period
 */
export function getCurrentPeriod(): string {
    return getPeriod(new Date());
}

// ============ ITBIS SUMMARY MANAGEMENT ============

/**
 * Get or create an ITBIS summary for a period
 */
export async function getOrCreateSummary(period: string): Promise<ITBISSummary> {
    let summary = await db.itbisSummaries.where('period').equals(period).first();
    
    if (!summary) {
        summary = {
            id: generateId(),
            period,
            // Collected from sales
            itbis18Collected: 0,
            itbis16Collected: 0,
            salesExempt: 0,
            totalItbisCollected: 0,
            // Paid on purchases
            itbis18Paid: 0,
            itbis16Paid: 0,
            purchasesExempt: 0,
            totalItbisPaid: 0,
            // Retained by third parties
            itbisRetainedByCards: 0,
            otherRetentions: 0,
            totalItbisRetained: 0,
            // Net due
            netItbisDue: 0,
            // Status
            status: 'open',
            createdAt: new Date()
        };
        await db.itbisSummaries.add(summary);
    }
    
    return summary;
}

/**
 * Recalculate and update the net ITBIS due
 */
async function updateNetItbisDue(summary: ITBISSummary): Promise<ITBISSummary> {
    summary.totalItbisCollected = summary.itbis18Collected + summary.itbis16Collected;
    summary.totalItbisPaid = summary.itbis18Paid + summary.itbis16Paid;
    summary.totalItbisRetained = summary.itbisRetainedByCards + summary.otherRetentions;
    summary.netItbisDue = summary.totalItbisCollected - summary.totalItbisPaid - summary.totalItbisRetained;
    summary.updatedAt = new Date();
    
    if (summary.id) {
        await db.itbisSummaries.update(summary.id, {
            totalItbisCollected: summary.totalItbisCollected,
            totalItbisPaid: summary.totalItbisPaid,
            totalItbisRetained: summary.totalItbisRetained,
            netItbisDue: summary.netItbisDue,
            updatedAt: summary.updatedAt
        });
    }
    
    return summary;
}

// ============ SALES ITBIS TRACKING ============

/**
 * Calculate ITBIS by rate from sale items
 */
export function calculateSaleITBISByRate(items: InvoiceItem[]): {
    itbis18: number;
    itbis16: number;
    exempt: number;
} {
    let itbis18 = 0;
    let itbis16 = 0;
    let exempt = 0;
    
    for (const item of items) {
        const rate = item.taxRate ?? 0.18;
        const quantity = item.quantity || 1;
        const unitPrice = item.unitPrice || 0;
        const lineTotal = item.amount || (quantity * unitPrice);
        
        // Calculate ITBIS from item data, even if item.itbis is missing
        let itemItbis = item.itbis;
        if (itemItbis === undefined || itemItbis === null || itemItbis === 0) {
            // Calculate ITBIS: if price includes tax, extract it; otherwise it's 0 for this calc
            const priceIncludesTax = item.priceIncludesTax ?? true;
            if (priceIncludesTax && rate > 0) {
                // ITBIS = Total * (rate / (1 + rate))
                itemItbis = lineTotal * (rate / (1 + rate));
            } else if (!priceIncludesTax && rate > 0) {
                // ITBIS = Total * rate (but total is ex-tax)
                const valueExTax = item.value || lineTotal;
                itemItbis = valueExTax * rate;
            }
        }
        
        if (rate >= 0.17) {
            // 18% rate
            itbis18 += itemItbis || 0;
        } else if (rate >= 0.15) {
            // 16% rate
            itbis16 += itemItbis || 0;
        } else {
            // Exempt (0%)
            exempt += item.value || lineTotal;
        }
    }
    
    return {
        itbis18: Number(itbis18.toFixed(2)),
        itbis16: Number(itbis16.toFixed(2)),
        exempt: Number(exempt.toFixed(2))
    };
}

/**
 * Record ITBIS collected from a sale
 */
export async function recordSaleITBIS(sale: Sale): Promise<void> {
    const period = getPeriod(sale.date);
    const summary = await getOrCreateSummary(period);
    
    // Calculate ITBIS by rate
    const { itbis18, itbis16, exempt } = calculateSaleITBISByRate(sale.items);
    
    // Update summary
    summary.itbis18Collected += itbis18;
    summary.itbis16Collected += itbis16;
    summary.salesExempt += exempt;
    
    await updateNetItbisDue(summary);
}

/**
 * Reverse ITBIS from a sale (for returns or voids)
 */
export async function reverseSaleITBIS(sale: Sale): Promise<void> {
    const period = getPeriod(sale.date);
    const summary = await getOrCreateSummary(period);
    
    const { itbis18, itbis16, exempt } = calculateSaleITBISByRate(sale.items);
    
    summary.itbis18Collected = Math.max(0, summary.itbis18Collected - itbis18);
    summary.itbis16Collected = Math.max(0, summary.itbis16Collected - itbis16);
    summary.salesExempt = Math.max(0, summary.salesExempt - exempt);
    
    await updateNetItbisDue(summary);
}

// ============ PURCHASE ITBIS TRACKING ============

/**
 * Calculate ITBIS by rate from invoice items
 */
export function calculatePurchaseITBISByRate(items: InvoiceItem[]): {
    itbis18: number;
    itbis16: number;
    exempt: number;
} {
    let itbis18 = 0;
    let itbis16 = 0;
    let exempt = 0;
    
    for (const item of items) {
        const rate = item.taxRate ?? 0.18;
        const quantity = item.quantity || 1;
        const unitPrice = item.unitPrice || 0;
        const lineTotal = item.amount || (quantity * unitPrice);
        
        // Calculate ITBIS from item data, even if item.itbis is missing
        let itemItbis = item.itbis;
        if (itemItbis === undefined || itemItbis === null || itemItbis === 0) {
            const priceIncludesTax = item.priceIncludesTax ?? true;
            if (priceIncludesTax && rate > 0) {
                itemItbis = lineTotal * (rate / (1 + rate));
            } else if (!priceIncludesTax && rate > 0) {
                const valueExTax = item.value || lineTotal;
                itemItbis = valueExTax * rate;
            }
        }
        
        if (rate >= 0.17) {
            itbis18 += itemItbis || 0;
        } else if (rate >= 0.15) {
            itbis16 += itemItbis || 0;
        } else {
            exempt += item.value || lineTotal;
        }
    }
    
    return {
        itbis18: Number(itbis18.toFixed(2)),
        itbis16: Number(itbis16.toFixed(2)),
        exempt: Number(exempt.toFixed(2))
    };
}

/**
 * Record ITBIS paid on a purchase invoice
 * This becomes a credit against ITBIS payable
 */
export async function recordPurchaseITBIS(invoice: Invoice): Promise<void> {
    const period = getPeriod(invoice.issueDate);
    const summary = await getOrCreateSummary(period);
    
    const { itbis18, itbis16, exempt } = calculatePurchaseITBISByRate(invoice.items);
    
    summary.itbis18Paid += itbis18;
    summary.itbis16Paid += itbis16;
    summary.purchasesExempt += exempt;
    
    await updateNetItbisDue(summary);
}

/**
 * Reverse ITBIS from a purchase (for credit notes)
 */
export async function reversePurchaseITBIS(invoice: Invoice): Promise<void> {
    const period = getPeriod(invoice.issueDate);
    const summary = await getOrCreateSummary(period);
    
    const { itbis18, itbis16, exempt } = calculatePurchaseITBISByRate(invoice.items);
    
    summary.itbis18Paid = Math.max(0, summary.itbis18Paid - itbis18);
    summary.itbis16Paid = Math.max(0, summary.itbis16Paid - itbis16);
    summary.purchasesExempt = Math.max(0, summary.purchasesExempt - exempt);
    
    await updateNetItbisDue(summary);
}

// ============ CARD RETENTION TRACKING ============

/**
 * Record ITBIS retained by card processors
 * Card companies withhold 2% of sales as ITBIS retention
 */
export async function recordCardRetention(
    settlementDate: string,
    retentionAmount: number
): Promise<void> {
    const period = getPeriod(settlementDate);
    const summary = await getOrCreateSummary(period);
    
    summary.itbisRetainedByCards += retentionAmount;
    
    await updateNetItbisDue(summary);
}

/**
 * Record other ITBIS retentions (from large customers, government, etc.)
 */
export async function recordOtherRetention(
    date: string,
    retentionAmount: number
): Promise<void> {
    const period = getPeriod(date);
    const summary = await getOrCreateSummary(period);
    
    summary.otherRetentions += retentionAmount;
    
    await updateNetItbisDue(summary);
}

// ============ REPORTING ============

/**
 * Get ITBIS summary for a specific period
 */
export async function getITBISSummary(period: string): Promise<ITBISSummary | null> {
    return await db.itbisSummaries.where('period').equals(period).first() ?? null;
}

/**
 * Get all ITBIS summaries for a year
 */
export async function getYearSummaries(year: number): Promise<ITBISSummary[]> {
    const summaries = await db.itbisSummaries.toArray();
    return summaries
        .filter(s => s.period.startsWith(String(year)))
        .sort((a, b) => a.period.localeCompare(b.period));
}

/**
 * Calculate year-to-date ITBIS totals
 */
export async function getYTDSummary(year: number): Promise<{
    collected: number;
    paid: number;
    retained: number;
    netDue: number;
}> {
    const summaries = await getYearSummaries(year);
    
    return {
        collected: summaries.reduce((sum, s) => sum + s.totalItbisCollected, 0),
        paid: summaries.reduce((sum, s) => sum + s.totalItbisPaid, 0),
        retained: summaries.reduce((sum, s) => sum + s.totalItbisRetained, 0),
        netDue: summaries.reduce((sum, s) => sum + s.netItbisDue, 0)
    };
}

/**
 * Recalculate ITBIS summary from raw data
 * Useful for fixing discrepancies or after data import
 */
export async function recalculatePeriodITBIS(period: string): Promise<ITBISSummary> {
    const [year, month] = period.split('-').map(Number);
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];
    
    console.log(`[ITBIS] Recalculating period ${period}: ${startDate} to ${endDate}`);
    
    // Get all sales for the period - use filter for more reliable date matching
    const allSales = await db.sales.toArray();
    const sales = allSales.filter(s => s.date >= startDate && s.date <= endDate);
    
    console.log(`[ITBIS] Found ${sales.length} sales in period`);
    
    // Get all invoices for the period
    const allInvoices = await db.invoices.toArray();
    const invoices = allInvoices.filter(inv => 
        inv.issueDate >= startDate && 
        inv.issueDate <= endDate &&
        (inv.status === 'verified' || inv.status === 'exported')
    );
    
    console.log(`[ITBIS] Found ${invoices.length} invoices in period`);
    
    // Get card settlements for the period
    const allSettlements = await db.cardSettlements.toArray();
    const settlements = allSettlements.filter(s => 
        s.settlementDate >= startDate && s.settlementDate <= endDate
    );
    
    console.log(`[ITBIS] Found ${settlements.length} settlements in period`);
    
    // Calculate totals
    let itbis18Collected = 0, itbis16Collected = 0, salesExempt = 0;
    let itbis18Paid = 0, itbis16Paid = 0, purchasesExempt = 0;
    let itbisRetainedByCards = 0;
    
    for (const sale of sales) {
        // Use itbisTotal from sale if items don't have individual itbis
        if (sale.items && sale.items.length > 0) {
            const { itbis18, itbis16, exempt } = calculateSaleITBISByRate(sale.items);
            itbis18Collected += itbis18;
            itbis16Collected += itbis16;
            salesExempt += exempt;
        } else if (sale.itbisTotal) {
            // Fallback: assume all ITBIS is 18% if no item breakdown
            itbis18Collected += sale.itbisTotal;
        }
    }
    
    console.log(`[ITBIS] Sales ITBIS: 18%=${itbis18Collected}, 16%=${itbis16Collected}, exempt=${salesExempt}`);
    
    for (const invoice of invoices) {
        if (invoice.items && invoice.items.length > 0) {
            const { itbis18, itbis16, exempt } = calculatePurchaseITBISByRate(invoice.items);
            itbis18Paid += itbis18;
            itbis16Paid += itbis16;
            purchasesExempt += exempt;
        } else if (invoice.itbisTotal) {
            // Fallback: assume all ITBIS is 18% if no item breakdown
            itbis18Paid += invoice.itbisTotal;
        }
    }
    
    console.log(`[ITBIS] Purchase ITBIS: 18%=${itbis18Paid}, 16%=${itbis16Paid}, exempt=${purchasesExempt}`);
    
    for (const settlement of settlements) {
        itbisRetainedByCards += settlement.itbisRetentionAmount || 0;
    }
    
    console.log(`[ITBIS] Card retentions: ${itbisRetainedByCards}`);
    
    // Get or create summary
    const summary = await getOrCreateSummary(period);
    
    // Update with recalculated values
    summary.itbis18Collected = itbis18Collected;
    summary.itbis16Collected = itbis16Collected;
    summary.salesExempt = salesExempt;
    summary.itbis18Paid = itbis18Paid;
    summary.itbis16Paid = itbis16Paid;
    summary.purchasesExempt = purchasesExempt;
    summary.itbisRetainedByCards = itbisRetainedByCards;
    
    const updated = await updateNetItbisDue(summary);

    await logAccountingAction({
        action: 'itbis_recalculated',
        entityType: 'itbis_period',
        entityId: summary.id!,
        details: { period, sales: sales.length, invoices: invoices.length, settlements: settlements.length }
    });

    return updated;
}

// ============ PERIOD MANAGEMENT ============

/**
 * Close a period (no more changes allowed without reopening)
 */
export async function closePeriod(period: string): Promise<void> {
    const summary = await getOrCreateSummary(period);
    
    if (summary.id) {
        await db.itbisSummaries.update(summary.id, {
            status: 'closed'
        });
        await logAccountingAction({
            action: 'period_closed',
            entityType: 'itbis_period',
            entityId: summary.id,
            details: { period }
        });
    }
}

/**
 * Mark a period as filed with DGII
 */
export async function markPeriodFiled(
    period: string,
    confirmationNumber?: string
): Promise<void> {
    const summary = await getOrCreateSummary(period);
    
    if (summary.id) {
        await db.itbisSummaries.update(summary.id, {
            status: 'filed',
            filedAt: new Date(),
            dgiiConfirmation: confirmationNumber
        });
        await logAccountingAction({
            action: 'period_closed',
            entityType: 'itbis_period',
            entityId: summary.id,
            details: { period, confirmationNumber }
        });
    }
}

/**
 * Reopen a closed period (for corrections)
 */
export async function reopenPeriod(period: string): Promise<void> {
    const summary = await getOrCreateSummary(period);
    
    if (summary.id && summary.status !== 'filed') {
        await db.itbisSummaries.update(summary.id, {
            status: 'open'
        });
        await logAccountingAction({
            action: 'period_reopened',
            entityType: 'itbis_period',
            entityId: summary.id,
            details: { period }
        });
    }
}

