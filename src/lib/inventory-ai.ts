import type { Product, Invoice, Sale, StockMovement } from './types';
import { db } from './db';
import { getCsrfHeader } from './csrf';

// Simple cache for AI responses (in-memory with localStorage backup)
interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class AICache {
  private cache = new Map<string, CacheEntry>();
  private readonly CACHE_KEY = 'inventory_ai_cache';

  constructor() {
    this.loadFromStorage();
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.saveToStorage();
      return null;
    }

    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMinutes: number = 60): void {
    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      ttl: ttlMinutes * 60 * 1000
    };

    this.cache.set(key, entry);
    this.saveToStorage();
  }

  clear(): void {
    this.cache.clear();
    localStorage.removeItem(this.CACHE_KEY);
  }

  private saveToStorage(): void {
    try {
      const cacheObject = Object.fromEntries(this.cache);
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(cacheObject));
    } catch (error) {
      console.warn('Failed to save AI cache to localStorage:', error);
    }
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.CACHE_KEY);
      if (stored) {
        const cacheObject = JSON.parse(stored);
        this.cache = new Map(Object.entries(cacheObject));
      }
    } catch (error) {
      console.warn('Failed to load AI cache from localStorage:', error);
    }
  }
}

const aiCache = new AICache();

// Background processing cache for forecasts and patterns
interface BackgroundCache {
  lastUpdated: Date;
  purchasePatterns: Record<number, PurchasePattern>;
  demandForecasts: Record<number, DemandForecast>;
  salesVelocities: Record<number, { velocity: number; trend: 'up' | 'down' | 'stable'; confidence: number }>;
}

let backgroundCache: BackgroundCache | null = null;
const CACHE_DURATION_HOURS = 24; // Recalculate every 24 hours

// Purchase pattern analysis interfaces
export interface PurchasePattern {
  productId: number;
  averageDaysBetweenOrders: number;
  typicalOrderDay: number; // 0=Sunday, 6=Saturday
  typicalOrderQuantity: number;
  lastOrderDate: string;
  daysSinceLastOrder: number;
  confidence: 'high' | 'medium' | 'low';
}

// Seasonal trend analysis interfaces
export interface SeasonalTrend {
  productId: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  seasonalMultiplier: number; // e.g., 1.5x for weekends
  peakDays: number[]; // Days of week with higher demand
}

// Demand forecast interfaces
export interface DemandForecast {
  productId: number;
  currentStock: number;
  predictedDaysUntilStockout: number;
  recommendedReorderQuantity: number;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  reasoning: string; // AI-generated explanation
}

// Shopping list interfaces
export interface ShoppingListItem {
  productId: number;
  productName: string;
  supplierId?: number;
  supplierName?: string;
  currentStock: number;
  recommendedQuantity: number;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  reasoning: string; // AI explanation
  estimatedCost: number;
  category: string;
}

export interface SmartShoppingList {
  items: ShoppingListItem[];
  totalEstimatedCost: number;
  groupedBySupplier: Record<number, ShoppingListItem[]>;
  aiSummary: string; // Overall AI analysis
  generatedAt: Date;
}

/**
 * Analyze when products are typically purchased
 */
export function analyzePurchasePatterns(
  productId: number,
  invoices: Invoice[],
  daysToAnalyze: number = 90
): PurchasePattern | null {
  // Get all stock movements for this product where type='in' (purchases)
  const purchaseMovements = invoices
    .flatMap(invoice =>
      invoice.items
        .filter(item => {
          // For now, we'll consider all items since we don't have direct product linking in this context
          // In a full implementation, this would check against the actual product catalog
          return item.quantity > 0; // Just filter out items with zero quantity
        })
        .map(item => ({
          date: invoice.issueDate,
          quantity: item.quantity,
          dayOfWeek: new Date(invoice.issueDate).getDay()
        }))
    )
    .filter(movement => movement.quantity > 0)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (purchaseMovements.length < 2) {
    return null; // Not enough data
  }

  // Filter to last N days
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToAnalyze);
  const recentPurchases = purchaseMovements.filter(
    movement => new Date(movement.date) >= cutoffDate
  );

  if (recentPurchases.length < 2) {
    return null;
  }

  // Calculate average days between orders
  const intervals: number[] = [];
  for (let i = 1; i < recentPurchases.length; i++) {
    const prevDate = new Date(recentPurchases[i-1].date);
    const currDate = new Date(recentPurchases[i].date);
    const daysDiff = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
    intervals.push(daysDiff);
  }

  const averageDaysBetweenOrders = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;

  // Find most common order day
  const dayCounts: Record<number, number> = {};
  recentPurchases.forEach(purchase => {
    dayCounts[purchase.dayOfWeek] = (dayCounts[purchase.dayOfWeek] || 0) + 1;
  });

  const typicalOrderDay = parseInt(Object.entries(dayCounts)
    .sort(([,a], [,b]) => b - a)[0][0]);

  // Calculate typical order quantity
  const quantities = recentPurchases.map(p => p.quantity);
  const typicalOrderQuantity = quantities.reduce((sum, val) => sum + val, 0) / quantities.length;

  // Calculate last order date and days since
  const lastOrderDate = recentPurchases[recentPurchases.length - 1].date;
  const daysSinceLastOrder = Math.floor(
    (new Date().getTime() - new Date(lastOrderDate).getTime()) / (1000 * 60 * 60 * 24)
  );

  // Determine confidence based on data quality
  let confidence: 'high' | 'medium' | 'low' = 'low';
  if (recentPurchases.length >= 5 && intervals.length >= 3) {
    confidence = 'high';
  } else if (recentPurchases.length >= 3 && intervals.length >= 2) {
    confidence = 'medium';
  }

  return {
    productId,
    averageDaysBetweenOrders: Math.round(averageDaysBetweenOrders),
    typicalOrderDay,
    typicalOrderQuantity: Math.round(typicalOrderQuantity),
    lastOrderDate,
    daysSinceLastOrder,
    confidence
  };
}

/**
 * Detect seasonal trends in sales
 */
export function detectSeasonalTrends(
  productId: number,
  sales: Sale[],
  stockMovements: StockMovement[]
): SeasonalTrend | null {
  // Get sales data for this product over last 60 days
  const productSales = sales
    .flatMap(sale =>
      sale.items
        .filter(item => item.productId === productId.toString())
        .map(item => ({
          date: sale.date,
          dayOfWeek: new Date(sale.date).getDay(),
          quantity: item.quantity
        }))
    )
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (productSales.length < 14) { // Need at least 2 weeks of data
    return null;
  }

  // Group by day of week
  const dayOfWeekData: Record<number, { totalQuantity: number; count: number; dates: string[] }> = {};

  productSales.forEach(sale => {
    if (!dayOfWeekData[sale.dayOfWeek]) {
      dayOfWeekData[sale.dayOfWeek] = { totalQuantity: 0, count: 0, dates: [] };
    }
    dayOfWeekData[sale.dayOfWeek].totalQuantity += sale.quantity;
    dayOfWeekData[sale.dayOfWeek].count += 1;
    dayOfWeekData[sale.dayOfWeek].dates.push(sale.date);
  });

  // Calculate average sales per day of week
  const dayAverages: Record<number, number> = {};
  Object.entries(dayOfWeekData).forEach(([day, data]) => {
    dayAverages[parseInt(day)] = data.totalQuantity / data.count;
  });

  // Find overall average
  const overallAverage = Object.values(dayAverages).reduce((sum, avg) => sum + avg, 0) /
                        Object.values(dayAverages).length;

  // Identify peak days (days with significantly higher sales)
  const peakDays = Object.entries(dayAverages)
    .filter(([, avg]) => avg > overallAverage * 1.2) // 20% above average
    .map(([day]) => parseInt(day))
    .sort((a, b) => a - b);

  // Calculate seasonal multiplier (highest day average / overall average)
  const maxAverage = Math.max(...Object.values(dayAverages));
  const seasonalMultiplier = maxAverage / overallAverage;

  // Determine trend (simplified - could be enhanced with linear regression)
  const recentSales = productSales.slice(-14); // Last 14 days
  const olderSales = productSales.slice(-28, -14); // Previous 14 days

  const recentAverage = recentSales.reduce((sum, sale) => sum + sale.quantity, 0) / recentSales.length;
  const olderAverage = olderSales.length > 0 ?
    olderSales.reduce((sum, sale) => sum + sale.quantity, 0) / olderSales.length : recentAverage;

  let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
  if (recentAverage > olderAverage * 1.1) {
    trend = 'increasing';
  } else if (recentAverage < olderAverage * 0.9) {
    trend = 'decreasing';
  }

  return {
    productId,
    trend,
    seasonalMultiplier: Math.round(seasonalMultiplier * 100) / 100,
    peakDays
  };
}

/**
 * Calculate sales velocity with trend analysis
 */
export function calculateSalesVelocity(
  productId: number,
  sales: Sale[],
  days: number = 30
): {
  velocity: number; // units per day
  trend: 'up' | 'down' | 'stable';
  confidence: number; // 0-1
} {
  // Get sales data for this product
  const productSales = sales
    .flatMap(sale =>
      sale.items
        .filter(item => item.productId === productId.toString())
        .map(item => ({
          date: sale.date,
          quantity: item.quantity
        }))
    )
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (productSales.length === 0) {
    return { velocity: 0, trend: 'stable', confidence: 0 };
  }

  // Filter to last N days
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const recentSales = productSales.filter(
    sale => new Date(sale.date) >= cutoffDate
  );

  if (recentSales.length === 0) {
    return { velocity: 0, trend: 'stable', confidence: 0 };
  }

  // Calculate total units sold in period
  const totalUnits = recentSales.reduce((sum, sale) => sum + sale.quantity, 0);
  const velocity = totalUnits / days;

  // Calculate trend using linear regression on daily sales
  const dailySales: Record<string, number> = {};
  recentSales.forEach(sale => {
    dailySales[sale.date] = (dailySales[sale.date] || 0) + sale.quantity;
  });

  const dailyData = Object.entries(dailySales)
    .map(([date, quantity]) => ({
      day: Math.floor((new Date(date).getTime() - cutoffDate.getTime()) / (1000 * 60 * 60 * 24)),
      quantity
    }))
    .sort((a, b) => a.day - b.day);

  let trend: 'up' | 'down' | 'stable' = 'stable';
  let confidence = 0;

  if (dailyData.length >= 7) { // Need at least a week of data
    // Simple linear regression
    const n = dailyData.length;
    const sumX = dailyData.reduce((sum, d) => sum + d.day, 0);
    const sumY = dailyData.reduce((sum, d) => sum + d.quantity, 0);
    const sumXY = dailyData.reduce((sum, d) => sum + d.day * d.quantity, 0);
    const sumXX = dailyData.reduce((sum, d) => sum + d.day * d.day, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

    if (slope > 0.1) {
      trend = 'up';
    } else if (slope < -0.1) {
      trend = 'down';
    }

    // Calculate R-squared for confidence
    const meanY = sumY / n;
    const ssRes = dailyData.reduce((sum, d) => {
      const predicted = slope * d.day + (meanY - slope * (sumX / n));
      return sum + Math.pow(d.quantity - predicted, 2);
    }, 0);
    const ssTot = dailyData.reduce((sum, d) => sum + Math.pow(d.quantity - meanY, 2), 0);
    const rSquared = 1 - (ssRes / ssTot);

    confidence = Math.min(1, Math.max(0, rSquared));
  }

  return {
    velocity: Math.round(velocity * 100) / 100,
    trend,
    confidence: Math.round(confidence * 100) / 100
  };
}

/**
 * Predict demand and calculate reorder requirements
 */
export function predictDemand(
  product: Product,
  sales: Sale[],
  stockMovements: StockMovement[],
  daysAhead: number = 7
): DemandForecast {
  if (!product.id) {
    throw new Error('Product ID required for demand prediction');
  }

  const currentStock = product.currentStock ?? 0;
  const reorderPoint = product.reorderPoint ?? 5;

  // Try to use cached velocity first, fall back to calculation
  const cachedVelocity = getCachedSalesVelocity(product.id);
  const velocityData = cachedVelocity || calculateSalesVelocity(product.id, sales);
  const salesVelocity = velocityData.velocity;

  // Get seasonal trends
  const seasonalTrend = detectSeasonalTrends(product.id!, sales, stockMovements);
  const seasonalMultiplier = seasonalTrend?.seasonalMultiplier ?? 1;

  // Calculate adjusted velocity for the forecast period
  const adjustedVelocity = salesVelocity * seasonalMultiplier;

  // Predict days until stockout
  let predictedDaysUntilStockout = currentStock / adjustedVelocity;
  if (!isFinite(predictedDaysUntilStockout) || predictedDaysUntilStockout > 365) {
    predictedDaysUntilStockout = 365; // Cap at 1 year
  }

  // Calculate recommended reorder quantity
  // Formula: (Velocity × Lead Time × Safety Buffer) - Current Stock
  const leadTime = 2; // Assume 2 days lead time (configurable)
  const safetyBuffer = 1.2; // 20% safety buffer
  const reorderQuantity = Math.max(0, Math.ceil(adjustedVelocity * leadTime * safetyBuffer - currentStock));

  // Determine urgency
  let urgency: 'critical' | 'high' | 'medium' | 'low' = 'low';
  if (predictedDaysUntilStockout <= 1) {
    urgency = 'critical';
  } else if (predictedDaysUntilStockout <= 3) {
    urgency = 'high';
  } else if (predictedDaysUntilStockout <= 7) {
    urgency = 'medium';
  }

  // Generate reasoning
  const reasoningParts = [];

  if (salesVelocity > 0) {
    reasoningParts.push(`Sells ${salesVelocity} units/day`);
  } else {
    reasoningParts.push('No recent sales data');
  }

  if (seasonalMultiplier > 1) {
    reasoningParts.push(`Seasonal demand ${Math.round(seasonalMultiplier * 100)}% above average`);
  }

  if (predictedDaysUntilStockout <= 30) {
    reasoningParts.push(`Stock will last ${Math.round(predictedDaysUntilStockout)} days`);
  } else {
    reasoningParts.push('Stock level appears sufficient');
  }

  const reasoning = reasoningParts.join('. ') + '.';

  return {
    productId: product.id!,
    currentStock,
    predictedDaysUntilStockout: Math.round(predictedDaysUntilStockout),
    recommendedReorderQuantity: reorderQuantity,
    urgency,
    reasoning
  };
}

/**
 * Generate AI analysis prompt for inventory decisions
 */
export function generateInventoryAnalysisPrompt(
  product: Product,
  salesHistory: Sale[],
  purchaseHistory: Invoice[],
  currentStock: number
): string {
  const velocity = calculateSalesVelocity(product.id!, salesHistory);
  const purchasePattern = analyzePurchasePatterns(product.id!, purchaseHistory);

  return `
    Analyze inventory for a Dominican colmado (mini market).

    PRODUCT: ${product.name}
    Current Stock: ${currentStock} units
    Sales Velocity: ${velocity.velocity} units/day (trend: ${velocity.trend})
    Last Sale: ${product.lastSaleDate || 'Never'}
    Last Purchase: ${product.lastDate || 'Never'}

    SALES HISTORY (last 30 days):
    ${formatSalesHistory(salesHistory.slice(-10))}

    PURCHASE PATTERN:
    ${purchasePattern ? `Orders every ${purchasePattern.averageDaysBetweenOrders} days, typically on day ${purchasePattern.typicalOrderDay} of week` : 'Insufficient purchase history'}

    Provide:
    1. Predicted days until stockout
    2. Recommended reorder quantity
    3. Reasoning (consider: sales velocity, seasonal trends, typical order patterns)
    4. Urgency level (critical/high/medium/low)

    Return JSON:
    {
      "predictedDaysUntilStockout": number,
      "recommendedReorderQuantity": number,
      "reasoning": "string",
      "urgency": "critical" | "high" | "medium" | "low"
    }
  `;
}

/**
 * Helper function to format sales history for AI prompts
 */
function formatSalesHistory(sales: Sale[]): string {
  return sales
    .slice(-10) // Last 10 sales
    .map(sale => {
      const items = sale.items.filter(item => item.quantity > 0);
      return `${sale.date}: ${items.length} items, ${items.reduce((sum, item) => sum + item.quantity, 0)} units total`;
    })
    .join('\n');
}

/**
 * Helper function to format purchase history for AI prompts
 */
function formatPurchaseHistory(invoices: Invoice[]): string {
  return invoices
    .slice(-5) // Last 5 invoices
    .map(invoice => {
      const relevantItems = invoice.items.filter(item => item.quantity > 0);
      return `${invoice.issueDate}: ${relevantItems.length} items from ${invoice.providerName}`;
    })
    .join('\n');
}

/**
 * Generate smart shopping list with AI analysis
 */
export async function generateSmartShoppingList(
  products: Product[],
  sales: Sale[],
  invoices: Invoice[],
  stockMovements: StockMovement[]
): Promise<SmartShoppingList> {

  const items: ShoppingListItem[] = [];
  let totalEstimatedCost = 0;

  // Process products in batches to avoid API rate limits
  const batchSize = 5;
  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);

    for (const product of batch) {
      if (!product.id) continue;

      try {
        // Get demand forecast
        const forecast = predictDemand(product, sales, stockMovements);

        // Skip products that don't need reordering
        if (forecast.urgency === 'low' && forecast.recommendedReorderQuantity <= 0) {
          continue;
        }

        // Get AI reasoning for this specific product
        const aiAnalysis = await getProductAIReasoning(product, sales, invoices, forecast);

        // Calculate estimated cost
        const costPerUnit = product.lastPrice || product.averageCost || 0;
        const estimatedCost = aiAnalysis.recommendedReorderQuantity * costPerUnit;

        // Get supplier info
        const supplier = await getProductSupplier(product.id);

        const item: ShoppingListItem = {
          productId: product.id,
          productName: product.name,
          supplierId: supplier?.id,
          supplierName: supplier?.name || 'Unknown',
          currentStock: product.currentStock ?? 0,
          recommendedQuantity: aiAnalysis.recommendedReorderQuantity,
          urgency: aiAnalysis.urgency,
          reasoning: aiAnalysis.reasoning,
          estimatedCost,
          category: product.category || 'General'
        };

        items.push(item);
        totalEstimatedCost += estimatedCost;

      } catch (error) {
        console.warn(`Failed to analyze product ${product.name}:`, error);
        // Fallback to basic forecast without AI
        const forecast = predictDemand(product, sales, stockMovements);
        if (forecast.recommendedReorderQuantity > 0) {
          const costPerUnit = product.lastPrice || product.averageCost || 0;
          const supplier = await getProductSupplier(product.id);

          items.push({
            productId: product.id,
            productName: product.name,
            supplierId: supplier?.id,
            supplierName: supplier?.name || 'Unknown',
            currentStock: product.currentStock ?? 0,
            recommendedQuantity: forecast.recommendedReorderQuantity,
            urgency: forecast.urgency,
            reasoning: `Basic analysis: ${forecast.reasoning}`,
            estimatedCost: forecast.recommendedReorderQuantity * costPerUnit,
            category: product.category || 'General'
          });
          totalEstimatedCost += forecast.recommendedReorderQuantity * costPerUnit;
        }
      }
    }

    // Small delay between batches to respect API limits
    if (i + batchSize < products.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Group by supplier
  const groupedBySupplier: Record<number, ShoppingListItem[]> = {};
  items.forEach(item => {
    if (item.supplierId) {
      if (!groupedBySupplier[item.supplierId]) {
        groupedBySupplier[item.supplierId] = [];
      }
      groupedBySupplier[item.supplierId].push(item);
    }
  });

  // Generate AI summary
  const aiSummary = await generateShoppingListSummary(items, apiKey);

  return {
    items: items.sort((a, b) => {
      // Sort by urgency first, then by estimated cost
      const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
        return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      }
      return b.estimatedCost - a.estimatedCost;
    }),
    totalEstimatedCost: Math.round(totalEstimatedCost * 100) / 100,
    groupedBySupplier,
    aiSummary,
    generatedAt: new Date()
  };
}

/**
 * Get AI reasoning for a specific product
 */
async function getProductAIReasoning(
  product: Product,
  sales: Sale[],
  invoices: Invoice[],
  forecast: DemandForecast
): Promise<{
  recommendedReorderQuantity: number;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  reasoning: string;
}> {
  // Create cache key based on product data and recent activity
  const cacheKey = `product_analysis_${product.id}_${product.currentStock}_${product.lastSaleDate || 'never'}_${forecast.predictedDaysUntilStockout}`;

  // Check cache first (valid for 2 hours)
  const cached = aiCache.get<{
    recommendedReorderQuantity: number;
    urgency: 'critical' | 'high' | 'medium' | 'low';
    reasoning: string;
  }>(cacheKey);

  if (cached) {
    console.log(`Using cached AI analysis for ${product.name}`);
    return cached;
  }

  const prompt = generateInventoryAnalysisPrompt(product, sales, invoices, product.currentStock ?? 0);

  try {
    const response = await fetch('/api/grok', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        ...getCsrfHeader()
      },
      body: JSON.stringify({
        model: 'grok-3',
        messages: [
          {
            role: 'system',
            content: 'You are an expert inventory analyst for Dominican colmados. Provide concise, actionable recommendations in JSON format only.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No response content');
    }

    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content.replace(/```json\n?|```/g, '').trim();
    const aiResponse = JSON.parse(jsonStr);

    const result = {
      recommendedReorderQuantity: Math.max(0, aiResponse.recommendedReorderQuantity || forecast.recommendedReorderQuantity),
      urgency: aiResponse.urgency || forecast.urgency,
      reasoning: aiResponse.reasoning || forecast.reasoning
    };

    // Cache the result for 2 hours
    aiCache.set(cacheKey, result, 120);

    return result;

  } catch (error) {
    console.warn('AI analysis failed, using fallback:', error);
    const fallback = {
      recommendedReorderQuantity: forecast.recommendedReorderQuantity,
      urgency: forecast.urgency,
      reasoning: `Fallback analysis: ${forecast.reasoning}`
    };

    // Cache fallback result for 30 minutes
    aiCache.set(cacheKey, fallback, 30);

    return fallback;
  }
}

/**
 * Get supplier information for a product
 */
async function getProductSupplier(productId: number) {
  try {
    const product = await db.products.get(productId);
    if (product?.supplierId) {
      return await db.suppliers.get(product.supplierId);
    }
  } catch (error) {
    console.warn('Failed to get supplier for product:', productId, error);
  }
  return null;
}

/**
 * Generate AI summary for the entire shopping list
 */
async function generateShoppingListSummary(items: ShoppingListItem[], apiKey: string): Promise<string> {
  if (items.length === 0) {
    return 'No items require reordering at this time.';
  }

  // Create cache key based on shopping list summary
  const totalItems = items.length;
  const criticalCount = items.filter(i => i.urgency === 'critical').length;
  const totalCost = items.reduce((sum, item) => sum + item.estimatedCost, 0);
  const cacheKey = `shopping_list_summary_${totalItems}_${criticalCount}_${Math.round(totalCost)}`;

  // Check cache first (valid for 1 hour)
  const cached = aiCache.get<string>(cacheKey);
  if (cached) {
    console.log('Using cached shopping list summary');
    return cached;
  }

  const summaryPrompt = `
    Summarize this shopping list for a Dominican colmado:

    ITEMS: ${items.length} products need reordering
    CRITICAL: ${items.filter(i => i.urgency === 'critical').length} items
    HIGH: ${items.filter(i => i.urgency === 'high').length} items
    MEDIUM: ${items.filter(i => i.urgency === 'medium').length} items
    LOW: ${items.filter(i => i.urgency === 'low').length} items

    TOP ITEMS BY COST:
    ${items.slice(0, 5).map(item =>
      `${item.productName}: ${item.recommendedQuantity} units ($${item.estimatedCost.toFixed(2)})`
    ).join('\n')}

    Provide a brief, actionable summary (2-3 sentences) for the store owner.
  `;

  try {
    const response = await fetch('/api/grok', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        ...getCsrfHeader()
      },
      body: JSON.stringify({
        model: 'grok-3',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful inventory advisor for small businesses. Provide concise, actionable summaries.'
          },
          { role: 'user', content: summaryPrompt }
        ],
        temperature: 0.3,
        max_tokens: 200
      })
    });

    if (response.ok) {
      const data = await response.json();
      const summary = data.choices?.[0]?.message?.content || 'Shopping list generated successfully.';

      // Cache the summary for 1 hour
      aiCache.set(cacheKey, summary, 60);

      return summary;
    }
  } catch (error) {
    console.warn('Failed to generate AI summary:', error);
  }

  // Fallback summary
  const fallbackSummary = `${items.length} products need reordering (${criticalCount} critical). Estimated cost: $${totalCost.toFixed(2)}. Focus on high-priority items first.`;

  // Cache fallback for 30 minutes
  aiCache.set(cacheKey, fallbackSummary, 30);

  return fallbackSummary;
}

/**
 * Background processing: Recalculate all forecasts and patterns
 * This should be called periodically (e.g., daily) to keep forecasts fresh
 */
export async function updateBackgroundCache(): Promise<void> {
  try {
    console.log('Starting background cache update...');

    // Load all data
    const products = await db.products.toArray();
    const sales = await db.sales.toArray();
    const invoices = await db.invoices.toArray();
    const stockMovements = await db.stockMovements.toArray();

    const purchasePatterns: Record<number, PurchasePattern> = {};
    const demandForecasts: Record<number, DemandForecast> = {};
    const salesVelocities: Record<number, { velocity: number; trend: 'up' | 'down' | 'stable'; confidence: number }> = {};

    // Process each product
    for (const product of products) {
      if (!product.id) continue;

      try {
        // Calculate purchase patterns (only for products with sufficient history)
        const pattern = analyzePurchasePatterns(product.id, invoices, 90);
        if (pattern) {
          purchasePatterns[product.id] = pattern;
        }

        // Calculate demand forecast
        const forecast = predictDemand(product, sales, stockMovements);
        demandForecasts[product.id] = forecast;

        // Calculate sales velocity
        const velocity = calculateSalesVelocity(product.id, sales);
        salesVelocities[product.id] = velocity;

      } catch (error) {
        console.warn(`Failed to process product ${product.name}:`, error);
      }
    }

    // Update cache
    backgroundCache = {
      lastUpdated: new Date(),
      purchasePatterns,
      demandForecasts,
      salesVelocities
    };

    console.log(`Background cache updated: ${products.length} products processed`);

  } catch (error) {
    console.error('Failed to update background cache:', error);
  }
}

/**
 * Get cached forecast data (returns null if cache is stale)
 */
export function getCachedForecast(productId: number): DemandForecast | null {
  if (!backgroundCache) return null;

  // Check if cache is stale
  const hoursSinceUpdate = (Date.now() - backgroundCache.lastUpdated.getTime()) / (1000 * 60 * 60);
  if (hoursSinceUpdate > CACHE_DURATION_HOURS) {
    backgroundCache = null; // Invalidate cache
    return null;
  }

  return backgroundCache.demandForecasts[productId] || null;
}

/**
 * Get cached purchase pattern
 */
export function getCachedPurchasePattern(productId: number): PurchasePattern | null {
  if (!backgroundCache) return null;

  const hoursSinceUpdate = (Date.now() - backgroundCache.lastUpdated.getTime()) / (1000 * 60 * 60);
  if (hoursSinceUpdate > CACHE_DURATION_HOURS) {
    backgroundCache = null;
    return null;
  }

  return backgroundCache.purchasePatterns[productId] || null;
}

/**
 * Get cached sales velocity
 */
export function getCachedSalesVelocity(productId: number): { velocity: number; trend: 'up' | 'down' | 'stable'; confidence: number } | null {
  if (!backgroundCache) return null;

  const hoursSinceUpdate = (Date.now() - backgroundCache.lastUpdated.getTime()) / (1000 * 60 * 60);
  if (hoursSinceUpdate > CACHE_DURATION_HOURS) {
    backgroundCache = null;
    return null;
  }

  return backgroundCache.salesVelocities[productId] || null;
}

/**
 * Initialize background processing (call this on app startup)
 */
export function initializeBackgroundProcessing(): void {
  // Load cache from localStorage if available
  try {
    const stored = localStorage.getItem('inventory_background_cache');
    if (stored) {
      const parsed = JSON.parse(stored);
      // Only use if not too old
      const hoursSinceUpdate = (Date.now() - new Date(parsed.lastUpdated).getTime()) / (1000 * 60 * 60);
      if (hoursSinceUpdate <= CACHE_DURATION_HOURS) {
        backgroundCache = {
          lastUpdated: new Date(parsed.lastUpdated),
          purchasePatterns: parsed.purchasePatterns,
          demandForecasts: parsed.demandForecasts,
          salesVelocities: parsed.salesVelocities
        };
      }
    }
  } catch (error) {
    console.warn('Failed to load background cache from localStorage:', error);
  }

  // Set up periodic updates (every 24 hours)
  if (typeof window !== 'undefined') {
    setInterval(async () => {
      await updateBackgroundCache();
    }, CACHE_DURATION_HOURS * 60 * 60 * 1000);

    // Also update when the app becomes visible (user returns to tab)
    document.addEventListener('visibilitychange', async () => {
      if (!document.hidden && (!backgroundCache || (Date.now() - backgroundCache.lastUpdated.getTime()) > (6 * 60 * 60 * 1000))) {
        // If cache is more than 6 hours old when user returns
        await updateBackgroundCache();
      }
    });
  }
}

/**
 * Save background cache to localStorage
 */
export function saveBackgroundCache(): void {
  if (backgroundCache) {
    try {
      localStorage.setItem('inventory_background_cache', JSON.stringify(backgroundCache));
    } catch (error) {
      console.warn('Failed to save background cache to localStorage:', error);
    }
  }
}

// Auto-save cache periodically
if (typeof window !== 'undefined') {
  setInterval(saveBackgroundCache, 5 * 60 * 1000); // Save every 5 minutes
}
