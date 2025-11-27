import type { Sale } from '../types';
import type { TransactionFeatures } from './types';
import { db } from '../db';

/**
 * Predict demand for a specific hour and day
 */
export async function predictDemand(
  targetHour: number,
  targetDay: number,
  lookbackDays: number = 30
): Promise<{
  expectedTransactions: number;
  expectedRevenue: number;
  confidence: number;
  topCategories: string[];
}> {
  if (!db) {
    return { expectedTransactions: 0, expectedRevenue: 0, confidence: 0, topCategories: [] };
  }
  
  try {
    const sales = await db.sales.toArray();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);
    
    const historicalSales = sales.filter(sale => {
      const saleDate = new Date(sale.date);
      const saleHour = saleDate.getHours();
      const saleDay = saleDate.getDay();
      
      return saleDate >= cutoffDate && saleHour === targetHour && saleDay === targetDay;
    });
    
    if (historicalSales.length === 0) {
      return { expectedTransactions: 0, expectedRevenue: 0, confidence: 0, topCategories: [] };
    }
    
    // Count unique dates to calculate averages
    const uniqueDates = new Set(historicalSales.map(s => s.date.split('T')[0]));
    const numDays = uniqueDates.size;
    
    const totalRevenue = historicalSales.reduce((sum, s) => sum + s.total, 0);
    
    // Calculate category distribution
    const categoryCounts: Record<string, number> = {};
    historicalSales.forEach(sale => {
      sale.items.forEach(item => {
        const desc = item.description.toLowerCase();
        let category = 'other';
        if (desc.includes('cerveza') || desc.includes('ron') || desc.includes('beer')) category = 'alcohol';
        else if (desc.includes('arroz') || desc.includes('habichuela') || desc.includes('azucar')) category = 'staples';
        else if (desc.includes('refresco') || desc.includes('agua') || desc.includes('jugo')) category = 'beverages';
        else if (desc.includes('pan') || desc.includes('queso') || desc.includes('leche')) category = 'bakery_dairy';
        else if (desc.includes('jabon') || desc.includes('detergente')) category = 'household';
        
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
      });
    });
    
    const topCategories = Object.entries(categoryCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([cat]) => cat);
    
    // Calculate confidence based on data volume
    let confidence = 0.5;
    if (numDays >= 4) confidence = 0.7;
    if (numDays >= 8) confidence = 0.85;
    if (numDays >= 12) confidence = 0.95;
    
    return {
      expectedTransactions: Math.round(historicalSales.length / numDays),
      expectedRevenue: totalRevenue / numDays,
      confidence,
      topCategories
    };
  } catch (error) {
    console.error('Error predicting demand:', error);
    return { expectedTransactions: 0, expectedRevenue: 0, confidence: 0, topCategories: [] };
  }
}

/**
 * Predict daily revenue
 */
export async function predictDailyRevenue(
  targetDay: number,
  lookbackWeeks: number = 4
): Promise<{
  expectedRevenue: number;
  minRevenue: number;
  maxRevenue: number;
  confidence: number;
}> {
  if (!db) {
    return { expectedRevenue: 0, minRevenue: 0, maxRevenue: 0, confidence: 0 };
  }
  
  try {
    const sales = await db.sales.toArray();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - (lookbackWeeks * 7));
    
    // Group sales by date
    const dailyRevenue: Record<string, number> = {};
    
    sales.forEach(sale => {
      const saleDate = new Date(sale.date);
      if (saleDate >= cutoffDate && saleDate.getDay() === targetDay) {
        const dateKey = saleDate.toISOString().split('T')[0];
        dailyRevenue[dateKey] = (dailyRevenue[dateKey] || 0) + sale.total;
      }
    });
    
    const revenues = Object.values(dailyRevenue);
    
    if (revenues.length === 0) {
      return { expectedRevenue: 0, minRevenue: 0, maxRevenue: 0, confidence: 0 };
    }
    
    const avgRevenue = revenues.reduce((sum, r) => sum + r, 0) / revenues.length;
    const minRevenue = Math.min(...revenues);
    const maxRevenue = Math.max(...revenues);
    
    // Calculate confidence
    let confidence = 0.5;
    if (revenues.length >= 2) confidence = 0.7;
    if (revenues.length >= 4) confidence = 0.85;
    if (revenues.length >= 6) confidence = 0.95;
    
    return {
      expectedRevenue: avgRevenue,
      minRevenue,
      maxRevenue,
      confidence
    };
  } catch (error) {
    console.error('Error predicting daily revenue:', error);
    return { expectedRevenue: 0, minRevenue: 0, maxRevenue: 0, confidence: 0 };
  }
}

/**
 * Predict weekly pattern
 */
export async function predictWeeklyPattern(
  lookbackWeeks: number = 4
): Promise<{
  dayPatterns: Array<{
    day: number;
    dayName: string;
    expectedRevenue: number;
    expectedTransactions: number;
    peakHours: number[];
  }>;
  bestDay: number;
  worstDay: number;
}> {
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  if (!db) {
    return { dayPatterns: [], bestDay: 0, worstDay: 0 };
  }
  
  try {
    const sales = await db.sales.toArray();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - (lookbackWeeks * 7));
    
    const filteredSales = sales.filter(s => new Date(s.date) >= cutoffDate);
    
    // Group by day of week
    const dayData: Record<number, { revenue: number; count: number; hours: Record<number, number> }> = {};
    
    for (let i = 0; i < 7; i++) {
      dayData[i] = { revenue: 0, count: 0, hours: {} };
    }
    
    filteredSales.forEach(sale => {
      const saleDate = new Date(sale.date);
      const day = saleDate.getDay();
      const hour = saleDate.getHours();
      
      dayData[day].revenue += sale.total;
      dayData[day].count++;
      dayData[day].hours[hour] = (dayData[day].hours[hour] || 0) + 1;
    });
    
    // Calculate unique weeks for averaging
    const uniqueWeeks = new Set(
      filteredSales.map(s => {
        const d = new Date(s.date);
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        return weekStart.toISOString().split('T')[0];
      })
    ).size || 1;
    
    const dayPatterns = Object.entries(dayData).map(([day, data]) => {
      const peakHours = Object.entries(data.hours)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .map(([h]) => parseInt(h));
      
      return {
        day: parseInt(day),
        dayName: DAY_NAMES[parseInt(day)],
        expectedRevenue: data.revenue / uniqueWeeks,
        expectedTransactions: data.count / uniqueWeeks,
        peakHours
      };
    });
    
    // Find best and worst days
    const sortedByRevenue = [...dayPatterns].sort((a, b) => b.expectedRevenue - a.expectedRevenue);
    
    return {
      dayPatterns,
      bestDay: sortedByRevenue[0]?.day || 0,
      worstDay: sortedByRevenue[sortedByRevenue.length - 1]?.day || 0
    };
  } catch (error) {
    console.error('Error predicting weekly pattern:', error);
    return { dayPatterns: [], bestDay: 0, worstDay: 0 };
  }
}

/**
 * Predict hourly pattern for a specific day
 */
export async function predictHourlyPattern(
  targetDay: number,
  lookbackWeeks: number = 4
): Promise<Array<{
  hour: number;
  expectedRevenue: number;
  expectedTransactions: number;
}>> {
  if (!db) return [];
  
  try {
    const sales = await db.sales.toArray();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - (lookbackWeeks * 7));
    
    const filteredSales = sales.filter(s => {
      const d = new Date(s.date);
      return d >= cutoffDate && d.getDay() === targetDay;
    });
    
    // Group by hour
    const hourData: Record<number, { revenue: number; count: number }> = {};
    
    for (let i = 0; i < 24; i++) {
      hourData[i] = { revenue: 0, count: 0 };
    }
    
    filteredSales.forEach(sale => {
      const hour = new Date(sale.date).getHours();
      hourData[hour].revenue += sale.total;
      hourData[hour].count++;
    });
    
    // Calculate unique days for averaging
    const uniqueDays = new Set(
      filteredSales.map(s => new Date(s.date).toISOString().split('T')[0])
    ).size || 1;
    
    return Object.entries(hourData).map(([hour, data]) => ({
      hour: parseInt(hour),
      expectedRevenue: data.revenue / uniqueDays,
      expectedTransactions: data.count / uniqueDays
    }));
  } catch (error) {
    console.error('Error predicting hourly pattern:', error);
    return [];
  }
}

/**
 * Detect seasonal patterns (payroll days, holidays)
 */
export async function detectSeasonalPatterns(
  lookbackDays: number = 90
): Promise<{
  payrollDayMultiplier: number;
  weekendMultiplier: number;
  monthStartMultiplier: number;
  monthEndMultiplier: number;
}> {
  if (!db) {
    return {
      payrollDayMultiplier: 1,
      weekendMultiplier: 1,
      monthStartMultiplier: 1,
      monthEndMultiplier: 1
    };
  }
  
  try {
    const sales = await db.sales.toArray();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);
    
    const filteredSales = sales.filter(s => new Date(s.date) >= cutoffDate);
    
    // Group sales by date
    const dailyRevenue: Record<string, { revenue: number; date: Date }> = {};
    
    filteredSales.forEach(sale => {
      const dateKey = sale.date.split('T')[0];
      if (!dailyRevenue[dateKey]) {
        dailyRevenue[dateKey] = { revenue: 0, date: new Date(sale.date) };
      }
      dailyRevenue[dateKey].revenue += sale.total;
    });
    
    const days = Object.values(dailyRevenue);
    if (days.length === 0) {
      return {
        payrollDayMultiplier: 1,
        weekendMultiplier: 1,
        monthStartMultiplier: 1,
        monthEndMultiplier: 1
      };
    }
    
    const avgRevenue = days.reduce((sum, d) => sum + d.revenue, 0) / days.length;
    
    // Calculate multipliers
    const payrollDays = days.filter(d => {
      const date = d.date.getDate();
      return date === 15 || date === 30 || date === 31;
    });
    
    const weekends = days.filter(d => {
      const day = d.date.getDay();
      return day === 0 || day === 6;
    });
    
    const monthStart = days.filter(d => d.date.getDate() <= 5);
    const monthEnd = days.filter(d => d.date.getDate() >= 25);
    
    const calcMultiplier = (subset: typeof days) => {
      if (subset.length === 0) return 1;
      const subsetAvg = subset.reduce((sum, d) => sum + d.revenue, 0) / subset.length;
      return avgRevenue > 0 ? subsetAvg / avgRevenue : 1;
    };
    
    return {
      payrollDayMultiplier: calcMultiplier(payrollDays),
      weekendMultiplier: calcMultiplier(weekends),
      monthStartMultiplier: calcMultiplier(monthStart),
      monthEndMultiplier: calcMultiplier(monthEnd)
    };
  } catch (error) {
    console.error('Error detecting seasonal patterns:', error);
    return {
      payrollDayMultiplier: 1,
      weekendMultiplier: 1,
      monthStartMultiplier: 1,
      monthEndMultiplier: 1
    };
  }
}

