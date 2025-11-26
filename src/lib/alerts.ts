import type { Product, Invoice } from './types';

export interface StockAlert {
    type: 'low_stock' | 'out_of_stock' | 'reorder_suggestion' | 'stock_updated';
    severity: 'info' | 'warning' | 'critical';
    productId: number;
    productName: string;
    message: string;
    suggestion?: string;
    currentStock?: number;
    reorderPoint?: number;
}

export interface InvoiceAlert {
    type: 'due_soon' | 'overdue' | 'payment_reminder';
    severity: 'info' | 'warning' | 'critical';
    invoiceId: number;
    providerName: string;
    message: string;
    daysUntilDue?: number;
    daysOverdue?: number;
    amount: number;
}

/**
 * Check for low stock products
 */
export function checkLowStock(products: Product[]): StockAlert[] {
    const alerts: StockAlert[] = [];
    
    for (const product of products) {
        if (product.id === undefined) continue;
        
        const currentStock = product.currentStock ?? 0;
        const reorderPoint = product.reorderPoint ?? 5; // Default reorder point
        
        if (currentStock === 0) {
            alerts.push({
                type: 'out_of_stock',
                severity: 'critical',
                productId: product.id,
                productName: product.name,
                message: `${product.name} está agotado`,
                suggestion: 'Ordena inmediatamente para evitar pérdida de ventas',
                currentStock: 0,
                reorderPoint
            });
        } else if (currentStock <= reorderPoint) {
            alerts.push({
                type: 'low_stock',
                severity: 'warning',
                productId: product.id,
                productName: product.name,
                message: `${product.name} tiene stock bajo (${currentStock} unidades)`,
                suggestion: `Considera reordenar - punto de reorden: ${reorderPoint}`,
                currentStock,
                reorderPoint
            });
        }
    }
    
    return alerts.sort((a, b) => {
        // Sort by severity (critical first), then by stock level
        const severityOrder = { critical: 0, warning: 1, info: 2 };
        if (severityOrder[a.severity] !== severityOrder[b.severity]) {
            return severityOrder[a.severity] - severityOrder[b.severity];
        }
        return (a.currentStock ?? 0) - (b.currentStock ?? 0);
    });
}

/**
 * Generate restock suggestions based on day of week and patterns
 * Tourist weekends (Fri-Sun) typically need more beer, snacks, etc.
 */
export function generateRestockSuggestions(
    products: Product[],
    dayOfWeek?: number // 0 = Sunday, 6 = Saturday
): StockAlert[] {
    const alerts: StockAlert[] = [];
    const today = dayOfWeek ?? new Date().getDay();
    const isWeekendApproaching = today >= 4 && today <= 6; // Thursday-Saturday
    
    // High-demand categories for tourist weekends
    const weekendCategories = ['Bebidas', 'Cervezas', 'Snacks', 'Hielo', 'Beverages', 'Beer'];
    
    for (const product of products) {
        if (product.id === undefined) continue;
        
        const currentStock = product.currentStock ?? 0;
        const salesVelocity = product.salesVelocity ?? 0;
        const category = product.category?.toLowerCase() ?? '';
        
        // Check if product is in high-demand category and weekend is approaching
        const isHighDemand = weekendCategories.some(c => category.includes(c.toLowerCase()));
        
        if (isWeekendApproaching && isHighDemand) {
            // Estimate weekend demand (typically 2-3x normal)
            const estimatedWeekendDemand = salesVelocity * 3 * 3; // 3 days, 3x velocity
            
            if (currentStock < estimatedWeekendDemand && currentStock > 0) {
                alerts.push({
                    type: 'reorder_suggestion',
                    severity: 'info',
                    productId: product.id,
                    productName: product.name,
                    message: `${product.name}: Stock bajo para fin de semana turístico`,
                    suggestion: `Tienes ${currentStock} unidades. Considera ordenar ${Math.ceil(estimatedWeekendDemand - currentStock)} más para el fin de semana.`,
                    currentStock,
                    reorderPoint: Math.ceil(estimatedWeekendDemand)
                });
            }
        }
    }
    
    return alerts;
}

/**
 * Generate stock update alerts after invoice validation
 */
export function generateStockUpdateAlerts(
    updatedProducts: Array<{ product: Product; quantityAdded: number; previousStock: number }>
): StockAlert[] {
    return updatedProducts.map(({ product, quantityAdded, previousStock }) => ({
        type: 'stock_updated' as const,
        severity: 'info' as const,
        productId: product.id!,
        productName: product.name,
        message: `${product.name}: +${quantityAdded} unidades`,
        suggestion: `Stock anterior: ${previousStock} → Nuevo stock: ${(product.currentStock ?? 0)}`,
        currentStock: product.currentStock,
        reorderPoint: product.reorderPoint
    }));
}

/**
 * Check for invoices that are due soon or overdue
 */
export function checkInvoiceDueDates(invoices: Invoice[]): InvoiceAlert[] {
    const alerts: InvoiceAlert[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (const invoice of invoices) {
        if (!invoice.id || !invoice.dueDate || invoice.paymentStatus === 'paid') continue;
        
        const dueDate = new Date(invoice.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        
        const diffTime = dueDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) {
            // Overdue
            alerts.push({
                type: 'overdue',
                severity: 'critical',
                invoiceId: invoice.id,
                providerName: invoice.providerName,
                message: `Factura de ${invoice.providerName} vencida hace ${Math.abs(diffDays)} días`,
                daysOverdue: Math.abs(diffDays),
                amount: invoice.total
            });
        } else if (diffDays <= 5) {
            // Due soon (within 5 days)
            const severity = diffDays <= 2 ? 'warning' : 'info';
            alerts.push({
                type: 'due_soon',
                severity,
                invoiceId: invoice.id,
                providerName: invoice.providerName,
                message: diffDays === 0 
                    ? `Factura de ${invoice.providerName} vence HOY`
                    : `Factura de ${invoice.providerName} vence en ${diffDays} día${diffDays > 1 ? 's' : ''}`,
                suggestion: diffDays >= 3 ? '¿Pagar temprano por descuento?' : undefined,
                daysUntilDue: diffDays,
                amount: invoice.total
            });
        }
    }
    
    return alerts.sort((a, b) => {
        // Sort by severity first, then by urgency
        const severityOrder = { critical: 0, warning: 1, info: 2 };
        if (severityOrder[a.severity] !== severityOrder[b.severity]) {
            return severityOrder[a.severity] - severityOrder[b.severity];
        }
        // For same severity, sort by days (overdue first, then soonest due)
        const aDays = a.daysOverdue ?? -(a.daysUntilDue ?? 999);
        const bDays = b.daysOverdue ?? -(b.daysUntilDue ?? 999);
        return bDays - aDays;
    });
}

/**
 * Calculate total pending payments for cash flow
 */
export function calculatePendingPayments(invoices: Invoice[]): {
    totalPending: number;
    dueThisWeek: number;
    overdueTotal: number;
    invoicesByStatus: Record<string, number>;
} {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekFromNow = new Date(today);
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    
    let totalPending = 0;
    let dueThisWeek = 0;
    let overdueTotal = 0;
    const invoicesByStatus: Record<string, number> = {
        pending: 0,
        partial: 0,
        paid: 0,
        overdue: 0
    };
    
    for (const invoice of invoices) {
        const status = invoice.paymentStatus ?? 'pending';
        const amount = invoice.total - (invoice.paidAmount ?? 0);
        
        invoicesByStatus[status] = (invoicesByStatus[status] ?? 0) + 1;
        
        if (status === 'paid') continue;
        
        totalPending += amount;
        
        if (invoice.dueDate) {
            const dueDate = new Date(invoice.dueDate);
            dueDate.setHours(0, 0, 0, 0);
            
            if (dueDate < today) {
                overdueTotal += amount;
            } else if (dueDate <= weekFromNow) {
                dueThisWeek += amount;
            }
        }
    }
    
    return {
        totalPending,
        dueThisWeek,
        overdueTotal,
        invoicesByStatus
    };
}

/**
 * Format currency for display (DOP)
 */
export function formatCurrency(amount: number, currency: 'DOP' | 'USD' = 'DOP'): string {
    return `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Get alert icon based on type and severity
 */
export function getAlertIcon(alert: StockAlert | InvoiceAlert): string {
    if (alert.severity === 'critical') return '🚨';
    if (alert.severity === 'warning') return '⚠️';
    return 'ℹ️';
}

