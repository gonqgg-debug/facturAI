import type { Invoice, InvoiceItem } from './types';

export const ITBIS_RATE = 0.18;

export function calculateItbis(amount: number): number {
    return Number((amount * ITBIS_RATE).toFixed(2));
}

export function calculateNetFromTotal(total: number): { net: number; itbis: number } {
    const net = Number((total / (1 + ITBIS_RATE)).toFixed(2));
    const itbis = Number((total - net).toFixed(2));
    return { net, itbis };
}

export function validateNcf(ncf: string): boolean {
    // Basic regex for DR NCF (e.g., B0100000001, E310000000001)
    // 11 chars for standard, 13 for e-CF
    const standardRegex = /^[B|E][0-9]{10,12}$/;
    return standardRegex.test(ncf);
}

export function getNcfType(ncf: string): string {
    if (!ncf) return 'Unknown';
    const prefix = ncf.substring(0, 3);
    const types: Record<string, string> = {
        'B01': 'Crédito Fiscal',
        'B02': 'Consumo Final',
        'B03': 'Notas de Débito',
        'B04': 'Notas de Crédito',
        'B11': 'Proveedores Informales',
        'B13': 'Gastos Menores',
        'B14': 'Regímenes Especiales',
        'B15': 'Gubernamental',
        'E31': 'e-CF Crédito Fiscal',
        'E32': 'e-CF Consumo Final',
        'E41': 'e-CF Compras',
        'E43': 'e-CF Gastos Menores',
        'E44': 'e-CF Regímenes Especiales',
        'E45': 'e-CF Gubernamental'
    };
    return types[prefix] || 'Unknown';
}

export function recalculateInvoice(invoice: Invoice): Invoice {
    let subtotal = 0;
    let itbisTotal = 0;
    let total = 0;

    invoice.items.forEach(item => {
        // Ensure numbers
        item.quantity = Number(item.quantity) || 0;
        item.unitPrice = Number(item.unitPrice) || 0;

        // Calculate line values
        // Assuming unitPrice might be with or without ITBIS, but let's standardize on logic:
        // If we have total value, we can back-calculate.
        // Let's assume the user inputs or OCR gives us what's on paper.
        // We need to sum up.

        // Simple logic: Value = Qty * UnitPrice
        item.value = Number((item.quantity * item.unitPrice).toFixed(2));

        // Calculate ITBIS based on rate
        // Default to 18% if not set, or use 0 if explicitly 0
        const rate = item.taxRate !== undefined ? item.taxRate : 0.18;

        if (item.priceIncludesTax) {
            // Back-calculate base value
            // Unit Price is the final price per unit
            const totalAmount = item.quantity * item.unitPrice;

            // Net = Total / (1 + rate)
            const netValue = totalAmount / (1 + rate);

            item.value = Number(netValue.toFixed(2));
            item.itbis = Number((totalAmount - netValue).toFixed(2));
            item.amount = Number(totalAmount.toFixed(2));
        } else {
            // Standard calculation (Tax Excluded)
            // Simple logic: Value = Qty * UnitPrice
            item.value = Number((item.quantity * item.unitPrice).toFixed(2));
            item.itbis = Number((item.value * rate).toFixed(2));
            item.amount = Number((item.value + item.itbis).toFixed(2));
        }

        subtotal += item.value;
        itbisTotal += item.itbis;
        total += item.amount;
    });

    invoice.subtotal = Number(subtotal.toFixed(2));
    invoice.itbisTotal = Number(itbisTotal.toFixed(2));
    invoice.total = Number(total.toFixed(2));
    // Discount is separate, usually applied before tax or after? 
    // DR: Discounts affect the tax base.
    // Let's assume subtotal is already after line-discounts if any.
    // If there is a global discount:
    const globalDiscount = Number(invoice.discount) || 0;
    invoice.total = Number((invoice.total - globalDiscount).toFixed(2));

    return invoice;
}

export function recalculateFromTotal(item: InvoiceItem): InvoiceItem {
    // Ensure numbers
    item.quantity = Number(item.quantity) || 1; // Avoid div by zero
    item.amount = Number(item.amount) || 0;
    const rate = item.taxRate !== undefined ? item.taxRate : 0.18;

    // We have Total (Amount) and Qty. We need Unit Price.

    if (item.priceIncludesTax) {
        // If Price Includes Tax, then Unit Price is simply Total / Qty
        // Example: Total 118, Qty 1, Tax 18%. Unit Price (Inc Tax) = 118.
        item.unitPrice = Number((item.amount / item.quantity).toFixed(2));

        // Now derive the breakdown
        const netValue = item.amount / (1 + rate);
        item.value = Number(netValue.toFixed(2));
        item.itbis = Number((item.amount - netValue).toFixed(2));
    } else {
        // If Price Excludes Tax, then Unit Price is the Base Price.
        // Total = (Base * Qty) * (1 + Rate)
        // Base = Total / (1 + Rate) / Qty
        const totalNet = item.amount / (1 + rate);
        item.unitPrice = Number((totalNet / item.quantity).toFixed(2));

        item.value = Number(totalNet.toFixed(2));
        item.itbis = Number((item.amount - totalNet).toFixed(2));
    }

    return item;
}
