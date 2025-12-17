import { db } from './db';
import type {
    AccountBalance,
    APAgingReport,
    ARAgingReport,
    BalanceSheet,
    CashFlowStatement,
    IncomeStatement,
    JournalEntryLine
} from './types';

// ============ HELPERS ============

function isDebitNormal(accountCode: string): boolean {
    return accountCode.startsWith('1') || accountCode.startsWith('5') || accountCode.startsWith('6');
}

function lineAmount(line: JournalEntryLine, asExpenseOrRevenue = false): number {
    // When asExpenseOrRevenue is true, return amounts as positive for revenue/expense presentation
    if (asExpenseOrRevenue) {
        if (line.accountCode.startsWith('4')) {
            return line.credit - line.debit; // Revenue: credits positive
        }
        if (line.accountCode.startsWith('5') || line.accountCode.startsWith('6')) {
            return line.debit - line.credit; // Expenses: debits positive
        }
    }
    // Default balance computation
    return isDebitNormal(line.accountCode)
        ? line.debit - line.credit
        : line.credit - line.debit;
}

function addToBucket(buckets: Record<string, number>, key: string, amount: number) {
    buckets[key] = (buckets[key] || 0) + amount;
}

function calculateAging(daysOverdue: number, amount: number, bucket: { current: number; days31to60: number; days61to90: number; over90: number; total: number }) {
    if (daysOverdue <= 30) bucket.current += amount;
    else if (daysOverdue <= 60) bucket.days31to60 += amount;
    else if (daysOverdue <= 90) bucket.days61to90 += amount;
    else bucket.over90 += amount;
    bucket.total += amount;
}

function parseDate(dateStr?: string): Date | null {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return Number.isNaN(d.getTime()) ? null : d;
}

// ============ FINANCIAL STATEMENTS ============

export async function getIncomeStatement(startDate: string, endDate: string): Promise<IncomeStatement> {
    const entries = await db.journalEntries
        .where('status').equals('posted')
        .and(e => e.date >= startDate && e.date <= endDate)
        .toArray();

    const revenueAccounts: Record<string, number> = {};
    const expenseAccounts: Record<string, number> = {};
    let totalRevenue = 0;
    let totalExpenses = 0;
    let cogs = 0;

    for (const entry of entries) {
        for (const line of entry.lines) {
            // Revenue (4xxx)
            if (line.accountCode.startsWith('4')) {
                const amount = lineAmount(line, true);
                addToBucket(revenueAccounts, line.accountCode, amount);
                totalRevenue += amount;
            }
            // COGS (5101)
            if (line.accountCode === '5101') {
                const amount = line.debit - line.credit;
                cogs += amount;
            }
            // Operating expenses (6xxx)
            if (line.accountCode.startsWith('6')) {
                const amount = line.debit - line.credit;
                addToBucket(expenseAccounts, line.accountCode, amount);
                totalExpenses += amount;
            }
        }
    }

    const revenue = Object.entries(revenueAccounts).map(([account, amount]) => ({
        account,
        name: '', // name resolved in UI from ACCOUNT_NAMES
        amount
    }));

    const operatingExpenses = Object.entries(expenseAccounts).map(([account, amount]) => ({
        account,
        name: '',
        amount
    }));

    const grossProfit = totalRevenue - cogs;
    const netIncome = grossProfit - totalExpenses;

    return {
        period: { start: startDate, end: endDate },
        revenue,
        totalRevenue,
        costOfGoodsSold: cogs,
        grossProfit,
        operatingExpenses,
        totalExpenses,
        netIncome
    };
}

export async function getBalanceSheet(asOfDate: string): Promise<BalanceSheet> {
    const entries = await db.journalEntries
        .where('status').equals('posted')
        .and(e => e.date <= asOfDate)
        .toArray();

    const balances = new Map<string, AccountBalance>();

    for (const entry of entries) {
        for (const line of entry.lines) {
            const existing = balances.get(line.accountCode) || {
                account: line.accountCode,
                name: line.accountName,
                debit: 0,
                credit: 0,
                balance: 0
            };

            existing.debit += line.debit;
            existing.credit += line.credit;
            existing.balance = isDebitNormal(line.accountCode)
                ? existing.debit - existing.credit
                : existing.credit - existing.debit;

            balances.set(line.accountCode, existing);
        }
    }

    const assetBalances = [...balances.values()].filter(b => b.account.startsWith('1'));
    const liabilityBalances = [...balances.values()].filter(b => b.account.startsWith('2'));

    const assetsTotal = assetBalances.reduce((sum, b) => sum + b.balance, 0);
    const liabilitiesTotal = liabilityBalances.reduce((sum, b) => sum + b.balance, 0);
    const equityRetained = assetsTotal - liabilitiesTotal;

    return {
        asOfDate,
        assets: { current: assetBalances, total: assetsTotal },
        liabilities: { current: liabilityBalances, total: liabilitiesTotal },
        equity: { retained: equityRetained, total: equityRetained }
    };
}

export async function getCashFlowStatement(startDate: string, endDate: string): Promise<CashFlowStatement> {
    // Minimal indirect-method cash flow using cash accounts (1101, 1102)
    const cashAccounts = ['1101', '1102'];

    const entries = await db.journalEntries
        .where('status').equals('posted')
        .and(e => e.date >= startDate && e.date <= endDate)
        .toArray();

    let netChange = 0;

    for (const entry of entries) {
        for (const line of entry.lines) {
            if (!cashAccounts.includes(line.accountCode)) continue;
            netChange += lineAmount(line);
        }
    }

    // Estimate beginning cash: sum balances before startDate
    const beginningEntries = await db.journalEntries
        .where('status').equals('posted')
        .and(e => e.date < startDate)
        .toArray();

    let beginningCash = 0;
    for (const entry of beginningEntries) {
        for (const line of entry.lines) {
            if (!cashAccounts.includes(line.accountCode)) continue;
            beginningCash += lineAmount(line);
        }
    }

    const endingCash = beginningCash + netChange;

    return {
        period: { start: startDate, end: endDate },
        operating: [{ label: 'Net change in cash (simplified)', amount: netChange }],
        investing: [],
        financing: [],
        netChange,
        beginningCash,
        endingCash
    };
}

// ============ AGING REPORTS ============

export async function getARAgingReport(): Promise<ARAgingReport> {
    const today = new Date();
    const bucketTemplate = () => ({ current: 0, days31to60: 0, days61to90: 0, over90: 0, total: 0 });
    const customerBuckets = new Map<string, { name: string; bucket: ReturnType<typeof bucketTemplate> }>();

    const sales = await db.sales.toArray();

    for (const sale of sales) {
        if (sale.paymentStatus === 'paid') continue;
        if (!sale.customerId) continue;

        const outstanding = Math.max(0, (sale.total ?? 0) - (sale.paidAmount ?? 0));
        if (outstanding === 0) continue;

        const saleDate = parseDate(sale.date) ?? today;
        const daysOverdue = Math.max(0, Math.floor((today.getTime() - saleDate.getTime()) / (1000 * 60 * 60 * 24)));

        const record = customerBuckets.get(sale.customerId) ?? { name: sale.customerName || 'Cliente', bucket: bucketTemplate() };
        calculateAging(daysOverdue, outstanding, record.bucket);
        customerBuckets.set(sale.customerId, record);
    }

    const customers = [...customerBuckets.entries()].map(([id, { name, bucket }]) => ({
        id,
        name,
        aging: bucket
    }));

    const totals = bucketTemplate();
    customers.forEach(c => {
        totals.current += c.aging.current;
        totals.days31to60 += c.aging.days31to60;
        totals.days61to90 += c.aging.days61to90;
        totals.over90 += c.aging.over90;
        totals.total += c.aging.total;
    });

    return { customers, totals };
}

export async function getAPAgingReport(): Promise<APAgingReport> {
    const today = new Date();
    const bucketTemplate = () => ({ current: 0, days31to60: 0, days61to90: 0, over90: 0, total: 0 });
    const supplierBuckets = new Map<string, { name: string; bucket: ReturnType<typeof bucketTemplate> }>();

    const invoices = await db.invoices.toArray();

    for (const invoice of invoices) {
        if (invoice.paymentStatus === 'paid') continue;
        if (!invoice.supplierId) continue;

        const outstanding = Math.max(0, (invoice.total ?? 0) - (invoice.paidAmount ?? 0));
        if (outstanding === 0) continue;

        const dueDate = parseDate(invoice.dueDate) || parseDate(invoice.issueDate) || today;
        const daysOverdue = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));

        const record = supplierBuckets.get(invoice.supplierId) ?? { name: invoice.providerName || 'Proveedor', bucket: bucketTemplate() };
        calculateAging(daysOverdue, outstanding, record.bucket);
        supplierBuckets.set(invoice.supplierId, record);
    }

    const suppliers = [...supplierBuckets.entries()].map(([id, { name, bucket }]) => ({
        id,
        name,
        aging: bucket
    }));

    const totals = bucketTemplate();
    suppliers.forEach(s => {
        totals.current += s.aging.current;
        totals.days31to60 += s.aging.days31to60;
        totals.days61to90 += s.aging.days61to90;
        totals.over90 += s.aging.over90;
        totals.total += s.aging.total;
    });

    return { suppliers, totals };
}

