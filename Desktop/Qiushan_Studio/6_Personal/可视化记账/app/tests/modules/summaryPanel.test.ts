import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadOrCreateLocalBook } from '../../src/domain/bootstrap/loadOrCreateLocalBook';
import { createCategory } from '../../src/domain/categories/createCategory';
import { renderSummaryPanel } from '../../src/modules/dashboard/renderSummaryPanel';
import { createTransaction } from '../../src/domain/transactions/createTransaction';
import { AssetTrackerDb } from '../../src/storage/db';

function flushAsyncWork(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

describe('renderSummaryPanel', () => {
  let db: AssetTrackerDb;

  beforeEach(async () => {
    db = new AssetTrackerDb(`asset-tracker-summary-panel-${crypto.randomUUID()}`);
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    await db.delete();
    db.close();
    document.body.innerHTML = '';
  });

  it('shows dashboard range controls, cashflow rows, and lets the user persist a dashboard memo', async () => {
    const book = await loadOrCreateLocalBook(db);
    const cash = await createCategory(db, {
      bookId: book.id,
      name: '现金',
      parentId: null,
      kind: 'asset',
      currency: 'CNY'
    });
    const debt = await createCategory(db, {
      bookId: book.id,
      name: '信用卡',
      parentId: null,
      kind: 'debt',
      currency: 'CNY'
    });

    await createTransaction(db, {
      bookId: book.id,
      categoryId: cash.id,
      amount: 300,
      currency: 'CNY',
      direction: 'income',
      purpose: '季度红包',
      description: '',
      occurredAt: '2026-03-25T09:00:00.000Z'
    });
    await createTransaction(db, {
      bookId: book.id,
      categoryId: cash.id,
      amount: 120,
      currency: 'CNY',
      direction: 'expense',
      purpose: '月初采购',
      description: '',
      occurredAt: '2026-03-25T10:00:00.000Z'
    });
    await createTransaction(db, {
      bookId: book.id,
      categoryId: cash.id,
      amount: 500,
      currency: 'CNY',
      direction: 'income',
      purpose: '项目入账',
      description: '',
      occurredAt: '2026-04-11T08:00:00.000Z'
    });
    await createTransaction(db, {
      bookId: book.id,
      categoryId: debt.id,
      amount: 50,
      currency: 'CNY',
      direction: 'expense',
      purpose: '出行刷卡',
      description: '',
      occurredAt: '2026-04-11T10:00:00.000Z'
    });
    await createTransaction(db, {
      bookId: book.id,
      categoryId: cash.id,
      amount: 200,
      currency: 'CNY',
      direction: 'income',
      purpose: '今日入账',
      description: '',
      occurredAt: '2026-04-14T08:00:00.000Z'
    });
    await createTransaction(db, {
      bookId: book.id,
      categoryId: cash.id,
      amount: 80,
      currency: 'CNY',
      direction: 'expense',
      purpose: '午餐',
      description: '最近账单',
      occurredAt: '2026-04-14T09:00:00.000Z'
    });

    const target = document.createElement('div');
    document.body.appendChild(target);

    await renderSummaryPanel({
      db,
      book,
      now: '2026-04-14T12:00:00.000Z',
      target,
      onChange: async () => {
        const latestBook = await db.books.get(book.id);

        if (!latestBook) {
          throw new Error('Missing latest book');
        }

        await renderSummaryPanel({
          db,
          book: latestBook,
          now: '2026-04-14T12:00:00.000Z',
          target
        });
      }
    } as any);

    expect(target.textContent).toContain('资产总览');
    expect(target.textContent).toContain('总资产变化');
    expect(target.textContent).toContain('图表概况');
    expect(target.textContent).toContain('最近账单');
    expect(target.textContent).toContain('午餐');
    expect(target.querySelector('[data-role="dashboard-period"]')).not.toBeNull();
    expect(target.querySelector('[data-role="dashboard-range-start"]')).not.toBeNull();
    expect(target.querySelector('[data-role="dashboard-range-end"]')).not.toBeNull();
    expect(target.querySelectorAll('[data-role="dashboard-grid-line"]').length).toBeGreaterThan(0);
    expect(target.querySelectorAll('[data-role="dashboard-y-axis-label"]').length).toBeGreaterThan(0);
    expect(target.textContent).not.toContain('币种汇总');

    const assetValue = target.querySelector<HTMLElement>('[data-summary-kind="asset"] .value');
    const debtValue = target.querySelector<HTMLElement>('[data-summary-kind="debt"] .value');
    const assetSummary = target.querySelector<HTMLElement>('.asset-summary');
    const monthIncome = target.querySelector<HTMLElement>(
      '[data-window="month"] [data-flow-kind="income"]'
    );
    const monthExpense = target.querySelector<HTMLElement>(
      '[data-window="month"] [data-flow-kind="expense"]'
    );
    const monthNet = target.querySelector<HTMLElement>('[data-window="month"] [data-flow-kind="net"]');
    const weekIncome = target.querySelector<HTMLElement>(
      '[data-window="week"] [data-flow-kind="income"]'
    );
    const weekExpense = target.querySelector<HTMLElement>(
      '[data-window="week"] [data-flow-kind="expense"]'
    );
    const weekNet = target.querySelector<HTMLElement>('[data-window="week"] [data-flow-kind="net"]');
    const dayIncome = target.querySelector<HTMLElement>('[data-window="day"] [data-flow-kind="income"]');
    const dayExpense = target.querySelector<HTMLElement>(
      '[data-window="day"] [data-flow-kind="expense"]'
    );
    const dayNet = target.querySelector<HTMLElement>('[data-window="day"] [data-flow-kind="net"]');

    expect(assetValue?.className).toContain('summary-value--asset');
    expect(debtValue?.className).toContain('negative');
    expect(assetSummary?.querySelector('[data-role="currency-summary"]')).not.toBeNull();
    expect(monthIncome?.textContent).toContain('1000.00');
    expect(monthExpense?.textContent).toContain('250.00');
    expect(monthNet?.textContent).toContain('750.00');
    expect(weekIncome?.textContent).toContain('700.00');
    expect(weekExpense?.textContent).toContain('130.00');
    expect(weekNet?.textContent).toContain('570.00');
    expect(dayIncome?.textContent).toContain('200.00');
    expect(dayExpense?.textContent).toContain('80.00');
    expect(dayNet?.textContent).toContain('120.00');

    const memoForm = target.querySelector<HTMLFormElement>('[data-role="summary-memo-form"]');

    if (!memoForm) {
      throw new Error('Missing summary memo form');
    }

    (memoForm.elements.namedItem('memo') as HTMLTextAreaElement).value = '工资到账后记得转储蓄。';
    memoForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushAsyncWork();
    await flushAsyncWork();

    const periodSelect = target.querySelector<HTMLSelectElement>('[data-role="dashboard-period"]');
    const rangeForm = target.querySelector<HTMLFormElement>('[data-role="dashboard-range-form"]');
    const startInput = target.querySelector<HTMLInputElement>('[data-role="dashboard-range-start"]');
    const endInput = target.querySelector<HTMLInputElement>('[data-role="dashboard-range-end"]');

    if (!periodSelect || !rangeForm || !startInput || !endInput) {
      throw new Error('Missing dashboard range controls');
    }

    periodSelect.value = 'week';
    periodSelect.dispatchEvent(new Event('change', { bubbles: true }));
    await flushAsyncWork();
    await flushAsyncWork();
    expect(target.querySelector<HTMLInputElement>('[data-role="dashboard-range-start"]')?.value).toBe(
      '2026-04-08'
    );
    expect(target.querySelector<HTMLInputElement>('[data-role="dashboard-range-end"]')?.value).toBe(
      '2026-04-14'
    );

    startInput.value = '2026-03-25';
    endInput.value = '2026-04-11';
    rangeForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushAsyncWork();
    await flushAsyncWork();

    expect(target.querySelector<HTMLSelectElement>('[data-role="dashboard-period"]')?.value).toBe('custom');
    expect(target.querySelector<HTMLElement>('[data-role="dashboard-range-label"]')?.textContent).toContain(
      '2026-03-25'
    );

    const latestBook = await db.books.get(book.id);

    expect((latestBook as any)?.memo).toBe('工资到账后记得转储蓄。');
  });

  it('keeps empty overview axes at zero instead of rendering negative cent labels', async () => {
    const book = await loadOrCreateLocalBook(db);
    const target = document.createElement('div');
    document.body.appendChild(target);

    await renderSummaryPanel({
      db,
      book,
      now: '2026-04-14T12:00:00.000Z',
      target
    });

    const axisLabels = Array.from(
      target.querySelectorAll<HTMLElement>('[data-role="dashboard-y-axis-label"]')
    ).map((item) => item.textContent?.trim());

    expect(axisLabels.every((label) => label === '0.00')).toBe(true);
    expect(target.textContent).not.toContain('-0.01');
  });
});
