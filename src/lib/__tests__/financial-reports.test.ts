import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../db', () => {
  const journalEntries = [
    {
      id: 'je-1',
      date: '2024-01-05',
      status: 'posted',
      lines: [
        { accountCode: '4101', accountName: 'Ventas', debit: 0, credit: 100 },
        { accountCode: '5101', accountName: 'COGS', debit: 40, credit: 0 },
        { accountCode: '6104', accountName: 'Comisiones', debit: 10, credit: 0 }
      ]
    }
  ];

  return {
    db: {
      journalEntries: {
        where: () => ({
          and: () => ({
            toArray: async () => journalEntries
          })
        })
      }
    }
  };
});

import { getIncomeStatement } from '../financial-reports';

describe('financial-reports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calculates income statement correctly', async () => {
    const result = await getIncomeStatement('2024-01-01', '2024-01-31');
    expect(result.totalRevenue).toBe(100);
    expect(result.costOfGoodsSold).toBe(40);
    expect(result.totalExpenses).toBe(10);
    expect(result.netIncome).toBe(50);
    expect(result.grossProfit).toBe(60);
  });
});

