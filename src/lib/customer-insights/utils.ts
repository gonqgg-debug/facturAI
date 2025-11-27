import type { CustomerSegment, TransactionFeatures, RealTimeInsight } from './types';

/**
 * Format currency in Dominican Pesos
 */
export function formatCurrency(amount: number): string {
  return `RD$${amount.toLocaleString('es-DO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/**
 * Format percentage
 */
export function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * Get day name from day number (0-6)
 */
export function getDayName(day: number, locale: 'en' | 'es' = 'es'): string {
  const days = {
    en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    es: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  };
  return days[locale][day] || '';
}

/**
 * Get short day name
 */
export function getShortDayName(day: number, locale: 'en' | 'es' = 'es'): string {
  const days = {
    en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    es: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  };
  return days[locale][day] || '';
}

/**
 * Format hour for display
 */
export function formatHour(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

/**
 * Get category display name
 */
export function getCategoryDisplayName(category: string, locale: 'en' | 'es' = 'es'): string {
  const names: Record<string, Record<string, string>> = {
    alcohol: { en: 'Alcohol', es: 'Bebidas Alcohólicas' },
    staples: { en: 'Staples', es: 'Básicos' },
    bakery_dairy: { en: 'Bakery & Dairy', es: 'Panadería y Lácteos' },
    household: { en: 'Household', es: 'Hogar' },
    snacks: { en: 'Snacks', es: 'Snacks' },
    beverages: { en: 'Beverages', es: 'Bebidas' },
    fresh: { en: 'Fresh Produce', es: 'Productos Frescos' },
    protein: { en: 'Meat & Protein', es: 'Carnes y Proteínas' },
    tobacco: { en: 'Tobacco', es: 'Tabaco' },
    personal_care: { en: 'Personal Care', es: 'Cuidado Personal' },
    other: { en: 'Other', es: 'Otros' }
  };
  return names[category]?.[locale] || category;
}

/**
 * Get segment type display name
 */
export function getSegmentTypeDisplayName(type: string, locale: 'en' | 'es' = 'es'): string {
  const names: Record<string, Record<string, string>> = {
    temporal: { en: 'Time-based', es: 'Por Horario' },
    basket_value: { en: 'By Basket Value', es: 'Por Valor de Compra' },
    product_preference: { en: 'By Product Preference', es: 'Por Preferencia de Producto' }
  };
  return names[type]?.[locale] || type;
}

/**
 * Get insight type icon
 */
export function getInsightTypeIcon(type: RealTimeInsight['insightType']): string {
  const icons: Record<string, string> = {
    traffic: '👥',
    revenue: '💰',
    product_demand: '📦',
    operational: '⚙️'
  };
  return icons[type] || '📊';
}

/**
 * Get confidence level label
 */
export function getConfidenceLabel(confidence: number, locale: 'en' | 'es' = 'es'): string {
  if (confidence >= 0.9) return locale === 'es' ? 'Muy Alta' : 'Very High';
  if (confidence >= 0.7) return locale === 'es' ? 'Alta' : 'High';
  if (confidence >= 0.5) return locale === 'es' ? 'Media' : 'Medium';
  return locale === 'es' ? 'Baja' : 'Low';
}

/**
 * Get confidence color class
 */
export function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.9) return 'text-green-600';
  if (confidence >= 0.7) return 'text-blue-600';
  if (confidence >= 0.5) return 'text-yellow-600';
  return 'text-red-600';
}

/**
 * Sort segments by relevance for current time
 */
export function sortSegmentsByRelevance(
  segments: CustomerSegment[],
  currentHour: number,
  currentDay: number
): CustomerSegment[] {
  return [...segments].sort((a, b) => {
    // Prioritize segments active at current hour
    const aActiveNow = a.peakHours.includes(currentHour) ? 1 : 0;
    const bActiveNow = b.peakHours.includes(currentHour) ? 1 : 0;
    
    if (aActiveNow !== bActiveNow) return bActiveNow - aActiveNow;
    
    // Then by confidence
    if (a.confidenceScore !== b.confidenceScore) {
      return b.confidenceScore - a.confidenceScore;
    }
    
    // Then by transaction count
    return b.transactionCount - a.transactionCount;
  });
}

/**
 * Filter active insights (not expired)
 */
export function filterActiveInsights(insights: RealTimeInsight[]): RealTimeInsight[] {
  const now = new Date();
  return insights.filter(insight => {
    if (!insight.expiresAt) return true;
    return new Date(insight.expiresAt) > now;
  });
}

/**
 * Group insights by type
 */
export function groupInsightsByType(insights: RealTimeInsight[]): Record<string, RealTimeInsight[]> {
  return insights.reduce((acc, insight) => {
    if (!acc[insight.insightType]) {
      acc[insight.insightType] = [];
    }
    acc[insight.insightType].push(insight);
    return acc;
  }, {} as Record<string, RealTimeInsight[]>);
}

/**
 * Calculate time until next peak hour for a segment
 */
export function getTimeUntilNextPeak(segment: CustomerSegment, currentHour: number): number {
  const sortedHours = [...segment.peakHours].sort((a, b) => a - b);
  
  // Find next peak hour
  for (const hour of sortedHours) {
    if (hour > currentHour) {
      return hour - currentHour;
    }
  }
  
  // Wrap around to next day
  if (sortedHours.length > 0) {
    return (24 - currentHour) + sortedHours[0];
  }
  
  return 0;
}

/**
 * Generate summary text for a segment
 */
export function generateSegmentSummary(segment: CustomerSegment, locale: 'en' | 'es' = 'es'): string {
  const avgBasket = formatCurrency(segment.avgBasketValue);
  const peakHours = segment.peakHours.map(formatHour).join(', ');
  const topCats = segment.topCategories.slice(0, 3).map(c => getCategoryDisplayName(c, locale)).join(', ');
  
  if (locale === 'es') {
    return `Promedio de compra ${avgBasket}, más activo a las ${peakHours}. Categorías principales: ${topCats}.`;
  }
  
  return `Average basket ${avgBasket}, most active at ${peakHours}. Top categories: ${topCats}.`;
}

/**
 * Check if today is a payroll day (Dominican: 15th and 30th)
 */
export function isPayrollDay(date: Date = new Date()): boolean {
  const day = date.getDate();
  return day === 15 || day === 30;
}

/**
 * Check if current time is during peak hours
 */
export function isDuringPeakHours(segment: CustomerSegment, currentHour: number = new Date().getHours()): boolean {
  return segment.peakHours.includes(currentHour);
}

/**
 * Calculate segment growth (comparing to previous period)
 */
export function calculateSegmentGrowth(
  currentCount: number,
  previousCount: number
): { growth: number; isGrowing: boolean; label: string } {
  if (previousCount === 0) {
    return { growth: 0, isGrowing: true, label: 'New' };
  }
  
  const growth = ((currentCount - previousCount) / previousCount) * 100;
  
  return {
    growth,
    isGrowing: growth > 0,
    label: growth > 0 ? `+${growth.toFixed(1)}%` : `${growth.toFixed(1)}%`
  };
}

