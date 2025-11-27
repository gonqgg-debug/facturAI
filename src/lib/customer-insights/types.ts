import type { PaymentMethodType } from '../types';

export interface TransactionFeatures {
  id?: number;
  // Temporal features
  timestamp: Date;
  hourOfDay: number;        // 0-23
  dayOfWeek: number;        // 0-6 (Sunday-Saturday)
  weekOfMonth: number;      // 1-4
  isWeekend: boolean;
  isPayrollDay: boolean;    // 15th, 30th (Dominican payroll days)
  
  // Basket composition
  totalValue: number;
  itemCount: number;
  categories: string[];
  categoryWeights: Record<string, number>; // % of basket by category
  
  // Product preferences
  hasAlcohol: boolean;
  hasFreshProduce: boolean;
  hasHouseholdItems: boolean;
  hasSnacks: boolean;
  hasBeverages: boolean;
  
  // Purchase behavior
  avgItemPrice: number;
  paymentMethod: PaymentMethodType;
  isLargeBasket: boolean;   // >$500
  isSmallBasket: boolean;   // <$100
  
  // Operational context
  cashierId?: number;
  shiftId?: number;
}

export interface CustomerSegment {
  id?: number;
  segmentId: string;
  segmentName: string;
  segmentType: 'temporal' | 'basket_value' | 'product_preference';
  transactionCount: number;
  avgBasketValue: number;
  avgItemsPerBasket: number;
  peakHours: number[];
  peakDays: number[];
  confidenceScore: number;
  topCategories: string[];
  paymentPreferences: Record<PaymentMethodType, number>;
  frequencyPattern: 'daily' | 'weekly' | 'occasional';
  personaDescription: string;
  marketingRecommendations: string[];
  operationalInsights: string[];
  lastUpdated: Date;
}

export interface RealTimeInsight {
  id?: number;
  insightType: 'traffic' | 'revenue' | 'product_demand' | 'operational';
  message: string;
  confidence: number;
  actionItems?: string[];
  expiresAt?: Date;
  createdAt: Date;
}

// Traffic analysis result
export interface TrafficAnalysis {
  currentTraffic: number;
  avgTraffic: number;
  percentageChange: number;
  isBusy: boolean;
  isSlow: boolean;
}

// Revenue forecast result
export interface RevenueForecast {
  predictedRevenue: number;
  avgRevenue: number;
  percentageChange: number;
  isHighPotential: boolean;
}

// Basket analysis result
export interface BasketAnalysis {
  avgBasketSize: number;
  historicalAvgBasket: number;
  percentageChange: number;
  isLargerThanUsual: boolean;
}

// Insight generation options
export interface InsightGenerationOptions {
  includeTraffic?: boolean;
  includeRevenue?: boolean;
  includeProductDemand?: boolean;
  includeOperational?: boolean;
  apiKey?: string;
}

// AI Analysis response
export interface AIAnalysisResponse {
  personaDescription: string;
  marketingRecommendations: string[];
  operationalInsights: string[];
}

// Clustering result
export interface ClusteringResult {
  temporalSegments: CustomerSegment[];
  valueSegments: CustomerSegment[];
  preferenceSegments: CustomerSegment[];
  totalTransactions: number;
  analysisDate: Date;
}

