import Fuse from 'fuse.js';
import type { Product } from './types';

export interface ProductMatch {
    product: Product;
    score: number;        // 0-100, higher is better
    matchedOn: string;    // Which field matched (name, alias, barcode, etc.)
}

export interface MatchResult {
    exactMatch?: Product;
    fuzzyMatches: ProductMatch[];
    confidence: 'high' | 'medium' | 'low' | 'none';
}

// Common abbreviations and variations in Dominican Spanish
const ABBREVIATION_MAP: Record<string, string[]> = {
    'presidente': ['pres', 'presi', 'presid'],
    'cerveza': ['cerv', 'cervezas', 'birra'],
    'platano': ['pltno', 'plátano', 'platanos', 'plátanos', 'guineo'],
    'agua': ['h2o', 'aguas'],
    'refresco': ['ref', 'refrescos', 'soda', 'sodas'],
    'leche': ['milk'],
    'arroz': ['rice'],
    'azucar': ['azúcar', 'sugar'],
    'aceite': ['oil'],
    'sal': ['salt'],
    'harina': ['flour'],
    'frijol': ['frijoles', 'habichuela', 'habichuelas'],
    'pollo': ['chicken'],
    'carne': ['meat', 'res'],
    'botella': ['bot', 'btl', 'botell'],
    'lata': ['can', 'lat'],
    'paquete': ['paq', 'pqt', 'pack'],
    'caja': ['caj', 'box'],
    'unidad': ['und', 'un', 'unit'],
    'docena': ['doz', 'doc'],
    'libra': ['lb', 'lbs'],
    'galon': ['gal', 'galón', 'galones'],
    'litro': ['lt', 'ltr', 'l'],
};

/**
 * Normalize text for comparison:
 * - Lowercase
 * - Remove accents
 * - Expand common abbreviations
 */
export function normalizeText(text: string): string {
    if (!text) return '';
    
    let normalized = text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/[^\w\s]/g, ' ')        // Replace special chars with space
        .replace(/\s+/g, ' ')            // Collapse multiple spaces
        .trim();
    
    // Expand abbreviations
    for (const [full, abbrevs] of Object.entries(ABBREVIATION_MAP)) {
        for (const abbrev of abbrevs) {
            const regex = new RegExp(`\\b${abbrev}\\b`, 'gi');
            if (regex.test(normalized)) {
                normalized = normalized.replace(regex, full);
            }
        }
    }
    
    return normalized;
}

/**
 * Create search index from products with all searchable fields
 */
function createSearchableProducts(products: Product[]): Array<{ product: Product; searchTexts: string[] }> {
    return products.map(p => {
        const searchTexts = [
            normalizeText(p.name),
            ...(p.aliases || []).map(a => normalizeText(a)),
            p.barcode || '',
            p.productId || ''
        ].filter(Boolean);
        
        return { product: p, searchTexts };
    });
}

/**
 * Find products matching the given description using fuzzy search
 */
export function findProductMatches(
    description: string,
    products: Product[],
    maxResults: number = 5
): MatchResult {
    if (!description || products.length === 0) {
        return { fuzzyMatches: [], confidence: 'none' };
    }

    const normalizedQuery = normalizeText(description);
    const searchableProducts = createSearchableProducts(products);

    // 1. Check for exact match first (name or barcode/SKU)
    const exactMatch = products.find(p => 
        normalizeText(p.name) === normalizedQuery ||
        p.barcode === description.trim() ||
        p.productId === description.trim() ||
        (p.aliases || []).some(a => normalizeText(a) === normalizedQuery)
    );

    if (exactMatch) {
        return {
            exactMatch,
            fuzzyMatches: [{
                product: exactMatch,
                score: 100,
                matchedOn: 'exact'
            }],
            confidence: 'high'
        };
    }

    // 2. Configure Fuse.js for fuzzy search
    const fuseOptions: Fuse.IFuseOptions<{ product: Product; searchTexts: string[] }> = {
        keys: ['searchTexts'],
        threshold: 0.4,           // Lower = stricter matching
        distance: 100,            // How far to search for matches
        includeScore: true,
        minMatchCharLength: 2,
        ignoreLocation: true,     // Match anywhere in the string
        useExtendedSearch: true,
    };

    const fuse = new Fuse(searchableProducts, fuseOptions);
    const results = fuse.search(normalizedQuery);

    // 3. Convert Fuse results to our format
    const fuzzyMatches: ProductMatch[] = results
        .slice(0, maxResults)
        .map(result => {
            // Fuse score is 0 (perfect) to 1 (no match), convert to 0-100
            const score = Math.round((1 - (result.score || 0)) * 100);
            
            // Determine what field matched
            let matchedOn = 'name';
            const item = result.item;
            if (item.product.barcode && description.includes(item.product.barcode)) {
                matchedOn = 'barcode';
            } else if (item.product.productId && description.includes(item.product.productId)) {
                matchedOn = 'sku';
            } else if ((item.product.aliases || []).some(a => 
                normalizeText(a).includes(normalizedQuery) || normalizedQuery.includes(normalizeText(a))
            )) {
                matchedOn = 'alias';
            }

            return {
                product: item.product,
                score,
                matchedOn
            };
        });

    // 4. Determine confidence level
    let confidence: MatchResult['confidence'] = 'none';
    if (fuzzyMatches.length > 0) {
        const topScore = fuzzyMatches[0].score;
        if (topScore >= 90) {
            confidence = 'high';
        } else if (topScore >= 60) {
            confidence = 'medium';
        } else if (topScore >= 40) {
            confidence = 'low';
        }
    }

    return {
        exactMatch: confidence === 'high' ? fuzzyMatches[0]?.product : undefined,
        fuzzyMatches,
        confidence
    };
}

/**
 * Auto-link invoice items to catalog products
 * Returns array of items with productId set where confident matches found
 */
export function autoLinkInvoiceItems(
    items: Array<{ description: string; productId?: string }>,
    products: Product[],
    autoLinkThreshold: number = 90 // Only auto-link if score >= this
): Array<{ 
    index: number;
    originalDescription: string;
    matchResult: MatchResult;
    autoLinked: boolean;
}> {
    return items.map((item, index) => {
        // Skip if already linked
        if (item.productId) {
            const existingProduct = products.find(p => p.productId === item.productId || p.barcode === item.productId);
            return {
                index,
                originalDescription: item.description,
                matchResult: existingProduct ? {
                    exactMatch: existingProduct,
                    fuzzyMatches: [{ product: existingProduct, score: 100, matchedOn: 'existing' }],
                    confidence: 'high' as const
                } : { fuzzyMatches: [], confidence: 'none' as const },
                autoLinked: false
            };
        }

        const matchResult = findProductMatches(item.description, products);
        const topMatch = matchResult.fuzzyMatches[0];
        const autoLinked = topMatch && topMatch.score >= autoLinkThreshold;

        return {
            index,
            originalDescription: item.description,
            matchResult,
            autoLinked
        };
    });
}

/**
 * Calculate similarity between two strings (0-100)
 * Useful for debugging and UI feedback
 */
export function calculateSimilarity(str1: string, str2: string): number {
    const s1 = normalizeText(str1);
    const s2 = normalizeText(str2);
    
    if (s1 === s2) return 100;
    if (!s1 || !s2) return 0;
    
    // Levenshtein distance
    const matrix: number[][] = [];
    
    for (let i = 0; i <= s1.length; i++) {
        matrix[i] = [i];
    }
    
    for (let j = 0; j <= s2.length; j++) {
        matrix[0][j] = j;
    }
    
    for (let i = 1; i <= s1.length; i++) {
        for (let j = 1; j <= s2.length; j++) {
            const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,      // deletion
                matrix[i][j - 1] + 1,      // insertion
                matrix[i - 1][j - 1] + cost // substitution
            );
        }
    }
    
    const maxLen = Math.max(s1.length, s2.length);
    const distance = matrix[s1.length][s2.length];
    
    return Math.round((1 - distance / maxLen) * 100);
}

