# AI-Powered Customer Insights for Anonymous Customers
## Implementation Plan

## Executive Summary

This plan outlines the implementation of an AI-powered customer intelligence system that analyzes behavioral patterns from anonymous transactions (95% of customer base) to create actionable insights, predict demand, and optimize operations. The system leverages existing sales data and Grok API infrastructure to provide CRM-level intelligence without requiring customer registration.

## Business Objectives

- **Understand Customer Behavior**: Identify distinct customer segments based on purchase patterns
- **Predict Demand**: Forecast traffic and revenue by time/day/season
- **Optimize Operations**: Provide real-time insights for staffing, inventory, and marketing
- **Increase Revenue**: Improve basket sizes through targeted recommendations
- **Reduce Costs**: Optimize inventory and staffing based on predicted demand

## Technical Architecture

### Core Components

1. **Transaction Feature Extractor** (`src/lib/customer-insights/feature-extractor.ts`)
   - Extracts temporal, basket, and behavioral features from sales
   - Categorizes products and identifies purchase patterns
   - Handles Dominican-specific patterns (payroll days, holidays)

2. **Behavioral Clustering Engine** (`src/lib/customer-insights/clustering.ts`)
   - Rule-based clustering (Phase 1)
   - AI-enhanced clustering (Phase 2)
   - Segment identification and profiling

3. **AI Analysis Module** (`src/lib/customer-insights/ai-analysis.ts`)
   - Segment personality analysis using Grok API
   - Marketing recommendation generation
   - Operational insight creation

4. **Real-Time Insights Engine** (`src/lib/customer-insights/real-time.ts`)
   - Traffic anomaly detection
   - Demand prediction
   - Revenue forecasting
   - Operational alerts

5. **Dashboard UI** (`src/routes/insights/+page.svelte`)
   - Real-time insights feed
   - Customer segment visualization
   - Traffic pattern charts
   - Revenue forecasting display

## Implementation Phases

### Phase 1: Data Foundation (Week 1)

#### Tasks:
1. **Create Feature Extraction Module**
   - Implement `extractTransactionFeatures()` function
   - Build product categorization logic
   - Add Dominican-specific pattern detection (payroll days, holidays)
   - Create batch processing for historical data

2. **Implement Basic Clustering**
   - Time-based clustering (Morning, Lunch, After Work, Late Night)
   - Value-based clustering (Quick Picks, Regular, Big Shoppers, Bulk)
   - Product preference clustering (Beer & Snacks, Household, Fresh, Convenience)
   - Confidence scoring algorithm

3. **Database Schema Extension**
   - Add `customerSegments` table to `src/lib/db.ts`
   - Add `transactionFeatures` table for caching
   - Add `realTimeInsights` table
   - Update `src/lib/types.ts` with new interfaces

4. **Background Processing Setup**
   - Create daily feature extraction job
   - Implement clustering recalculation (runs nightly)
   - Add caching mechanism for performance

**Deliverables:**
- Feature extraction working on all sales data
- 8-12 distinct customer segments identified
- Database schema updated
- Basic clustering dashboard showing segments

### Phase 2: AI-Powered Analysis (Week 2)

#### Tasks:
1. **AI Segment Personality Analysis**
   - Implement `analyzeSegmentPersonality()` function
   - Create Grok API integration for persona generation
   - Generate marketing recommendations per segment
   - Create operational insights per segment

2. **Predictive Pattern Recognition**
   - Implement `predictDemandPattern()` function
   - Build time-series analysis for traffic prediction
   - Create seasonal pattern detection
   - Add revenue forecasting algorithm

3. **Real-Time Insights Generator**
   - Implement `generateRealTimeInsights()` function
   - Create traffic anomaly detection
   - Build product demand alerts
   - Add revenue forecasting insights

4. **Caching & Performance Optimization**
   - Implement AI response caching (2-hour TTL)
   - Add batch processing for multiple segments
   - Optimize database queries
   - Add incremental updates

**Deliverables:**
- AI-generated personas for all segments
- Marketing recommendations per segment
- Real-time insights working
- Traffic prediction accuracy >70%

### Phase 3: UI Integration (Week 3)

#### Tasks:
1. **Customer Insights Dashboard**
   - Create `src/routes/insights/+page.svelte`
   - Build real-time insights feed component
   - Implement segment overview cards
   - Add traffic pattern visualization
   - Create revenue forecasting charts

2. **Enhanced Sales Interface**
   - Add real-time insights overlay to `src/routes/sales/+page.svelte`
   - Display current traffic status
   - Show basket size alerts
   - Add product demand predictions
   - Include cashier recommendations

3. **Background Processing Integration**
   - Add insights store to `src/lib/stores.ts`
   - Initialize background processing in `src/routes/+layout.svelte`
   - Create periodic update mechanism
   - Add error handling and retry logic

4. **Export & Reporting**
   - Add segment data export (Excel)
   - Create daily insights report
   - Build weekly summary reports
   - Add custom date range analysis

**Deliverables:**
- Fully functional insights dashboard
- Real-time insights in sales interface
- Background processing running
- Export functionality working

### Phase 4: Testing & Optimization (Week 4)

#### Tasks:
1. **Validation & Testing**
   - Test clustering accuracy with historical data
   - Validate AI-generated insights quality
   - Test prediction accuracy
   - Performance testing with large datasets

2. **User Feedback Integration**
   - Gather staff feedback on insights usefulness
   - Refine AI prompts based on feedback
   - Adjust clustering thresholds
   - Improve recommendation quality

3. **Performance Optimization**
   - Optimize database queries
   - Improve caching strategies
   - Reduce API calls through batching
   - Add lazy loading for dashboard

4. **Documentation**
   - Create user guide for insights dashboard
   - Document API usage
   - Add code comments
   - Create troubleshooting guide

**Deliverables:**
- System validated and tested
- Performance optimized
- Documentation complete
- Ready for production

## File Structure

```
src/lib/customer-insights/
├── types.ts                    # TypeScript interfaces
├── feature-extractor.ts        # Transaction feature extraction
├── clustering.ts               # Clustering algorithms
├── ai-analysis.ts             # AI-powered analysis
├── real-time.ts               # Real-time insights generation
├── prediction.ts              # Demand and revenue prediction
└── utils.ts                   # Helper functions

src/routes/insights/
└── +page.svelte               # Insights dashboard

src/lib/db.ts                  # Database schema updates
src/lib/types.ts               # Type definitions
src/lib/stores.ts              # Insights store
```

## Detailed Code Examples

### 1. Feature Extraction Implementation

**File: `src/lib/customer-insights/feature-extractor.ts`**

```typescript
import type { Sale, InvoiceItem, PaymentMethodType } from '../types';

export interface TransactionFeatures {
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

/**
 * Extract temporal features from sale timestamp
 */
function extractTemporalFeatures(timestamp: Date): Partial<TransactionFeatures> {
  const hour = timestamp.getHours();
  const dayOfWeek = timestamp.getDay();
  const date = timestamp.getDate();
  
  return {
    hourOfDay: hour,
    dayOfWeek,
    weekOfMonth: Math.ceil(date / 7),
    isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
    isPayrollDay: date === 15 || date === 30, // Dominican payroll days
  };
}

/**
 * Categorize product description into standard categories
 */
function categorizeProduct(description: string): string {
  const desc = description.toLowerCase();
  
  // Alcohol
  if (desc.includes('cerveza') || desc.includes('beer') || 
      desc.includes('brandy') || desc.includes('ron') || 
      desc.includes('whisky') || desc.includes('vodka')) {
    return 'alcohol';
  }
  
  // Staples
  if (desc.includes('arroz') || desc.includes('rice') ||
      desc.includes('habichuela') || desc.includes('frijol') ||
      desc.includes('azucar') || desc.includes('sugar') ||
      desc.includes('aceite') || desc.includes('oil')) {
    return 'staples';
  }
  
  // Bakery/Dairy
  if (desc.includes('pan') || desc.includes('bread') ||
      desc.includes('queso') || desc.includes('cheese') ||
      desc.includes('mantequilla') || desc.includes('butter') ||
      desc.includes('huevo') || desc.includes('egg')) {
    return 'bakery';
  }
  
  // Household
  if (desc.includes('jabon') || desc.includes('soap') ||
      desc.includes('detergente') || desc.includes('detergent') ||
      desc.includes('papel') || desc.includes('toilet paper') ||
      desc.includes('cloro') || desc.includes('bleach')) {
    return 'household';
  }
  
  // Snacks
  if (desc.includes('dorito') || desc.includes('chips') ||
      desc.includes('snack') || desc.includes('galleta') ||
      desc.includes('cookie') || desc.includes('chocolate')) {
    return 'snacks';
  }
  
  // Beverages (non-alcoholic)
  if (desc.includes('refresco') || desc.includes('soda') ||
      desc.includes('jugo') || desc.includes('juice') ||
      desc.includes('agua') || desc.includes('water')) {
    return 'beverages';
  }
  
  // Fresh produce
  if (desc.includes('platano') || desc.includes('banana') ||
      desc.includes('tomate') || desc.includes('tomato') ||
      desc.includes('cebolla') || desc.includes('onion') ||
      desc.includes('lechuga') || desc.includes('lettuce')) {
    return 'fresh';
  }
  
  return 'other';
}

/**
 * Extract basket composition features
 */
function extractBasketFeatures(items: InvoiceItem[]): Partial<TransactionFeatures> {
  const categories = items.map(item => categorizeProduct(item.description));
  const categoryCounts = categories.reduce((acc, cat) => {
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const totalValue = items.reduce((sum, item) => sum + item.amount, 0);
  const itemCount = items.length;
  
  return {
    totalValue,
    itemCount,
    categories: Object.keys(categoryCounts),
    categoryWeights: Object.fromEntries(
      Object.entries(categoryCounts).map(([cat, count]) => 
        [cat, count / itemCount]
      )
    ),
    avgItemPrice: totalValue / itemCount,
    hasAlcohol: categories.includes('alcohol'),
    hasFreshProduce: categories.includes('fresh'),
    hasHouseholdItems: categories.includes('household'),
    hasSnacks: categories.includes('snacks'),
    hasBeverages: categories.includes('beverages'),
    isLargeBasket: totalValue > 500,
    isSmallBasket: totalValue < 100,
  };
}

/**
 * Extract complete transaction features from a sale
 */
export function extractTransactionFeatures(sale: Sale): TransactionFeatures {
  const timestamp = new Date(sale.date);
  const temporal = extractTemporalFeatures(timestamp);
  const basket = extractBasketFeatures(sale.items);
  
  return {
    ...temporal,
    ...basket,
    timestamp,
    paymentMethod: sale.paymentMethod,
    cashierId: sale.cashierId,
    shiftId: sale.shiftId,
  } as TransactionFeatures;
}

/**
 * Batch extract features from multiple sales
 */
export function batchExtractFeatures(sales: Sale[], days: number = 30): TransactionFeatures[] {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  return sales
    .filter(sale => new Date(sale.date) >= cutoffDate)
    .map(extractTransactionFeatures);
}
```

### 2. Clustering Implementation

**File: `src/lib/customer-insights/clustering.ts`**

```typescript
import type { TransactionFeatures } from './feature-extractor';
import type { CustomerSegment, PaymentMethodType } from './types';

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
      name: 'Lunch Rush', 
      hours: [11, 12, 13, 14], 
      description: 'Midday meal and refreshment buyers' 
    },
    { 
      name: 'After Work', 
      hours: [17, 18, 19, 20], 
      description: 'Evening shoppers buying dinner items and household needs' 
    },
    { 
      name: 'Late Night', 
      hours: [21, 22, 23, 0, 1], 
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
    const paymentCounts: Record<PaymentMethodType, number> = {} as any;
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
      segmentType: 'temporal',
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
      segmentType: 'basket_value',
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
    } as CustomerSegment;
  }).filter(Boolean) as CustomerSegment[];
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
```

### 3. AI Analysis Implementation

**File: `src/lib/customer-insights/ai-analysis.ts`**

```typescript
import type { CustomerSegment, TransactionFeatures } from './types';

/**
 * Analyze segment personality using AI
 */
export async function analyzeSegmentPersonality(
  segment: CustomerSegment,
  sampleTransactions: TransactionFeatures[],
  apiKey: string
): Promise<{
  personaDescription: string;
  marketingRecommendations: string[];
  operationalInsights: string[];
}> {
  const prompt = `
    Analyze this customer segment for a Dominican colmado (mini market):
    
    SEGMENT: ${segment.segmentName}
    Type: ${segment.segmentType}
    Average basket: RD$${segment.avgBasketValue.toFixed(0)}
    Average items: ${segment.avgItemsPerBasket.toFixed(1)}
    Peak hours: ${segment.peakHours.join(', ')}:00
    Peak days: ${segment.peakDays.map(d => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d]).join(', ')}
    Top categories: ${segment.topCategories.join(', ')}
    Transaction count: ${segment.transactionCount}
    Frequency: ${segment.frequencyPattern}
    
    SAMPLE TRANSACTIONS:
    ${sampleTransactions.slice(0, 5).map((t, i) => 
      `${i + 1}. ${t.hourOfDay}:00 - RD$${t.totalValue.toFixed(0)} - ${t.itemCount} items - ${t.categories.join(', ')}`
    ).join('\n')}
    
    Provide:
    1. Customer persona description (2-3 sentences describing who this customer is)
    2. Marketing recommendations (3-4 specific, actionable ideas for this segment)
    3. Operational insights (2-3 suggestions for store operations)
    
    Consider Dominican culture, colmado shopping habits, and local preferences.
    
    Return ONLY valid JSON:
    {
      "personaDescription": "string",
      "marketingRecommendations": ["string", "string", "string"],
      "operationalInsights": ["string", "string"]
    }
  `;
  
  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'grok-3',
        messages: [
          {
            role: 'system',
            content: 'You are an expert market analyst for Dominican colmados. Provide concise, actionable insights in JSON format only.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 800
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
    
    return {
      personaDescription: aiResponse.personaDescription || '',
      marketingRecommendations: aiResponse.marketingRecommendations || [],
      operationalInsights: aiResponse.operationalInsights || [],
    };
    
  } catch (error) {
    console.warn('AI analysis failed:', error);
    // Return fallback insights
    return {
      personaDescription: `${segment.segmentName} customers with average basket of RD$${segment.avgBasketValue.toFixed(0)}`,
      marketingRecommendations: [
        `Target ${segment.segmentName} during peak hours`,
        `Focus on ${segment.topCategories[0]} category promotions`
      ],
      operationalInsights: [
        `Ensure adequate staffing during peak hours: ${segment.peakHours.join(', ')}:00`,
        `Stock up on ${segment.topCategories.slice(0, 2).join(' and ')} before peak times`
      ]
    };
  }
}

/**
 * Enhance segments with AI analysis
 */
export async function enhanceSegmentsWithAI(
  segments: CustomerSegment[],
  allFeatures: TransactionFeatures[],
  apiKey: string
): Promise<CustomerSegment[]> {
  const enhancedSegments: CustomerSegment[] = [];
  
  for (const segment of segments) {
    // Get sample transactions for this segment
    const sampleTransactions = allFeatures.filter(f => {
      if (segment.segmentType === 'temporal') {
        return segment.peakHours.includes(f.hourOfDay);
      } else if (segment.segmentType === 'basket_value') {
        const isLarge = segment.segmentName.includes('Big') || segment.segmentName.includes('Bulk');
        const isSmall = segment.segmentName.includes('Quick');
        if (isLarge) return f.isLargeBasket;
        if (isSmall) return f.isSmallBasket;
        return !f.isLargeBasket && !f.isSmallBasket;
      }
      return true;
    }).slice(0, 20);
    
    // Get AI analysis
    const aiAnalysis = await analyzeSegmentPersonality(segment, sampleTransactions, apiKey);
    
    enhancedSegments.push({
      ...segment,
      personaDescription: aiAnalysis.personaDescription,
      marketingRecommendations: aiAnalysis.marketingRecommendations,
      operationalInsights: aiAnalysis.operationalInsights,
    });
    
    // Small delay to respect API rate limits
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return enhancedSegments;
}
```

### 4. Real-Time Insights Implementation

**File: `src/lib/customer-insights/real-time.ts`**

```typescript
import type { Sale, CustomerSegment } from '../types';
import type { RealTimeInsight } from './types';
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
  const currentTraffic = recentSales.length;
  const avgTraffic = await getHistoricalAverage(currentHour, currentDay);
  
  if (currentTraffic > avgTraffic * 1.5) {
    insights.push({
      insightType: 'traffic',
      message: `🚀 Busy period! ${Math.round((currentTraffic/avgTraffic - 1) * 100)}% more customers than usual`,
      confidence: 0.9,
      actionItems: [
        'Consider opening additional checkout lane',
        'Stock up on popular items',
        'Prepare for increased cash handling'
      ],
      expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
    });
  } else if (currentTraffic < avgTraffic * 0.5) {
    insights.push({
      insightType: 'traffic',
      message: `📉 Slow period - ${Math.round((1 - currentTraffic/avgTraffic) * 100)}% fewer customers than usual`,
      confidence: 0.8,
      actionItems: [
        'Good time for inventory counting',
        'Consider cleaning and restocking',
        'Prepare for upcoming busy period'
      ],
      expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
    });
  }
  
  // Product demand predictions
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
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours
      });
    }
  }
  
  // Revenue forecasting
  const predictedRevenue = await forecastRevenue(currentHour, currentDay);
  const avgRevenue = await getHistoricalRevenue(currentHour, currentDay);
  
  if (predictedRevenue > avgRevenue * 1.2) {
    insights.push({
      insightType: 'revenue',
      message: `💰 High revenue potential: RD$${predictedRevenue.toLocaleString()} expected vs RD$${avgRevenue.toLocaleString()} average`,
      confidence: 0.8,
      actionItems: [
        'Maximize upselling opportunities',
        'Ensure all staff are available',
        'Consider extending store hours if applicable'
      ],
      expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000) // 4 hours
    });
  }
  
  // Basket size analysis
  const avgBasketSize = recentSales.reduce((sum, s) => sum + s.total, 0) / recentSales.length;
  const historicalAvgBasket = await getHistoricalBasketSize(currentHour, currentDay);
  
  if (avgBasketSize > historicalAvgBasket * 1.3) {
    insights.push({
      insightType: 'operational',
      message: `🛒 Larger baskets than usual (RD$${avgBasketSize.toFixed(0)} vs RD$${historicalAvgBasket.toFixed(0)})`,
      confidence: 0.7,
      actionItems: [
        'Focus on upselling complementary items',
        'Ensure adequate bagging supplies',
        'Consider family bundle promotions'
      ],
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000)
    });
  }
  
  return insights;
}

/**
 * Get historical average traffic for hour/day
 */
async function getHistoricalAverage(hour: number, dayOfWeek: number): Promise<number> {
  const sales = await db.sales.toArray();
  const last30Days = sales.filter(sale => {
    const saleDate = new Date(sale.date);
    const saleHour = saleDate.getHours();
    const saleDay = saleDate.getDay();
    const daysAgo = (Date.now() - saleDate.getTime()) / (1000 * 60 * 60 * 24);
    
    return daysAgo <= 30 && saleHour === hour && saleDay === dayOfWeek;
  });
  
  // Group by date to count unique days
  const dates = new Set(sales.map(s => s.date.split('T')[0]));
  return sales.length / Math.max(dates.size, 1);
}

/**
 * Forecast revenue for current hour/day
 */
async function forecastRevenue(hour: number, dayOfWeek: number): Promise<number> {
  const sales = await db.sales.toArray();
  const historical = sales.filter(sale => {
    const saleDate = new Date(sale.date);
    const saleHour = saleDate.getHours();
    const saleDay = saleDate.getDay();
    const daysAgo = (Date.now() - saleDate.getTime()) / (1000 * 60 * 60 * 24);
    
    return daysAgo <= 30 && saleHour === hour && saleDay === dayOfWeek;
  });
  
  if (historical.length === 0) return 0;
  
  const avgRevenue = historical.reduce((sum, s) => sum + s.total, 0) / historical.length;
  return avgRevenue;
}

/**
 * Get historical revenue average
 */
async function getHistoricalRevenue(hour: number, dayOfWeek: number): Promise<number> {
  return forecastRevenue(hour, dayOfWeek);
}

/**
 * Get historical basket size average
 */
async function getHistoricalBasketSize(hour: number, dayOfWeek: number): Promise<number> {
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
}
```

### 5. Database Schema Updates

**File: `src/lib/db.ts` (additions)**

```typescript
// Add to MinimarketDatabase class
customerSegments!: Table<CustomerSegment>;
transactionFeatures!: Table<TransactionFeatures>;
realTimeInsights!: Table<RealTimeInsight>;

// In version update, add:
this.version(12).stores({
  // ... existing stores ...
  invoices: '++id, providerName, issueDate, ncf, status, paymentStatus, dueDate, [issueDate+providerName]',
  suppliers: '++id, name, rnc, isActive, category',
  rules: '++id, supplierId',
  globalContext: '++id, title, type, category',
  products: '++id, supplierId, name, category, barcode, productId, [supplierId+name]',
  stockMovements: '++id, productId, type, date, invoiceId, saleId, returnId',
  bankAccounts: '++id, bankName, isDefault, isActive',
  payments: '++id, invoiceId, saleId, returnId, supplierId, customerId, paymentDate, paymentMethod, bankAccountId',
  customers: '++id, name, type, isActive, rnc',
  sales: '++id, date, customerId, paymentStatus, shiftId, receiptNumber, cashierId, hasReturns',
  shifts: '++id, shiftNumber, status, openedAt, closedAt, cashierId',
  returns: '++id, date, originalSaleId, originalReceiptNumber, customerId, shiftId, processedBy, refundStatus',
  users: '++id, username, roleId, isActive, &pin',
  roles: '++id, name, isSystem',
  customerSegments: '++id, segmentId, segmentName, segmentType, confidenceScore, lastUpdated',
  transactionFeatures: '++id, timestamp, hourOfDay, dayOfWeek, totalValue, shiftId',
  realTimeInsights: '++id, insightType, expiresAt, createdAt'
});
```

### 6. Type Definitions

**File: `src/lib/customer-insights/types.ts`**

```typescript
import type { PaymentMethodType } from '../types';

export interface TransactionFeatures {
  id?: number;
  timestamp: Date;
  hourOfDay: number;
  dayOfWeek: number;
  weekOfMonth: number;
  isWeekend: boolean;
  isPayrollDay: boolean;
  totalValue: number;
  itemCount: number;
  categories: string[];
  categoryWeights: Record<string, number>;
  hasAlcohol: boolean;
  hasFreshProduce: boolean;
  hasHouseholdItems: boolean;
  hasSnacks: boolean;
  hasBeverages: boolean;
  avgItemPrice: number;
  paymentMethod: PaymentMethodType;
  isLargeBasket: boolean;
  isSmallBasket: boolean;
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
```

## Success Metrics

### Technical Metrics
- **Clustering Accuracy**: >80% distinct segments
- **Traffic Prediction**: ±20% accuracy
- **Revenue Forecasting**: ±15% accuracy
- **Processing Speed**: <2 seconds for real-time insights
- **API Cost**: <$50/month additional (with caching)

### Business Metrics
- **Staff Productivity**: 20% improvement in shift planning
- **Inventory Optimization**: 30% reduction in stockouts
- **Revenue Increase**: 5-10% through better timing
- **Customer Satisfaction**: Improved through better service
- **Operational Efficiency**: 15% reduction in waste

## Risk Mitigation

### Technical Risks
- **API Costs**: Mitigated through aggressive caching and batch processing
- **Performance**: Addressed with incremental updates and lazy loading
- **Data Quality**: Implement validation and error handling

### Business Risks
- **Adoption**: Provide training and clear value demonstration
- **Accuracy**: Start with conservative predictions, refine over time
- **Privacy**: All analysis is anonymous, no personal data stored

## Timeline

- **Week 1**: Data Foundation (Feature extraction, basic clustering)
- **Week 2**: AI Integration (Personality analysis, predictions)
- **Week 3**: UI Development (Dashboard, real-time insights)
- **Week 4**: Testing & Optimization (Validation, performance tuning)

**Total Duration**: 4 weeks

## Dependencies

- Existing Grok API integration
- Sales data in IndexedDB
- Product catalog data
- Shift management system

## Future Enhancements

- Machine learning model for improved clustering
- Integration with external data (weather, events)
- Mobile app for real-time insights
- Automated marketing campaign generation
- Supplier integration for demand forecasting





