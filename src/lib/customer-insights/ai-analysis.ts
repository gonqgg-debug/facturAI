import type { CustomerSegment, TransactionFeatures, AIAnalysisResponse } from './types';
import { getCsrfHeader, ensureCsrfToken } from '$lib/csrf';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Analyze segment personality using AI
 */
export async function analyzeSegmentPersonality(
  segment: CustomerSegment,
  sampleTransactions: TransactionFeatures[]
): Promise<AIAnalysisResponse> {
  const prompt = `
    Analyze this customer segment for a Dominican colmado (mini market):
    
    SEGMENT: ${segment.segmentName}
    Type: ${segment.segmentType}
    Average basket: RD$${segment.avgBasketValue.toFixed(0)}
    Average items: ${segment.avgItemsPerBasket.toFixed(1)}
    Peak hours: ${segment.peakHours.join(', ')}:00
    Peak days: ${segment.peakDays.map(d => DAY_NAMES[d]).join(', ')}
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
    // Ensure CSRF token is available before making request
    await ensureCsrfToken();
    
    const response = await fetch('/api/grok', {
      method: 'POST',
      credentials: 'same-origin', // Ensure cookies are sent
      headers: {
        'Content-Type': 'application/json',
        ...getCsrfHeader()
      },
      body: JSON.stringify({
        model: 'grok-3-fast',
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
    return generateFallbackInsights(segment);
  }
}

/**
 * Generate fallback insights when AI is not available
 */
function generateFallbackInsights(segment: CustomerSegment): AIAnalysisResponse {
  const peakDaysStr = segment.peakDays.map(d => DAY_NAMES[d]).join(', ');
  const peakHoursStr = segment.peakHours.map(h => `${h}:00`).join(', ');
  
  // Generate persona based on segment type
  let personaDescription = '';
  const marketingRecommendations: string[] = [];
  const operationalInsights: string[] = [];
  
  switch (segment.segmentType) {
    case 'temporal':
      personaDescription = `${segment.segmentName} customers typically visit during ${peakHoursStr}. ` +
        `They have an average basket of RD$${segment.avgBasketValue.toFixed(0)} with ${segment.avgItemsPerBasket.toFixed(1)} items. ` +
        `Most active on ${peakDaysStr}.`;
      marketingRecommendations.push(
        `Schedule promotions during peak hours (${peakHoursStr})`,
        `Focus on ${segment.topCategories[0] || 'popular'} category displays during this time`,
        `Consider time-specific discounts to increase traffic during slower periods`
      );
      operationalInsights.push(
        `Ensure adequate staffing during peak hours: ${peakHoursStr}`,
        `Stock up on ${segment.topCategories.slice(0, 2).join(' and ')} before peak times`
      );
      break;
      
    case 'basket_value':
      personaDescription = `${segment.segmentName} customers with average basket of RD$${segment.avgBasketValue.toFixed(0)}. ` +
        `They typically purchase ${segment.avgItemsPerBasket.toFixed(1)} items per visit, ` +
        `primarily from ${segment.topCategories.slice(0, 3).join(', ')} categories.`;
      marketingRecommendations.push(
        `Create bundle deals targeting ${segment.segmentName} basket sizes`,
        `Offer loyalty rewards for repeat ${segment.segmentName} purchases`,
        `Position impulse items near checkout for this segment`
      );
      operationalInsights.push(
        `Optimize checkout speed for ${segment.segmentName} basket sizes`,
        `Ensure popular items for this segment are always in stock`
      );
      break;
      
    case 'product_preference':
      personaDescription = `${segment.segmentName} customers prefer ${segment.topCategories.slice(0, 3).join(', ')} products. ` +
        `Average spend of RD$${segment.avgBasketValue.toFixed(0)} with ${segment.frequencyPattern} visits.`;
      marketingRecommendations.push(
        `Cross-sell complementary items to ${segment.topCategories[0]} buyers`,
        `Create category-specific promotions for ${segment.segmentName}`,
        `Highlight new arrivals in preferred categories`
      );
      operationalInsights.push(
        `Maintain strong inventory in ${segment.topCategories.slice(0, 2).join(' and ')}`,
        `Train staff on product knowledge for these categories`
      );
      break;
  }
  
  return {
    personaDescription,
    marketingRecommendations,
    operationalInsights
  };
}

/**
 * Enhance segments with AI analysis
 */
export async function enhanceSegmentsWithAI(
  segments: CustomerSegment[],
  allFeatures: TransactionFeatures[]
): Promise<CustomerSegment[]> {
  const enhancedSegments: CustomerSegment[] = [];
  
  for (const segment of segments) {
    // Get sample transactions for this segment
    const sampleTransactions = getSampleTransactionsForSegment(segment, allFeatures);
    
    // Get AI analysis
    const aiAnalysis = await analyzeSegmentPersonality(segment, sampleTransactions);
    
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

/**
 * Get sample transactions for a segment
 */
function getSampleTransactionsForSegment(
  segment: CustomerSegment,
  allFeatures: TransactionFeatures[]
): TransactionFeatures[] {
  return allFeatures.filter(f => {
    if (segment.segmentType === 'temporal') {
      return segment.peakHours.includes(f.hourOfDay);
    } else if (segment.segmentType === 'basket_value') {
      const isLarge = segment.segmentName.includes('Big') || segment.segmentName.includes('Bulk');
      const isSmall = segment.segmentName.includes('Quick');
      if (isLarge) return f.isLargeBasket;
      if (isSmall) return f.isSmallBasket;
      return !f.isLargeBasket && !f.isSmallBasket;
    } else if (segment.segmentType === 'product_preference') {
      // Match by top category
      return f.categories.some(cat => segment.topCategories.includes(cat));
    }
    return true;
  }).slice(0, 20);
}

/**
 * Batch analyze multiple segments with AI (with caching)
 */
export async function batchAnalyzeSegments(
  segments: CustomerSegment[],
  allFeatures: TransactionFeatures[],
  cache?: Map<string, AIAnalysisResponse>
): Promise<CustomerSegment[]> {
  const enhancedSegments: CustomerSegment[] = [];
  
  for (const segment of segments) {
    // Check cache first
    if (cache?.has(segment.segmentId)) {
      const cached = cache.get(segment.segmentId)!;
      enhancedSegments.push({
        ...segment,
        personaDescription: cached.personaDescription,
        marketingRecommendations: cached.marketingRecommendations,
        operationalInsights: cached.operationalInsights,
      });
      continue;
    }
    
    // Get sample transactions
    const sampleTransactions = getSampleTransactionsForSegment(segment, allFeatures);
    
    // Get AI analysis
    const aiAnalysis = await analyzeSegmentPersonality(segment, sampleTransactions);
    
    // Cache the result
    if (cache) {
      cache.set(segment.segmentId, aiAnalysis);
    }
    
    enhancedSegments.push({
      ...segment,
      personaDescription: aiAnalysis.personaDescription,
      marketingRecommendations: aiAnalysis.marketingRecommendations,
      operationalInsights: aiAnalysis.operationalInsights,
    });
    
    // Small delay to respect API rate limits
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  
  return enhancedSegments;
}

