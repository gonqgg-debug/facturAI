import { db, generateId } from './db';
import type { AccountingAuditEntry, AuditAction } from './types';

export interface AuditFilters {
    actions?: AuditAction[];
    entityType?: AccountingAuditEntry['entityType'];
    startDate?: string;
    endDate?: string;
}

export async function logAccountingAction(
    entry: Omit<AccountingAuditEntry, 'id' | 'timestamp'>
): Promise<void> {
    const record: AccountingAuditEntry = {
        ...entry,
        id: generateId(),
        timestamp: new Date()
    };
    await db.accountingAuditLog.add(record);
}

export async function getAuditLog(filters: AuditFilters = {}): Promise<AccountingAuditEntry[]> {
    let records = await db.accountingAuditLog.toArray();

    if (filters.actions && filters.actions.length > 0) {
        const actionSet = new Set(filters.actions);
        records = records.filter(r => actionSet.has(r.action));
    }

    if (filters.entityType) {
        records = records.filter(r => r.entityType === filters.entityType);
    }

    if (filters.startDate) {
        const start = new Date(filters.startDate).getTime();
        records = records.filter(r => new Date(r.timestamp).getTime() >= start);
    }

    if (filters.endDate) {
        const end = new Date(filters.endDate).getTime();
        records = records.filter(r => new Date(r.timestamp).getTime() <= end);
    }

    // Sort newest first
    records.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return records;
}

