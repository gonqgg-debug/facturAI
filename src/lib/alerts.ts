import type { Product, Invoice, Sale, StockMovement } from './types';
import { analyzePurchasePatterns, detectSeasonalTrends, calculateSalesVelocity, predictDemand, type PurchasePattern, type DemandForecast, type SeasonalTrend } from './inventory-ai';

export interface StockAlert {
    type: 'low_stock' | 'out_of_stock' | 'reorder_suggestion' | 'stock_updated';
    severity: 'info' | 'warning' | 'critical';
    productId: string; // UUID for cloud sync
    productName: string;
    message: string;
    suggestion?: string;
    currentStock?: number;
    reorderPoint?: number;
}

export interface InvoiceAlert {
    type: 'due_soon' | 'overdue' | 'payment_reminder';
    severity: 'info' | 'warning' | 'critical';
    invoiceId: string; // UUID for cloud sync
    providerName: string;
    message: string;
    suggestion?: string;
    daysUntilDue?: number;
    daysOverdue?: number;
    amount: number;
}

// Enhanced stock alerts with AI reasoning
export interface EnhancedStockAlert extends StockAlert {
  aiReasoning?: string;
  predictedStockoutDate?: string;
  recommendedAction?: string;
  purchasePattern?: PurchasePattern | null;
  demandForecast?: DemandForecast;
  seasonalInsights?: string;
}

/**
 * Check for low stock products (legacy function - use generateEnhancedStockAlerts for AI-powered alerts)
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
 * Enhanced checkLowStock with AI analysis (recommended for new implementations)
 */
export async function checkLowStockEnhanced(
  products: Product[],
  sales: Sale[],
  invoices: Invoice[],
  stockMovements: StockMovement[]
): Promise<StockAlert[]> {
  // Use enhanced alerts but return basic StockAlert format for compatibility
  const enhancedAlerts = await generateEnhancedStockAlerts(products, sales, invoices, stockMovements);

  return enhancedAlerts.map(alert => ({
    type: alert.type,
    severity: alert.severity,
    productId: alert.productId,
    productName: alert.productName,
    message: alert.message,
    suggestion: alert.suggestion,
    currentStock: alert.currentStock,
    reorderPoint: alert.reorderPoint
  }));
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
export function getAlertIcon(alert: StockAlert | InvoiceAlert | EnhancedStockAlert): string {
    if (alert.severity === 'critical') return '🚨';
    if (alert.severity === 'warning') return '⚠️';
    return 'ℹ️';
}

/**
 * Generate enhanced stock alerts with AI reasoning
 */
export async function generateEnhancedStockAlerts(
  products: Product[],
  sales: Sale[],
  invoices: Invoice[],
  stockMovements: StockMovement[]
): Promise<EnhancedStockAlert[]> {
  const alerts: EnhancedStockAlert[] = [];

  for (const product of products) {
    if (!product.id) continue;

    try {
      const currentStock = product.currentStock ?? 0;
      const reorderPoint = product.reorderPoint ?? 5;

      // Get AI analysis with error handling
      let demandForecast: DemandForecast;
      let purchasePattern: PurchasePattern | null = null;
      let seasonalTrends: SeasonalTrend | null = null;

      try {
        demandForecast = predictDemand(product, sales, stockMovements);
      } catch (e) {
        console.warn(`Failed to predict demand for ${product.name}:`, e);
        demandForecast = {
          productId: product.id,
          currentStock,
          predictedDaysUntilStockout: currentStock > 0 ? 365 : 0,
          recommendedReorderQuantity: Math.max(0, reorderPoint - currentStock),
          urgency: currentStock === 0 ? 'critical' : currentStock <= reorderPoint ? 'high' : 'low',
          reasoning: 'Basic analysis (prediction unavailable)'
        };
      }

      try {
        purchasePattern = analyzePurchasePatterns(product.id, invoices);
      } catch (e) {
        console.warn(`Failed to analyze purchase patterns for ${product.name}:`, e);
      }

      try {
        seasonalTrends = detectSeasonalTrends(product.id, sales, stockMovements);
      } catch (e) {
        console.warn(`Failed to detect seasonal trends for ${product.name}:`, e);
      }

      // Determine if this needs an alert
      let shouldAlert = false;
      let severity: 'info' | 'warning' | 'critical' = 'info';
      let alertType: StockAlert['type'] = 'low_stock';
      let message = '';
      let aiReasoning = '';
      let recommendedAction = '';

    // Critical: Stock at or below reorder point
    if (currentStock <= reorderPoint && currentStock > 0) {
      shouldAlert = true;
      alertType = 'low_stock';
      severity = currentStock <= reorderPoint * 0.5 ? 'critical' : 'warning';
      message = `${product.name}: Stock bajo (${currentStock} unidades)`;

      aiReasoning = demandForecast.reasoning;
      recommendedAction = `Reordenar ${demandForecast.recommendedReorderQuantity} unidades`;

      if (purchasePattern && purchasePattern.confidence === 'high') {
        const daysSinceLastOrder = purchasePattern.daysSinceLastOrder;
        if (daysSinceLastOrder >= purchasePattern.averageDaysBetweenOrders) {
          recommendedAction += ` - Normalmente ordenas cada ${purchasePattern.averageDaysBetweenOrders} días`;
        }
      }
    }

    // Critical: Out of stock
    if (currentStock === 0) {
      shouldAlert = true;
      alertType = 'out_of_stock';
      severity = 'critical';
      message = `${product.name} está agotado`;

      aiReasoning = `Producto sin stock. ${demandForecast.reasoning}`;
      recommendedAction = `Reordenar inmediatamente ${demandForecast.recommendedReorderQuantity} unidades`;

      if (purchasePattern && purchasePattern.confidence === 'high') {
        recommendedAction += ` - Último pedido hace ${purchasePattern.daysSinceLastOrder} días`;
      }
    }

    // Reorder suggestion based on patterns
    if (purchasePattern && purchasePattern.confidence === 'high' && !shouldAlert) {
      const daysSinceLastOrder = purchasePattern.daysSinceLastOrder;
      const daysUntilNextOrder = purchasePattern.averageDaysBetweenOrders - daysSinceLastOrder;

      if (daysUntilNextOrder <= 2 && daysUntilNextOrder > 0) {
        shouldAlert = true;
        alertType = 'reorder_suggestion';
        severity = 'info';
        message = `${product.name}: Próximo pedido pronto`;

        aiReasoning = `Basado en patrón de compras: ordenas cada ${purchasePattern.averageDaysBetweenOrders} días, típicamente ${purchasePattern.typicalOrderQuantity} unidades`;
        recommendedAction = `Considerar ordenar en los próximos ${daysUntilNextOrder} días`;
      }
    }

    // Weekend preparation for high-demand items
    if (seasonalTrends && seasonalTrends.seasonalMultiplier > 1.3 && !shouldAlert) {
      const today = new Date().getDay();
      const isWeekendApproaching = today >= 4 && today <= 6; // Thursday-Saturday

      if (isWeekendApproaching && currentStock > reorderPoint) {
        shouldAlert = true;
        alertType = 'reorder_suggestion';
        severity = 'info';
        message = `${product.name}: Preparación para fin de semana`;

        aiReasoning = `Demanda ${Math.round(seasonalTrends.seasonalMultiplier * 100)}% mayor en fines de semana`;
        recommendedAction = `Considerar stock adicional para fin de semana turístico`;
      }
    }

    if (shouldAlert) {
      // Calculate predicted stockout date
      let predictedStockoutDate: string | undefined;
      if (demandForecast.predictedDaysUntilStockout <= 30) {
        const stockoutDate = new Date();
        stockoutDate.setDate(stockoutDate.getDate() + demandForecast.predictedDaysUntilStockout);
        predictedStockoutDate = stockoutDate.toLocaleDateString();
      }

      // Add seasonal insights
      let seasonalInsights: string | undefined;
      if (seasonalTrends && seasonalTrends.peakDays.length > 0) {
        const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        seasonalInsights = `Días de mayor demanda: ${seasonalTrends.peakDays.map(d => dayNames[d]).join(', ')}`;
      }

      alerts.push({
        type: alertType,
        severity,
        productId: product.id,
        productName: product.name,
        message,
        suggestion: recommendedAction,
        currentStock,
        reorderPoint,
        aiReasoning,
        predictedStockoutDate,
        recommendedAction,
        purchasePattern,
        demandForecast,
        seasonalInsights
      });
    }
    } catch (error) {
      console.error(`Error processing product ${product.name || product.id}:`, error);
      // Continue to next product instead of crashing the whole function
    }
  }

  return alerts.sort((a, b) => {
    // Sort by severity first, then by stock level
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity];
    }
    return (a.currentStock ?? 0) - (b.currentStock ?? 0);
  });
}

/**
 * Get inventory insights summary
 */
export function getInventoryInsights(
  products: Product[],
  alerts: EnhancedStockAlert[],
  sales: Sale[]
): {
  totalProducts: number;
  outOfStockCount: number;
  lowStockCount: number;
  reorderSuggestionsCount: number;
  totalEstimatedReorderCost: number;
  criticalAlerts: EnhancedStockAlert[];
  insights: string[];
} {
  const totalProducts = products.length;
  const outOfStockCount = alerts.filter(a => a.type === 'out_of_stock').length;
  const lowStockCount = alerts.filter(a => a.type === 'low_stock').length;
  const reorderSuggestionsCount = alerts.filter(a => a.type === 'reorder_suggestion').length;
  const criticalAlerts = alerts.filter(a => a.severity === 'critical');

  // Estimate reorder cost (rough calculation)
  const totalEstimatedReorderCost = alerts.reduce((sum, alert) => {
    if (alert.demandForecast?.recommendedReorderQuantity) {
      const product = products.find(p => p.id === alert.productId);
      const cost = product?.lastPrice || product?.averageCost || 0;
      return sum + (alert.demandForecast.recommendedReorderQuantity * cost);
    }
    return sum;
  }, 0);

  // Generate insights
  const insights: string[] = [];

  if (outOfStockCount > 0) {
    insights.push(`${outOfStockCount} productos agotados - impacta ventas inmediatamente`);
  }

  if (lowStockCount > 0) {
    insights.push(`${lowStockCount} productos con stock bajo - reordenar pronto`);
  }

  if (reorderSuggestionsCount > 0) {
    insights.push(`${reorderSuggestionsCount} sugerencias de reorden - optimizar flujo de caja`);
  }

  // Calculate high velocity products with error handling
  let highVelocityCount = 0;
  try {
    for (const p of products) {
      if (!p.id) continue;
      try {
        const velocity = calculateSalesVelocity(p.id, sales);
        if (velocity.velocity > 5) {
          highVelocityCount++;
        }
      } catch (e) {
        // Skip this product if velocity calculation fails
        console.warn(`Failed to calculate velocity for product ${p.name}:`, e);
      }
    }
  } catch (e) {
    console.error('Failed to calculate high velocity products:', e);
  }

  if (highVelocityCount > 0) {
    insights.push(`${highVelocityCount} productos de alta rotación identificados`);
  }

  return {
    totalProducts,
    outOfStockCount,
    lowStockCount,
    reorderSuggestionsCount,
    totalEstimatedReorderCost: Math.round(totalEstimatedReorderCost * 100) / 100,
    criticalAlerts,
    insights
  };
}

