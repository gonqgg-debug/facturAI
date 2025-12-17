/**
 * FIFO (First In, First Out) Inventory Costing System
 * 
 * Critical for perishables in Dominican Republic mini markets:
 * - Plantains, yuca, milk, cold cuts, etc.
 * - System consumes oldest batches first on every sale
 * - Tracks exact cost of goods sold for accurate accounting
 */

import { db, generateId } from './db';
import type { InventoryLot, CostConsumption, Product } from './types';
import { getProductCostExTax } from './tax';
import { logAccountingAction } from './accounting-audit';

// ============ LOT MANAGEMENT ============

/**
 * Create a new inventory lot when receiving goods
 * Called when validating an invoice or receiving a shipment
 */
export async function addInventoryLot(
    productId: string,
    quantity: number,
    unitCostExTax: number,
    taxRate: number,
    options: {
        invoiceId?: string;
        receiptId?: string;
        lotNumber?: string;
        expirationDate?: string;
        purchaseDate?: string;
    } = {}
): Promise<InventoryLot> {
    const lot: InventoryLot = {
        id: generateId(),
        productId,
        invoiceId: options.invoiceId,
        receiptId: options.receiptId,
        lotNumber: options.lotNumber,
        purchaseDate: options.purchaseDate || new Date().toISOString().split('T')[0],
        expirationDate: options.expirationDate,
        originalQuantity: quantity,
        remainingQuantity: quantity,
        unitCost: unitCostExTax,
        unitCostIncTax: unitCostExTax * (1 + taxRate),
        taxRate,
        status: 'active',
        createdAt: new Date()
    };
    
    await db.inventoryLots.add(lot);
    await logAccountingAction({
        action: 'fifo_lot_created',
        entityType: 'fifo_lot',
        entityId: lot.id!,
        details: { productId, quantity, unitCostExTax, taxRate }
    });
    return lot;
}

/**
 * Get all active lots for a product, sorted by FIFO (oldest first)
 */
export async function getActiveLots(productId: string): Promise<InventoryLot[]> {
    return db.inventoryLots
        .where('productId').equals(productId)
        .and(lot => lot.status === 'active' && lot.remainingQuantity > 0)
        .sortBy('purchaseDate');
}

/**
 * Get the current FIFO cost for a product (cost of oldest available lot)
 */
export async function getFIFOCost(productId: string): Promise<number> {
    const lots = await getActiveLots(productId);
    
    if (lots.length > 0) {
        return lots[0].unitCost;
    }
    
    // Fallback: get cost from product record
    const product = await db.products.get(productId);
    if (product) {
        return getProductCostExTax(product);
    }
    
    return 0;
}

/**
 * Get weighted average cost across all active lots
 * Useful for reporting and comparison
 */
export async function getWeightedAverageCost(productId: string): Promise<number> {
    const lots = await getActiveLots(productId);
    
    if (lots.length === 0) {
        const product = await db.products.get(productId);
        return product ? getProductCostExTax(product) : 0;
    }
    
    const totalValue = lots.reduce((sum, lot) => sum + (lot.remainingQuantity * lot.unitCost), 0);
    const totalQty = lots.reduce((sum, lot) => sum + lot.remainingQuantity, 0);
    
    return totalQty > 0 ? totalValue / totalQty : 0;
}

// ============ FIFO CONSUMPTION ============

/**
 * Consume inventory using FIFO (oldest lots first)
 * Returns the total cost and creates consumption records
 * 
 * @param productId - Product being consumed
 * @param quantity - Quantity to consume
 * @param reference - Link to source document (sale, adjustment, etc.)
 * @returns Total cost and consumption records
 */
export async function consumeFIFO(
    productId: string,
    quantity: number,
    reference: { 
        saleId?: string; 
        returnId?: string; 
        adjustmentId?: string;
    },
    options: { strict?: boolean } = {}
): Promise<{ 
    totalCost: number; 
    consumptions: CostConsumption[];
    avgUnitCost: number;
}> {
    // Get active lots sorted by purchase date (FIFO)
    const lots = await getActiveLots(productId);
    
    let remainingToConsume = quantity;
    let totalCost = 0;
    const consumptions: CostConsumption[] = [];
    const dateStr = new Date().toISOString().split('T')[0];
    
    // Consume from oldest lots first
    for (const lot of lots) {
        if (remainingToConsume <= 0) break;
        
        const consumeQty = Math.min(remainingToConsume, lot.remainingQuantity);
        const consumptionCost = consumeQty * lot.unitCost;
        
        // Create consumption record
        const consumption: CostConsumption = {
            id: generateId(),
            ...reference,
            lotId: lot.id!,
            productId,
            quantity: consumeQty,
            unitCost: lot.unitCost,
            totalCost: consumptionCost,
            date: dateStr,
            createdAt: new Date()
        };
        
        consumptions.push(consumption);
        await db.costConsumptions.add(consumption);
        
        // Update lot remaining quantity
        const newRemaining = lot.remainingQuantity - consumeQty;
        await db.inventoryLots.update(lot.id!, {
            remainingQuantity: newRemaining,
            status: newRemaining === 0 ? 'depleted' : 'active',
            depletedAt: newRemaining === 0 ? new Date() : undefined
        });
        
        totalCost += consumptionCost;
        remainingToConsume -= consumeQty;

        await logAccountingAction({
            action: 'fifo_consumption',
            entityType: 'fifo_lot',
            entityId: lot.id!,
            details: {
                productId,
                quantity: consumeQty,
                saleId: reference.saleId,
                returnId: reference.returnId,
                adjustmentId: reference.adjustmentId
            }
        });
    }
    
    // If we couldn't fulfill the entire quantity from lots, use product's average cost
    if (remainingToConsume > 0) {
        if (options.strict) {
            throw new Error(`Insufficient FIFO lots for product ${productId}. Requested ${quantity}, available ${quantity - remainingToConsume}.`);
        }
        const product = await db.products.get(productId);
        // IMPORTANT: Always use tax-excluded cost for COGS calculation
        // averageCost may be stored tax-inclusive, so we must extract the ex-tax portion
        const avgCost = product ? getProductCostExTax(product) : 0;
        
        // Create a consumption record for the unfulfilled quantity
        // This handles cases where lots weren't created (legacy data)
        const legacyConsumption: CostConsumption = {
            id: generateId(),
            ...reference,
            lotId: 'LEGACY_NO_LOT',
            productId,
            quantity: remainingToConsume,
            unitCost: avgCost,
            totalCost: remainingToConsume * avgCost,
            date: dateStr,
            createdAt: new Date()
        };
        
        consumptions.push(legacyConsumption);
        await db.costConsumptions.add(legacyConsumption);
        
        totalCost += remainingToConsume * avgCost;
        
        console.warn(`FIFO: Insufficient lots for product ${productId}, used average cost for ${remainingToConsume} units`);
    }
    
    const avgUnitCost = quantity > 0 ? totalCost / quantity : 0;
    
    return { totalCost, consumptions, avgUnitCost };
}

/**
 * Revert FIFO consumption (for returns or voided sales)
 * Restores quantity to the original lots
 */
export async function revertConsumption(
    saleId?: string,
    returnId?: string,
    adjustmentId?: string
): Promise<void> {
    // Find all consumptions for this reference
    let consumptions: CostConsumption[] = [];
    
    if (saleId) {
        consumptions = await db.costConsumptions.where('saleId').equals(saleId).toArray();
    } else if (returnId) {
        consumptions = await db.costConsumptions.where('returnId').equals(returnId).toArray();
    } else if (adjustmentId) {
        consumptions = await db.costConsumptions.where('adjustmentId').equals(adjustmentId).toArray();
    }
    
    // Restore quantities to lots
    for (const consumption of consumptions) {
        if (consumption.lotId !== 'LEGACY_NO_LOT') {
            const lot = await db.inventoryLots.get(consumption.lotId);
            if (lot) {
                await db.inventoryLots.update(consumption.lotId, {
                    remainingQuantity: lot.remainingQuantity + consumption.quantity,
                    status: 'active',
                    depletedAt: undefined
                });
            }
        }
        
        // Delete the consumption record
        if (consumption.id) {
            await db.costConsumptions.delete(consumption.id);
        }
    }
}

// ============ EXPIRATION MANAGEMENT ============

/**
 * Get lots expiring within a specified number of days
 * Useful for perishable inventory alerts
 */
export async function getExpiringLots(daysUntilExpiry: number = 7): Promise<InventoryLot[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysUntilExpiry);
    const futureDateStr = futureDate.toISOString().split('T')[0];
    const todayStr = new Date().toISOString().split('T')[0];
    
    return db.inventoryLots
        .where('status').equals('active')
        .and(lot => 
            lot.expirationDate !== undefined && 
            lot.expirationDate <= futureDateStr &&
            lot.expirationDate >= todayStr &&
            lot.remainingQuantity > 0
        )
        .toArray();
}

/**
 * Get already expired lots
 */
export async function getExpiredLots(): Promise<InventoryLot[]> {
    const todayStr = new Date().toISOString().split('T')[0];
    
    return db.inventoryLots
        .where('status').equals('active')
        .and(lot => 
            lot.expirationDate !== undefined && 
            lot.expirationDate < todayStr &&
            lot.remainingQuantity > 0
        )
        .toArray();
}

/**
 * Mark a lot as expired and optionally create adjustment
 */
export async function markLotExpired(lotId: string): Promise<void> {
    await db.inventoryLots.update(lotId, {
        status: 'expired',
        depletedAt: new Date()
    });
}

// ============ REPORTING ============

/**
 * Get FIFO inventory valuation for a product
 */
export async function getProductInventoryValuation(productId: string): Promise<{
    totalQuantity: number;
    totalValue: number;
    avgCost: number;
    lots: InventoryLot[];
}> {
    const lots = await getActiveLots(productId);
    
    const totalQuantity = lots.reduce((sum, lot) => sum + lot.remainingQuantity, 0);
    const totalValue = lots.reduce((sum, lot) => sum + (lot.remainingQuantity * lot.unitCost), 0);
    const avgCost = totalQuantity > 0 ? totalValue / totalQuantity : 0;
    
    return { totalQuantity, totalValue, avgCost, lots };
}

/**
 * Get total inventory valuation using FIFO
 */
export async function getTotalInventoryValuation(): Promise<{
    totalValue: number;
    productCount: number;
    totalUnits: number;
}> {
    const activeLots = await db.inventoryLots
        .where('status').equals('active')
        .and(lot => lot.remainingQuantity > 0)
        .toArray();
    
    const totalValue = activeLots.reduce((sum, lot) => sum + (lot.remainingQuantity * lot.unitCost), 0);
    const totalUnits = activeLots.reduce((sum, lot) => sum + lot.remainingQuantity, 0);
    
    // Count unique products
    const productIds = new Set(activeLots.map(lot => lot.productId));
    
    return { totalValue, productCount: productIds.size, totalUnits };
}

/**
 * Get COGS for a specific period
 */
export async function getCOGSForPeriod(startDate: string, endDate: string): Promise<{
    totalCOGS: number;
    byProduct: Map<string, { quantity: number; cost: number }>;
}> {
    const consumptions = await db.costConsumptions
        .where('date')
        .between(startDate, endDate, true, true)
        .toArray();
    
    const byProduct = new Map<string, { quantity: number; cost: number }>();
    let totalCOGS = 0;
    
    for (const c of consumptions) {
        totalCOGS += c.totalCost;
        
        const existing = byProduct.get(c.productId) || { quantity: 0, cost: 0 };
        byProduct.set(c.productId, {
            quantity: existing.quantity + c.quantity,
            cost: existing.cost + c.totalCost
        });
    }
    
    return { totalCOGS, byProduct };
}

/**
 * Get COGS for a specific shift (for shift close)
 */
export async function getCOGSForShift(shiftId: number): Promise<number> {
    // Get all sales for this shift
    const sales = await db.sales.where('shiftId').equals(shiftId).toArray();
    const saleIds = sales.map(s => s.id).filter((id): id is string => id !== undefined);
    
    if (saleIds.length === 0) return 0;
    
    // Sum up all consumptions for these sales
    let totalCOGS = 0;
    for (const saleId of saleIds) {
        const consumptions = await db.costConsumptions.where('saleId').equals(saleId).toArray();
        totalCOGS += consumptions.reduce((sum, c) => sum + c.totalCost, 0);
    }
    
    return totalCOGS;
}

/**
 * Get total available quantity for a product across active lots
 */
export async function getAvailableQuantity(productId: string): Promise<number> {
    const lots = await getActiveLots(productId);
    const lotQuantity = lots.reduce((sum, lot) => sum + lot.remainingQuantity, 0);
    
    // If product has FIFO lots, use lot quantity; otherwise fall back to currentStock
    if (lots.length > 0) {
        return lotQuantity;
    }
    
    // Fallback for legacy products without lots
    const product = await db.products.get(productId);
    return Number(product?.currentStock ?? 0);
}

/**
 * Restore FIFO consumption partially (for returns)
 * Re-adds quantities back to original lots and adjusts cost consumption records
 */
export async function restoreConsumptionForReturn(
    saleId: string,
    productId: string,
    quantity: number
): Promise<{ restored: number; avgUnitCost: number; totalCost: number }> {
    let remaining = quantity;
    let restored = 0;
    let totalCost = 0;
    
    // Oldest consumptions first to mirror FIFO usage
    const consumptions = await db.costConsumptions
        .where('saleId')
        .equals(saleId)
        .and(c => c.productId === productId)
        .sortBy('createdAt');
    
    for (const consumption of consumptions) {
        if (remaining <= 0) break;
        const restoreQty = Math.min(remaining, consumption.quantity);
        const restoreCost = restoreQty * consumption.unitCost;
        
        if (consumption.lotId && consumption.lotId !== 'LEGACY_NO_LOT') {
            const lot = await db.inventoryLots.get(consumption.lotId);
            if (lot) {
                const newRemaining = lot.remainingQuantity + restoreQty;
                await db.inventoryLots.update(consumption.lotId, {
                    remainingQuantity: newRemaining,
                    status: 'active',
                    depletedAt: undefined
                });
            }
        }
        
        // Update or delete consumption record
        if (restoreQty === consumption.quantity) {
            if (consumption.id) {
                await db.costConsumptions.delete(consumption.id);
            }
        } else if (consumption.id) {
            await db.costConsumptions.update(consumption.id, {
                quantity: consumption.quantity - restoreQty,
                totalCost: consumption.totalCost - restoreCost
            });
        }
        
        restored += restoreQty;
        totalCost += restoreCost;
        remaining -= restoreQty;
    }
    
    const avgUnitCost = restored > 0 ? totalCost / restored : 0;
    return { restored, avgUnitCost, totalCost };
}

// ============ MIGRATION HELPERS ============

/**
 * Create initial lots for existing products without lot history
 * Run this once when migrating to FIFO system
 */
export async function createInitialLotsForExistingProducts(): Promise<number> {
    const products = await db.products.toArray();
    let lotsCreated = 0;
    
    for (const product of products) {
        if (!product.id) continue;
        
        // Check if product already has lots
        const existingLots = await db.inventoryLots
            .where('productId').equals(product.id)
            .count();
        
        if (existingLots === 0 && (product.currentStock ?? 0) > 0) {
            // Create an initial lot with current stock and average cost
            const costExTax = getProductCostExTax(product);
            const taxRate = product.costTaxRate ?? 0.18;
            
            await addInventoryLot(
                product.id,
                product.currentStock ?? 0,
                costExTax,
                taxRate,
                {
                    purchaseDate: product.lastStockUpdate || product.lastDate || new Date().toISOString().split('T')[0],
                    lotNumber: 'INITIAL'
                }
            );
            
            lotsCreated++;
        }
    }
    
    console.log(`Created ${lotsCreated} initial FIFO lots for existing products`);
    return lotsCreated;
}

