import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadOrCreateLocalBook } from '../../src/domain/bootstrap/loadOrCreateLocalBook';
import { calculateAnalyticsSnapshot } from '../../src/domain/analytics/calculateAnalyticsSnapshot';
import { createCategory } from '../../src/domain/categories/createCategory';
import { calculateDashboardSnapshot } from '../../src/domain/dashboard/calculateDashboardSnapshot';
import { upsertExchangeRate } from '../../src/domain/settings/upsertExchangeRate';
import { createTransaction } from '../../src/domain/transactions/createTransaction';
import { AssetTrackerDb } from '../../src/storage/db';

describe('dashboard and analytics ranges', () => {
  let db: AssetTrackerDb;

  beforeEach(async () => {
    db = new AssetTrackerDb(`asset-tracker-dashboard-analytics-${crypto.randomUUID()}`);
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    await db.delete();
    db.close();
  });

  it('uses local calendar dates for dashboard and analytics day ranges', async () => {
    const book = await loadOrCreateLocalBook(db);
    const cash = await createCategory(db, {
      bookId: book.id,
      name: '现金',
      parentId: null,
      kind: 'asset',
      currency: 'CNY'
    });

    await createTransaction(db, {
      bookId: book.id,
      categoryId: cash.id,
      amount: 100,
      currency: 'CNY',
      direction: 'income',
      purpose: '午夜入账',
      description: '',
      occurredAt: '2026-04-21T16:30:00.000Z'
    });

    const dashboardSnapshot = await calculateDashboardSnapshot(db, book.id, {
      asOf: '2026-04-22T12:00:00.000Z',
      period: 'custom',
      rangeStart: '2026-04-22',
      rangeEnd: '2026-04-22'
    });
    const analyticsSnapshot = await calculateAnalyticsSnapshot(db, {
      bookId: book.id,
      asOf: '2026-04-22T12:00:00.000Z',
      compareAt: '2026-04-21T12:00:00.000Z',
      metric: 'net',
      analysisPreset: 'custom',
      analysisStart: '2026-04-22',
      analysisEnd: '2026-04-22',
      compositionMode: 'income',
      compositionPreset: 'day',
      compositionStart: '2026-04-22',
      compositionEnd: '2026-04-22',
      piePreset: 'day',
      pieStart: '2026-04-22',
      pieEnd: '2026-04-22',
      forecastDays: 30
    });

    expect(dashboardSnapshot.recentCashflows.find((item) => item.key === 'day')?.income).toBe(10000);
    expect(analyticsSnapshot.analysisSeries).toHaveLength(1);
    expect(analyticsSnapshot.analysisSeries[0]?.income).toBe(10000);
  });

  it('keeps yearly dashboard trends aligned to calendar months at end-of-month boundaries', async () => {
    const book = await loadOrCreateLocalBook(db);

    const snapshot = await calculateDashboardSnapshot(db, book.id, {
      asOf: '2025-01-31T12:00:00.000Z',
      period: 'year'
    });

    expect(snapshot.trend).toHaveLength(12);
    expect(snapshot.trend[0]?.label).toBe('02月');
    expect(snapshot.trend.at(-1)?.label).toBe('01月');
  });

  it('normalizes income composition into the base currency for multi-currency charts', async () => {
    const book = await loadOrCreateLocalBook(db);
    const cny = await createCategory(db, {
      bookId: book.id,
      name: '工资卡',
      parentId: null,
      kind: 'asset',
      currency: 'CNY'
    });
    const usd = await createCategory(db, {
      bookId: book.id,
      name: '美元账户',
      parentId: null,
      kind: 'asset',
      currency: 'USD'
    });

    await createTransaction(db, {
      bookId: book.id,
      categoryId: usd.id,
      amount: 100,
      currency: 'USD',
      direction: 'income',
      purpose: '美元收入',
      description: '',
      occurredAt: '2026-04-10T08:00:00.000Z'
    });
    await createTransaction(db, {
      bookId: book.id,
      categoryId: cny.id,
      amount: 200,
      currency: 'CNY',
      direction: 'income',
      purpose: '人民币收入',
      description: '',
      occurredAt: '2026-04-10T09:00:00.000Z'
    });
    await upsertExchangeRate(db, {
      bookId: book.id,
      currency: 'USD',
      baseCurrency: 'CNY',
      rate: 7,
      effectiveFrom: '2026-04-01'
    });

    const snapshot = await calculateAnalyticsSnapshot(db, {
      bookId: book.id,
      asOf: '2026-04-30T12:00:00.000Z',
      compareAt: '2026-03-31T12:00:00.000Z',
      metric: 'net',
      analysisPreset: '30',
      compositionMode: 'income',
      compositionPreset: 'month',
      compositionStart: '2026-04-01',
      compositionEnd: '2026-04-30',
      piePreset: 'month',
      pieStart: '2026-04-01',
      pieEnd: '2026-04-30',
      forecastDays: 30
    });

    const usdEntry = snapshot.categoryComposition.find((item) => item.name === '美元账户');
    const cnyEntry = snapshot.categoryComposition.find((item) => item.name === '工资卡');
    const incomePie = snapshot.pieCompositions.find((item) => item.mode === 'income');

    expect(usdEntry?.currency).toBe('CNY');
    expect(usdEntry?.amount).toBe(70000);
    expect(cnyEntry?.amount).toBe(20000);
    expect(incomePie?.items.find((item) => item.name === '美元收入')?.amount).toBe(70000);
  });

  it('clips monthly custom analytics ranges to the selected boundaries', async () => {
    const book = await loadOrCreateLocalBook(db);
    const cash = await createCategory(db, {
      bookId: book.id,
      name: '现金',
      parentId: null,
      kind: 'asset',
      currency: 'CNY'
    });

    await createTransaction(db, {
      bookId: book.id,
      categoryId: cash.id,
      amount: 100,
      currency: 'CNY',
      direction: 'income',
      purpose: '范围前收入',
      description: '',
      occurredAt: '2026-01-05T08:00:00.000Z'
    });
    await createTransaction(db, {
      bookId: book.id,
      categoryId: cash.id,
      amount: 200,
      currency: 'CNY',
      direction: 'income',
      purpose: '范围内一月收入',
      description: '',
      occurredAt: '2026-01-20T08:00:00.000Z'
    });
    await createTransaction(db, {
      bookId: book.id,
      categoryId: cash.id,
      amount: 300,
      currency: 'CNY',
      direction: 'income',
      purpose: '范围内二月收入',
      description: '',
      occurredAt: '2026-02-10T08:00:00.000Z'
    });
    await createTransaction(db, {
      bookId: book.id,
      categoryId: cash.id,
      amount: 400,
      currency: 'CNY',
      direction: 'expense',
      purpose: '范围后支出',
      description: '',
      occurredAt: '2026-05-25T08:00:00.000Z'
    });

    const dashboardSnapshot = await calculateDashboardSnapshot(db, book.id, {
      asOf: '2026-05-20T12:00:00.000Z',
      period: 'custom',
      rangeStart: '2026-01-15',
      rangeEnd: '2026-05-20'
    });
    const analyticsSnapshot = await calculateAnalyticsSnapshot(db, {
      bookId: book.id,
      asOf: '2026-05-20T12:00:00.000Z',
      compareAt: '2026-01-14T12:00:00.000Z',
      metric: 'net',
      analysisPreset: 'custom',
      analysisStart: '2026-01-15',
      analysisEnd: '2026-05-20',
      compositionMode: 'income',
      compositionPreset: 'custom',
      compositionStart: '2026-01-15',
      compositionEnd: '2026-05-20',
      piePreset: 'custom',
      pieStart: '2026-01-15',
      pieEnd: '2026-05-20',
      forecastDays: 30
    });

    expect(dashboardSnapshot.trend).toHaveLength(5);
    expect(dashboardSnapshot.trend[0]?.label).toBe('01月');
    expect(dashboardSnapshot.trend.at(-1)?.asOf.startsWith('2026-05-20')).toBe(true);
    expect(analyticsSnapshot.analysisSeries).toHaveLength(5);
    expect(analyticsSnapshot.analysisSeries[0]).toMatchObject({
      label: '01月',
      income: 20000,
      expense: 0,
      net: 20000
    });
    expect(analyticsSnapshot.analysisSeries.at(-1)).toMatchObject({
      label: '05月',
      income: 0,
      expense: 0,
      net: 0
    });
  });
});
