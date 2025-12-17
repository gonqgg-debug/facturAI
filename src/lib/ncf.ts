import { db, generateId } from './db';
import type { NCFRange, NCFType, NCFUsage } from './types';
import { logAccountingAction } from './accounting-audit';

function todayISO(): string {
    return new Date().toISOString().split('T')[0];
}

function formatNCF(range: NCFRange): string {
    const nextNumber = range.currentNumber;
    // DGII NCF numbers are typically 10 digits after the prefix
    return `${range.prefix}${String(nextNumber).padStart(10, '0')}`;
}

async function getActiveRange(type: NCFType): Promise<NCFRange | null> {
    const ranges = await db.ncfRanges
        .where('type')
        .equals(type)
        .and(r => r.isActive && r.currentNumber <= r.endNumber && r.expirationDate >= todayISO())
        .sortBy('createdAt');

    return ranges[0] ?? null;
}

export async function addNCFRange(range: Omit<NCFRange, 'id'>): Promise<void> {
    const record: NCFRange = {
        ...range,
        id: generateId(),
        createdAt: range.createdAt ?? new Date()
    };
    await db.ncfRanges.add(record);
}

export async function getNCFRangeStatus(): Promise<Array<NCFRange & { remaining: number }>> {
    const ranges = await db.ncfRanges.toArray();
    return ranges.map(r => ({
        ...r,
        remaining: Math.max(0, r.endNumber - r.currentNumber + 1)
    }));
}

export async function getNextNCF(type: NCFType): Promise<string> {
    const range = await getActiveRange(type);
    if (!range) {
        throw new Error(`No active NCF range for type ${type}. Please configure a new range.`);
    }
    return formatNCF(range);
}

export async function issueNCF(type: NCFType, saleId: string): Promise<NCFUsage> {
    const sale = await db.sales.get(saleId);
    if (!sale) {
        throw new Error('Sale not found for NCF issuance');
    }

    const range = await getActiveRange(type);
    if (!range) {
        throw new Error(`No active NCF range for type ${type}. Please configure a new range.`);
    }

    const ncf = formatNCF(range);
    const usage: NCFUsage = {
        id: generateId(),
        ncf,
        type,
        saleId,
        customerId: sale.customerId,
        issuedAt: new Date(),
        amount: sale.total ?? 0,
        voided: false
    };

    // Persist usage
    await db.ncfUsage.add(usage);

    // Increment range counter
    await db.ncfRanges.update(range.id!, { currentNumber: range.currentNumber + 1 });

    // Attach NCF to sale (non-breaking; field is optional)
    await db.sales.update(saleId, { ncf });

    await logAccountingAction({
        action: 'ncf_issued',
        entityType: 'ncf',
        entityId: usage.id!,
        details: { saleId, ncf, type }
    });

    return usage;
}

export async function voidNCF(ncf: string, reason: string): Promise<void> {
    const usage = await db.ncfUsage.where('ncf').equals(ncf).first();
    if (!usage) {
        throw new Error('NCF not found');
    }
    await db.ncfUsage.update(usage.id!, {
        voided: true,
        voidedAt: new Date(),
        voidReason: reason
    });
    await logAccountingAction({
        action: 'ncf_voided',
        entityType: 'ncf',
        entityId: usage.id!,
        details: { ncf, reason }
    });
}

