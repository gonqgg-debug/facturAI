import type { Sale } from '../types';
import type { CustomerSegment, RealTimeInsight, TrafficAnalysis, RevenueForecast, BasketAnalysis } from './types';
import { db } from '../db';

/**
 * Generate real-time insights based on current activity
 */
export async function generateRealTimeInsights(
  recentSales: Sale[],
  activeSegments: CustomerSegment[],
  currentHour: number,
  currentDay: number,
  apiKey?: string
): Promise<RealTimeInsight[]> {
  const insights: RealTimeInsight[] = [];
  
  // Traffic analysis
  const trafficAnalysis = await analyzeTraffic(recentSales, currentHour, currentDay);
  if (trafficAnalysis.isBusy) {
    insights.push({
      insightType: 'traffic',
      message: `🚀 Busy period! ${Math.round(trafficAnalysis.percentageChange)}% more customers than usual`,
      confidence: 0.9,
      actionItems: [
        'Consider opening additional checkout lane',
        'Stock up on popular items',
        'Prepare for increased cash handling'
      ],
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
      createdAt: new Date()
    });
  } else if (trafficAnalysis.isSlow) {
    insights.push({
      insightType: 'traffic',
      message: `📉 Slow period - ${Math.round(Math.abs(trafficAnalysis.percentageChange))}% fewer customers than usual`,
      confidence: 0.8,
      actionItems: [
        'Good time for inventory counting',
        'Consider cleaning and restocking',
        'Prepare for upcoming busy period'
      ],
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      createdAt: new Date()
    });
  }
  
  // Product demand predictions based on active segments
  for (const segment of activeSegments) {
    if (segment.peakHours.includes(currentHour)) {
      const topProducts = segment.topCategories.slice(0, 3);
      insights.push({
        insightType: 'product_demand',
        message: `📈 ${segment.segmentName} customers arriving - expect high demand for ${topProducts.join(', ')}`,
        confidence: segment.confidenceScore,
        actionItems: [
          `Ensure ${topProducts[0]} is well-stocked`,
          'Consider quick checkout for small baskets',
          'Prepare personalized recommendations'
        ],
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
        createdAt: new Date()
      });
    }
  }
  
  // Revenue forecasting
  const revenueForecast = await forecastRevenue(currentHour, currentDay);
  if (revenueForecast.isHighPotential) {
    insights.push({
      insightType: 'revenue',
      message: `💰 High revenue potential: RD$${revenueForecast.predictedRevenue.toLocaleString()} expected vs RD$${revenueForecast.avgRevenue.toLocaleString()} average`,
      confidence: 0.8,
      actionItems: [
        'Maximize upselling opportunities',
        'Ensure all staff are available',
        'Consider extending store hours if applicable'
      ],
      expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours
      createdAt: new Date()
    });
  }
  
  // Basket size analysis
  if (recentSales.length > 0) {
    const basketAnalysis = await analyzeBasketSizes(recentSales, currentHour, currentDay);
    if (basketAnalysis.isLargerThanUsual) {
      insights.push({
        insightType: 'operational',
        message: `🛒 Larger baskets than usual (RD$${basketAnalysis.avgBasketSize.toFixed(0)} vs RD$${basketAnalysis.historicalAvgBasket.toFixed(0)})`,
        confidence: 0.7,
        actionItems: [
          'Focus on upselling complementary items',
          'Ensure adequate bagging supplies',
          'Consider family bundle promotions'
        ],
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
        createdAt: new Date()
      });
    }
  }
  
  // Payroll day insight (15th and 30th)
  const today = new Date().getDate();
  if (today === 15 || today === 30) {
    insights.push({
      insightType: 'operational',
      message: `💵 Payroll day! Expect increased traffic and larger purchases`,
      confidence: 0.95,
      actionItems: [
        'Ensure adequate cash on hand for change',
        'Stock up on bulk items and staples',
        'Prepare for longer checkout lines'
      ],
      expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours
      createdAt: new Date()
    });
  }
  
  return insights;
}

/**
 * Analyze current traffic vs historical average
 */
export async function analyzeTraffic(
  recentSales: Sale[],
  currentHour: number,
  currentDay: number
): Promise<TrafficAnalysis> {
  const currentTraffic = recentSales.length;
  const avgTraffic = await getHistoricalAverage(currentHour, currentDay);
  
  const percentageChange = avgTraffic > 0 
    ? ((currentTraffic - avgTraffic) / avgTraffic) * 100 
    : 0;
  
  return {
    currentTraffic,
    avgTraffic,
    percentageChange,
    isBusy: currentTraffic > avgTraffic * 1.5,
    isSlow: currentTraffic < avgTraffic * 0.5
  };
}

/**
 * Get historical average traffic for hour/day
 */
async function getHistoricalAverage(hour: number, dayOfWeek: number): Promise<number> {
  if (!db) return 0;
  
  try {
    const sales = await db.sales.toArray();
    const relevantSales = sales.filter(sale => {
      const saleDate = new Date(sale.date);
      const saleHour = saleDate.getHours();
      const saleDay = saleDate.getDay();
      const daysAgo = (Date.now() - saleDate.getTime()) / (1000 * 60 * 60 * 24);
      
      return daysAgo <= 30 && saleHour === hour && saleDay === dayOfWeek;
    });
    
    // Count unique days
    const dates = new Set(relevantSales.map(s => s.date.split('T')[0]));
    return relevantSales.length / Math.max(dates.size, 1);
  } catch (error) {
    console.error('Error getting historical average:', error);
    return 0;
  }
}

/**
 * Forecast revenue for current hour/day
 */
export async function forecastRevenue(hour: number, dayOfWeek: number): Promise<RevenueForecast> {
  if (!db) {
    return { predictedRevenue: 0, avgRevenue: 0, percentageChange: 0, isHighPotential: false };
  }
  
  try {
    const sales = await db.sales.toArray();
    const historical = sales.filter(sale => {
      const saleDate = new Date(sale.date);
      const saleHour = saleDate.getHours();
      const saleDay = saleDate.getDay();
      const daysAgo = (Date.now() - saleDate.getTime()) / (1000 * 60 * 60 * 24);
      
      return daysAgo <= 30 && saleHour === hour && saleDay === dayOfWeek;
    });
    
    if (historical.length === 0) {
      return { predictedRevenue: 0, avgRevenue: 0, percentageChange: 0, isHighPotential: false };
    }
    
    const avgRevenue = historical.reduce((sum, s) => sum + s.total, 0) / historical.length;
    
    // Simple prediction: use recent trend
    const recentWeek = historical.filter(s => {
      const daysAgo = (Date.now() - new Date(s.date).getTime()) / (1000 * 60 * 60 * 24);
      return daysAgo <= 7;
    });
    
    const recentAvg = recentWeek.length > 0 
      ? recentWeek.reduce((sum, s) => sum + s.total, 0) / recentWeek.length 
      : avgRevenue;
    
    // Weight recent data more heavily
    const predictedRevenue = (recentAvg * 0.7) + (avgRevenue * 0.3);
    const percentageChange = ((predictedRevenue - avgRevenue) / avgRevenue) * 100;
    
    return {
      predictedRevenue,
      avgRevenue,
      percentageChange,
      isHighPotential: predictedRevenue > avgRevenue * 1.2
    };
  } catch (error) {
    console.error('Error forecasting revenue:', error);
    return { predictedRevenue: 0, avgRevenue: 0, percentageChange: 0, isHighPotential: false };
  }
}

/**
 * Analyze current basket sizes vs historical
 */
async function analyzeBasketSizes(
  recentSales: Sale[],
  hour: number,
  dayOfWeek: number
): Promise<BasketAnalysis> {
  const avgBasketSize = recentSales.reduce((sum, s) => sum + s.total, 0) / recentSales.length;
  const historicalAvgBasket = await getHistoricalBasketSize(hour, dayOfWeek);
  
  const percentageChange = historicalAvgBasket > 0 
    ? ((avgBasketSize - historicalAvgBasket) / historicalAvgBasket) * 100 
    : 0;
  
  return {
    avgBasketSize,
    historicalAvgBasket,
    percentageChange,
    isLargerThanUsual: avgBasketSize > historicalAvgBasket * 1.3
  };
}

/**
 * Get historical basket size average
 */
async function getHistoricalBasketSize(hour: number, dayOfWeek: number): Promise<number> {
  if (!db) return 0;
  
  try {
    const sales = await db.sales.toArray();
    const historical = sales.filter(sale => {
      const saleDate = new Date(sale.date);
      const saleHour = saleDate.getHours();
      const saleDay = saleDate.getDay();
      const daysAgo = (Date.now() - saleDate.getTime()) / (1000 * 60 * 60 * 24);
      
      return daysAgo <= 30 && saleHour === hour && saleDay === dayOfWeek;
    });
    
    if (historical.length === 0) return 0;
    
    return historical.reduce((sum, s) => sum + s.total, 0) / historical.length;
  } catch (error) {
    console.error('Error getting historical basket size:', error);
    return 0;
  }
}

/**
 * Get sales from the last N minutes
 */
export async function getRecentSales(minutes: number = 60): Promise<Sale[]> {
  if (!db) return [];
  
  try {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    const sales = await db.sales.toArray();
    
    return sales.filter(sale => new Date(sale.date) >= cutoff);
  } catch (error) {
    console.error('Error getting recent sales:', error);
    return [];
  }
}

/**
 * Get today's sales
 */
export async function getTodaySales(): Promise<Sale[]> {
  if (!db) return [];
  
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const sales = await db.sales.toArray();
    return sales.filter(sale => new Date(sale.date) >= today);
  } catch (error) {
    console.error('Error getting today sales:', error);
    return [];
  }
}

/**
 * Calculate daily summary
 */
export async function getDailySummary(): Promise<{
  totalSales: number;
  totalRevenue: number;
  avgBasketSize: number;
  peakHour: number;
  topCategories: string[];
}> {
  const todaySales = await getTodaySales();
  
  if (todaySales.length === 0) {
    return {
      totalSales: 0,
      totalRevenue: 0,
      avgBasketSize: 0,
      peakHour: 0,
      topCategories: []
    };
  }
  
  const totalRevenue = todaySales.reduce((sum, s) => sum + s.total, 0);
  
  // Find peak hour
  const hourCounts: Record<number, number> = {};
  todaySales.forEach(sale => {
    const hour = new Date(sale.date).getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  });
  
  const peakHour = Object.entries(hourCounts)
    .sort(([,a], [,b]) => b - a)[0]?.[0] || '0';
  
  // Find top categories
  const categoryCounts: Record<string, number> = {};
  todaySales.forEach(sale => {
    sale.items.forEach(item => {
      // Simple categorization based on description
      const desc = item.description.toLowerCase();
      let category = 'other';
      if (desc.includes('cerveza') || desc.includes('ron')) category = 'alcohol';
      else if (desc.includes('arroz') || desc.includes('habichuela')) category = 'staples';
      else if (desc.includes('refresco') || desc.includes('agua')) category = 'beverages';
      
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });
  });
  
  const topCategories = Object.entries(categoryCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([cat]) => cat);
  
  return {
    totalSales: todaySales.length,
    totalRevenue,
    avgBasketSize: totalRevenue / todaySales.length,
    peakHour: parseInt(peakHour),
    topCategories
  };
}

