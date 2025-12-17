import { describe, it, expect, vi, beforeEach } from 'vitest';

const auditLog: any[] = [];

vi.mock('../db', () => ({
  db: {
    accountingAuditLog: {
      add: async (r: any) => { auditLog.push(r); },
      toArray: async () => auditLog
    }
  },
  generateId: () => 'audit-id-1'
}));

import { logAccountingAction, getAuditLog } from '../accounting-audit';

describe('accounting-audit', () => {
  beforeEach(() => {
    auditLog.length = 0;
  });

  it('logs and filters audit records', async () => {
    await logAccountingAction({
      action: 'journal_entry_created',
      entityType: 'journal_entry',
      entityId: 'je-1',
      details: { entryNumber: 'JE-1' }
    });

    await logAccountingAction({
      action: 'ncf_issued',
      entityType: 'ncf',
      entityId: 'ncf-1',
      details: { ncf: 'B0200001' }
    });

    const all = await getAuditLog();
    expect(all.length).toBe(2);

    const filtered = await getAuditLog({ actions: ['ncf_issued'] });
    expect(filtered.length).toBe(1);
    expect(filtered[0].action).toBe('ncf_issued');
  });
});

