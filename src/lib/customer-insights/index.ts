// Main entry point for customer insights module
export * from './types';
export * from './feature-extractor';
export * from './clustering';
export * from './ai-analysis';
export * from './real-time';
export * from './prediction';
export * from './utils';

// Re-export commonly used functions with cleaner names
export { 
  extractTransactionFeatures,
  batchExtractFeatures,
  categorizeProduct 
} from './feature-extractor';

export {
  clusterByTimeOfDay,
  clusterByBasketValue,
  clusterByProductPreference,
  runAllClustering,
  getSegmentSummary
} from './clustering';

export {
  analyzeSegmentPersonality,
  enhanceSegmentsWithAI,
  batchAnalyzeSegments
} from './ai-analysis';

export {
  generateRealTimeInsights,
  analyzeTraffic,
  forecastRevenue,
  getRecentSales,
  getTodaySales,
  getDailySummary
} from './real-time';

export {
  predictDemand,
  predictDailyRevenue,
  predictWeeklyPattern,
  predictHourlyPattern,
  detectSeasonalPatterns
} from './prediction';

