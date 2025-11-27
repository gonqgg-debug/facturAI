import type { TransactionFeatures, CustomerSegment } from './types';
import type { PaymentMethodType } from '../types';

/**
 * Cluster transactions by time of day
 */
export function clusterByTimeOfDay(features: TransactionFeatures[]): CustomerSegment[] {
  const timeClusters = [
    { 
      name: 'Morning Commute', 
      hours: [6, 7, 8, 9], 
      description: 'Early morning quick purchases - coffee, breakfast items' 
    },
    { 
      name: 'Mid-Morning', 
      hours: [10, 11], 
      description: 'Late morning shoppers - household errands' 
    },
    { 
      name: 'Lunch Rush', 
      hours: [12, 13, 14], 
      description: 'Midday meal and refreshment buyers' 
    },
    { 
      name: 'Afternoon', 
      hours: [15, 16], 
      description: 'Afternoon shoppers - school pickup, snacks' 
    },
    { 
      name: 'After Work', 
      hours: [17, 18, 19, 20], 
      description: 'Evening shoppers buying dinner items and household needs' 
    },
    { 
      name: 'Late Night', 
      hours: [21, 22, 23, 0, 1, 2], 
      description: 'Night owls buying snacks, drinks, and convenience items' 
    }
  ];
  
  return timeClusters.map(cluster => {
    const clusterTransactions = features.filter(f => 
      cluster.hours.includes(f.hourOfDay)
    );
    
    if (clusterTransactions.length === 0) return null;
    
    const totalValue = clusterTransactions.reduce((sum, t) => sum + t.totalValue, 0);
    const totalItems = clusterTransactions.reduce((sum, t) => sum + t.itemCount, 0);
    
    // Calculate top categories
    const categoryCounts: Record<string, number> = {};
    clusterTransactions.forEach(t => {
      t.categories.forEach(cat => {
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      });
    });
    
    const topCategories = Object.entries(categoryCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([cat]) => cat);
    
    // Calculate payment preferences
    const paymentCounts: Record<PaymentMethodType, number> = {} as Record<PaymentMethodType, number>;
    clusterTransactions.forEach(t => {
      paymentCounts[t.paymentMethod] = (paymentCounts[t.paymentMethod] || 0) + 1;
    });
    
    const paymentPreferences = Object.fromEntries(
      Object.entries(paymentCounts).map(([method, count]) => 
        [method, count / clusterTransactions.length]
      )
    ) as Record<PaymentMethodType, number>;
    
    // Calculate peak days
    const dayCounts: Record<number, number> = {};
    clusterTransactions.forEach(t => {
      dayCounts[t.dayOfWeek] = (dayCounts[t.dayOfWeek] || 0) + 1;
    });
    
    const peakDays = Object.entries(dayCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([day]) => parseInt(day));
    
    return {
      segmentId: `time_${cluster.name.toLowerCase().replace(/\s+/g, '_')}`,
      segmentName: cluster.name,
      segmentType: 'temporal' as const,
      transactionCount: clusterTransactions.length,
      avgBasketValue: totalValue / clusterTransactions.length,
      avgItemsPerBasket: totalItems / clusterTransactions.length,
      peakHours: cluster.hours,
      peakDays,
      confidenceScore: calculateConfidence(clusterTransactions),
      topCategories,
      paymentPreferences,
      frequencyPattern: determineFrequency(clusterTransactions),
      personaDescription: '',
      marketingRecommendations: [],
      operationalInsights: [],
      lastUpdated: new Date()
    } as CustomerSegment;
  }).filter(Boolean) as CustomerSegment[];
}

/**
 * Cluster transactions by basket value
 */
export function clusterByBasketValue(features: TransactionFeatures[]): CustomerSegment[] {
  const valueClusters = [
    { 
      name: 'Quick Picks', 
      maxValue: 200, 
      description: 'Small, impulse purchases - water, cigarettes, single items' 
    },
    { 
      name: 'Regular Shoppers', 
      maxValue: 500, 
      minValue: 200, 
      description: 'Daily household needs - groceries for cooking' 
    },
    { 
      name: 'Big Shoppers', 
      maxValue: 1000, 
      minValue: 500, 
      description: 'Weekly family shopping - larger baskets' 
    },
    { 
      name: 'Bulk Buyers', 
      minValue: 1000, 
      description: 'Large purchases, events, or business customers' 
    }
  ];
  
  return valueClusters.map(cluster => {
    const clusterTransactions = features.filter(f => 
      (!cluster.minValue || f.totalValue >= cluster.minValue) &&
      (!cluster.maxValue || f.totalValue < cluster.maxValue)
    );
    
    if (clusterTransactions.length === 0) return null;
    
    const totalValue = clusterTransactions.reduce((sum, t) => sum + t.totalValue, 0);
    const totalItems = clusterTransactions.reduce((sum, t) => sum + t.itemCount, 0);
    
    // Calculate top categories
    const categoryCounts: Record<string, number> = {};
    clusterTransactions.forEach(t => {
      t.categories.forEach(cat => {
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      });
    });
    
    const topCategories = Object.entries(categoryCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([cat]) => cat);
    
    return {
      segmentId: `value_${cluster.name.toLowerCase().replace(/\s+/g, '_')}`,
      segmentName: cluster.name,
      segmentType: 'basket_value' as const,
      transactionCount: clusterTransactions.length,
      avgBasketValue: totalValue / clusterTransactions.length,
      avgItemsPerBasket: totalItems / clusterTransactions.length,
      peakHours: findPeakHours(clusterTransactions),
      peakDays: findPeakDays(clusterTransactions),
      confidenceScore: calculateConfidence(clusterTransactions),
      topCategories,
      paymentPreferences: calculatePaymentPreferences(clusterTransactions),
      frequencyPattern: determineFrequency(clusterTransactions),
      personaDescription: '',
      marketingRecommendations: [],
      operationalInsights: [],
      lastUpdated: new Date()
    } as CustomerSegment;
  }).filter(Boolean) as CustomerSegment[];
}

/**
 * Cluster transactions by product preference
 */
export function clusterByProductPreference(features: TransactionFeatures[]): CustomerSegment[] {
  const preferenceClusters = [
    {
      name: 'Beer & Snacks',
      condition: (f: TransactionFeatures) => f.hasAlcohol && f.hasSnacks,
      description: 'Social buyers - beer and snacks for gatherings'
    },
    {
      name: 'Household Essentials',
      condition: (f: TransactionFeatures) => f.hasHouseholdItems,
      description: 'Household managers - cleaning and maintenance items'
    },
    {
      name: 'Fresh Food Shoppers',
      condition: (f: TransactionFeatures) => f.hasFreshProduce,
      description: 'Fresh food buyers - cooking from scratch'
    },
    {
      name: 'Convenience Buyers',
      condition: (f: TransactionFeatures) => f.hasBeverages && f.isSmallBasket,
      description: 'Quick convenience purchases - drinks and small items'
    },
    {
      name: 'Family Providers',
      condition: (f: TransactionFeatures) => f.isLargeBasket && f.categories.length >= 4,
      description: 'Large family shopping - diverse basket composition'
    }
  ];
  
  return preferenceClusters.map(cluster => {
    const clusterTransactions = features.filter(cluster.condition);
    
    if (clusterTransactions.length === 0) return null;
    
    const totalValue = clusterTransactions.reduce((sum, t) => sum + t.totalValue, 0);
    const totalItems = clusterTransactions.reduce((sum, t) => sum + t.itemCount, 0);
    
    // Calculate top categories
    const categoryCounts: Record<string, number> = {};
    clusterTransactions.forEach(t => {
      t.categories.forEach(cat => {
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      });
    });
    
    const topCategories = Object.entries(categoryCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([cat]) => cat);
    
    return {
      segmentId: `pref_${cluster.name.toLowerCase().replace(/\s+/g, '_')}`,
      segmentName: cluster.name,
      segmentType: 'product_preference' as const,
      transactionCount: clusterTransactions.length,
      avgBasketValue: totalValue / clusterTransactions.length,
      avgItemsPerBasket: totalItems / clusterTransactions.length,
      peakHours: findPeakHours(clusterTransactions),
      peakDays: findPeakDays(clusterTransactions),
      confidenceScore: calculateConfidence(clusterTransactions),
      topCategories,
      paymentPreferences: calculatePaymentPreferences(clusterTransactions),
      frequencyPattern: determineFrequency(clusterTransactions),
      personaDescription: '',
      marketingRecommendations: [],
      operationalInsights: [],
      lastUpdated: new Date()
    } as CustomerSegment;
  }).filter(Boolean) as CustomerSegment[];
}

/**
 * Run all clustering algorithms
 */
export function runAllClustering(features: TransactionFeatures[]): {
  temporalSegments: CustomerSegment[];
  valueSegments: CustomerSegment[];
  preferenceSegments: CustomerSegment[];
} {
  return {
    temporalSegments: clusterByTimeOfDay(features),
    valueSegments: clusterByBasketValue(features),
    preferenceSegments: clusterByProductPreference(features)
  };
}

/**
 * Calculate confidence score for a cluster
 */
function calculateConfidence(transactions: TransactionFeatures[]): number {
  if (transactions.length < 10) return 0.3;
  if (transactions.length < 50) return 0.6;
  if (transactions.length < 100) return 0.8;
  return 0.9;
}

/**
 * Determine frequency pattern
 */
function determineFrequency(transactions: TransactionFeatures[]): 'daily' | 'weekly' | 'occasional' {
  if (transactions.length === 0) return 'occasional';
  
  const uniqueDays = new Set(transactions.map(t => t.timestamp.toDateString())).size;
  const totalDays = transactions.length;
  const frequency = uniqueDays / totalDays;
  
  if (frequency > 0.7) return 'daily';
  if (frequency > 0.3) return 'weekly';
  return 'occasional';
}

/**
 * Find peak hours for a cluster
 */
function findPeakHours(transactions: TransactionFeatures[]): number[] {
  const hourCounts: Record<number, number> = {};
  transactions.forEach(t => {
    hourCounts[t.hourOfDay] = (hourCounts[t.hourOfDay] || 0) + 1;
  });
  
  return Object.entries(hourCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 4)
    .map(([hour]) => parseInt(hour));
}

/**
 * Find peak days for a cluster
 */
function findPeakDays(transactions: TransactionFeatures[]): number[] {
  const dayCounts: Record<number, number> = {};
  transactions.forEach(t => {
    dayCounts[t.dayOfWeek] = (dayCounts[t.dayOfWeek] || 0) + 1;
  });
  
  return Object.entries(dayCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([day]) => parseInt(day));
}

/**
 * Calculate payment preferences
 */
function calculatePaymentPreferences(transactions: TransactionFeatures[]): Record<PaymentMethodType, number> {
  const paymentCounts: Record<string, number> = {};
  transactions.forEach(t => {
    paymentCounts[t.paymentMethod] = (paymentCounts[t.paymentMethod] || 0) + 1;
  });
  
  return Object.fromEntries(
    Object.entries(paymentCounts).map(([method, count]) => 
      [method, count / transactions.length]
    )
  ) as Record<PaymentMethodType, number>;
}

/**
 * Get segment summary statistics
 */
export function getSegmentSummary(segments: CustomerSegment[]): {
  totalSegments: number;
  totalTransactions: number;
  avgConfidence: number;
  topSegmentsByVolume: CustomerSegment[];
  topSegmentsByValue: CustomerSegment[];
} {
  const totalTransactions = segments.reduce((sum, s) => sum + s.transactionCount, 0);
  const avgConfidence = segments.reduce((sum, s) => sum + s.confidenceScore, 0) / segments.length;
  
  const topSegmentsByVolume = [...segments]
    .sort((a, b) => b.transactionCount - a.transactionCount)
    .slice(0, 5);
  
  const topSegmentsByValue = [...segments]
    .sort((a, b) => b.avgBasketValue - a.avgBasketValue)
    .slice(0, 5);
  
  return {
    totalSegments: segments.length,
    totalTransactions,
    avgConfidence,
    topSegmentsByVolume,
    topSegmentsByValue
  };
}

