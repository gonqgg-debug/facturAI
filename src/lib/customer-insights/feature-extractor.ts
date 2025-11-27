import type { Sale, InvoiceItem, PaymentMethodType } from '../types';
import type { TransactionFeatures } from './types';

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
 * Handles both Spanish and English terms for Dominican colmado products
 */
export function categorizeProduct(description: string): string {
  const desc = description.toLowerCase();
  
  // Alcohol
  if (desc.includes('cerveza') || desc.includes('beer') || 
      desc.includes('brandy') || desc.includes('ron') || 
      desc.includes('whisky') || desc.includes('vodka') ||
      desc.includes('vino') || desc.includes('wine') ||
      desc.includes('presidente') || desc.includes('bohemia') ||
      desc.includes('brugal') || desc.includes('barcelo')) {
    return 'alcohol';
  }
  
  // Staples (basic food items)
  if (desc.includes('arroz') || desc.includes('rice') ||
      desc.includes('habichuela') || desc.includes('frijol') || desc.includes('beans') ||
      desc.includes('azucar') || desc.includes('sugar') ||
      desc.includes('aceite') || desc.includes('oil') ||
      desc.includes('harina') || desc.includes('flour') ||
      desc.includes('sal') || desc.includes('salt') ||
      desc.includes('pasta') || desc.includes('spaghetti')) {
    return 'staples';
  }
  
  // Bakery/Dairy
  if (desc.includes('pan') || desc.includes('bread') ||
      desc.includes('queso') || desc.includes('cheese') ||
      desc.includes('mantequilla') || desc.includes('butter') ||
      desc.includes('huevo') || desc.includes('egg') ||
      desc.includes('leche') || desc.includes('milk') ||
      desc.includes('yogurt') || desc.includes('yogur') ||
      desc.includes('crema') || desc.includes('cream')) {
    return 'bakery_dairy';
  }
  
  // Household
  if (desc.includes('jabon') || desc.includes('soap') ||
      desc.includes('detergente') || desc.includes('detergent') ||
      desc.includes('papel') || desc.includes('toilet paper') || desc.includes('servilleta') ||
      desc.includes('cloro') || desc.includes('bleach') ||
      desc.includes('suavizante') || desc.includes('softener') ||
      desc.includes('escoba') || desc.includes('broom') ||
      desc.includes('fabuloso') || desc.includes('mistolin')) {
    return 'household';
  }
  
  // Snacks
  if (desc.includes('dorito') || desc.includes('chips') ||
      desc.includes('snack') || desc.includes('galleta') || desc.includes('cookie') ||
      desc.includes('chocolate') || desc.includes('dulce') || desc.includes('candy') ||
      desc.includes('cheetos') || desc.includes('ruffles') ||
      desc.includes('oreo') || desc.includes('biscuit')) {
    return 'snacks';
  }
  
  // Beverages (non-alcoholic)
  if (desc.includes('refresco') || desc.includes('soda') ||
      desc.includes('jugo') || desc.includes('juice') ||
      desc.includes('agua') || desc.includes('water') ||
      desc.includes('coca') || desc.includes('pepsi') ||
      desc.includes('sprite') || desc.includes('fanta') ||
      desc.includes('gatorade') || desc.includes('energia') || desc.includes('energy')) {
    return 'beverages';
  }
  
  // Fresh produce
  if (desc.includes('platano') || desc.includes('banana') ||
      desc.includes('tomate') || desc.includes('tomato') ||
      desc.includes('cebolla') || desc.includes('onion') ||
      desc.includes('lechuga') || desc.includes('lettuce') ||
      desc.includes('ajo') || desc.includes('garlic') ||
      desc.includes('aguacate') || desc.includes('avocado') ||
      desc.includes('yuca') || desc.includes('papa') || desc.includes('potato') ||
      desc.includes('limon') || desc.includes('lemon') || desc.includes('lime')) {
    return 'fresh';
  }
  
  // Meat/Protein
  if (desc.includes('pollo') || desc.includes('chicken') ||
      desc.includes('carne') || desc.includes('meat') || desc.includes('beef') ||
      desc.includes('cerdo') || desc.includes('pork') ||
      desc.includes('salami') || desc.includes('salchicha') || desc.includes('sausage') ||
      desc.includes('jamon') || desc.includes('ham') ||
      desc.includes('pescado') || desc.includes('fish') ||
      desc.includes('atun') || desc.includes('tuna')) {
    return 'protein';
  }
  
  // Tobacco
  if (desc.includes('cigarro') || desc.includes('cigarette') ||
      desc.includes('marlboro') || desc.includes('nacional') ||
      desc.includes('tabaco') || desc.includes('tobacco')) {
    return 'tobacco';
  }
  
  // Personal care
  if (desc.includes('shampoo') || desc.includes('champu') ||
      desc.includes('desodorante') || desc.includes('deodorant') ||
      desc.includes('crema dental') || desc.includes('toothpaste') ||
      desc.includes('cepillo') || desc.includes('toothbrush') ||
      desc.includes('pañal') || desc.includes('diaper')) {
    return 'personal_care';
  }
  
  return 'other';
}

/**
 * Extract basket composition features from sale items
 */
function extractBasketFeatures(items: InvoiceItem[]): Partial<TransactionFeatures> {
  const categories = items.map(item => categorizeProduct(item.description));
  const categoryCounts = categories.reduce((acc, cat) => {
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const totalValue = items.reduce((sum, item) => sum + item.amount, 0);
  const itemCount = items.length;
  
  // Get unique categories
  const uniqueCategories = [...new Set(categories)];
  
  return {
    totalValue,
    itemCount,
    categories: uniqueCategories,
    categoryWeights: Object.fromEntries(
      Object.entries(categoryCounts).map(([cat, count]) => 
        [cat, count / itemCount]
      )
    ),
    avgItemPrice: itemCount > 0 ? totalValue / itemCount : 0,
    hasAlcohol: uniqueCategories.includes('alcohol'),
    hasFreshProduce: uniqueCategories.includes('fresh'),
    hasHouseholdItems: uniqueCategories.includes('household'),
    hasSnacks: uniqueCategories.includes('snacks'),
    hasBeverages: uniqueCategories.includes('beverages'),
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
 * @param sales Array of sales to process
 * @param days Number of days to look back (default 30)
 */
export function batchExtractFeatures(sales: Sale[], days: number = 30): TransactionFeatures[] {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  return sales
    .filter(sale => new Date(sale.date) >= cutoffDate)
    .map(extractTransactionFeatures);
}

/**
 * Get category distribution from features
 */
export function getCategoryDistribution(features: TransactionFeatures[]): Record<string, number> {
  const distribution: Record<string, number> = {};
  let totalCategories = 0;
  
  features.forEach(f => {
    f.categories.forEach(cat => {
      distribution[cat] = (distribution[cat] || 0) + 1;
      totalCategories++;
    });
  });
  
  // Convert to percentages
  Object.keys(distribution).forEach(key => {
    distribution[key] = distribution[key] / totalCategories;
  });
  
  return distribution;
}

/**
 * Get hourly distribution of transactions
 */
export function getHourlyDistribution(features: TransactionFeatures[]): Record<number, number> {
  const distribution: Record<number, number> = {};
  
  // Initialize all hours
  for (let i = 0; i < 24; i++) {
    distribution[i] = 0;
  }
  
  features.forEach(f => {
    distribution[f.hourOfDay]++;
  });
  
  return distribution;
}

/**
 * Get day of week distribution
 */
export function getDayOfWeekDistribution(features: TransactionFeatures[]): Record<number, number> {
  const distribution: Record<number, number> = {};
  
  // Initialize all days (0 = Sunday, 6 = Saturday)
  for (let i = 0; i < 7; i++) {
    distribution[i] = 0;
  }
  
  features.forEach(f => {
    distribution[f.dayOfWeek]++;
  });
  
  return distribution;
}

/**
 * Calculate average basket value for a set of features
 */
export function calculateAverageBasketValue(features: TransactionFeatures[]): number {
  if (features.length === 0) return 0;
  const total = features.reduce((sum, f) => sum + f.totalValue, 0);
  return total / features.length;
}

/**
 * Calculate average items per basket
 */
export function calculateAverageItemCount(features: TransactionFeatures[]): number {
  if (features.length === 0) return 0;
  const total = features.reduce((sum, f) => sum + f.itemCount, 0);
  return total / features.length;
}

