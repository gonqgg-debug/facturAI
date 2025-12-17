import { describe, it, expect, vi, beforeEach } from 'vitest';
import { randomUUID } from 'crypto';

const ranges: any[] = [];
const usage: any[] = [];
let sales: Record<string, any> = {};

vi.mock('../db', () => {
  return {
    db: {
      ncfRanges: {
        where: () => ({
          equals: (type: string) => ({
            and: (fn: (r: any) => boolean) => ({
              sortBy: async () => ranges.filter(r => r.type === type).filter(fn)
            })
          })
        }),
        add: async (r: any) => { ranges.push(r); },
        update: async (id: string, data: any) => {
          const idx = ranges.findIndex(r => r.id === id);
          if (idx >= 0) ranges[idx] = { ...ranges[idx], ...data };
        },
        toArray: async () => ranges
      },
      ncfUsage: {
        add: async (u: any) => { usage.push(u); },
        where: () => ({
          equals: (ncf: string) => ({
            first: async () => usage.find(u => u.ncf === ncf)
          })
        }),
        update: async (id: string, data: any) => {
          const idx = usage.findIndex(u => u.id === id);
          if (idx >= 0) usage[idx] = { ...usage[idx], ...data };
        }
      },
      sales: {
        get: async (id: string) => sales[id],
        update: async (id: string, data: any) => { sales[id] = { ...sales[id], ...data }; }
      }
    },
    generateId: () => randomUUID()
  };
});

import { addNCFRange, getNextNCF, issueNCF, voidNCF } from '../ncf';

describe('ncf service', () => {
  beforeEach(() => {
    ranges.length = 0;
    usage.length = 0;
    sales = { 'sale-1': { id: 'sale-1', total: 1000 } };
  });

  it('issues sequential NCFs', async () => {
    await addNCFRange({
      type: 'B02',
      prefix: 'B02',
      startNumber: 1,
      endNumber: 10,
      currentNumber: 1,
      expirationDate: '2099-12-31',
      isActive: true,
      createdAt: new Date()
    });

    const next = await getNextNCF('B02');
    expect(next).toBe('B020000000001');

    const usageRecord = await issueNCF('B02', 'sale-1');
    expect(usageRecord.ncf).toBe('B020000000001');
  });

  it('voids an issued NCF', async () => {
    await addNCFRange({
      type: 'B02',
      prefix: 'B02',
      startNumber: 1,
      endNumber: 10,
      currentNumber: 1,
      expirationDate: '2099-12-31',
      isActive: true,
      createdAt: new Date()
    });
    const record = await issueNCF('B02', 'sale-1');
    await voidNCF(record.ncf, 'Error');
    expect(usage.find(u => u.ncf === record.ncf)?.voided).toBe(true);
  });
});

