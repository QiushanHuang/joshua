import type { BalanceContext, LeafCategoryBalance } from '../balances/balanceEngine';
import type { CurrencyCode, Transaction } from '../../shared/types/entities';
import {
  endOfLocalDateIso,
  formatDateForDateInput,
  monthStartDateKey,
  parseDateInputToLocalDate,
  shiftLocalDateKey,
  shiftLocalMonthKey,
  startOfLocalDateIso
} from '../../shared/utils/datetimeLocal';
import { resolveExchangeRateAt } from '../settings/exchangeRateTimeline';

export type AnalyticsRangePreset = '7' | '30' | '90' | '365' | 'year' | 'custom';
export type AnalyticsCompositionPreset = 'day' | 'week' | 'month' | 'year' | 'custom';
export type AnalyticsCompositionMode = 'asset' | 'income' | 'expense';
export type AnalyticsCompositionKind = 'asset' | 'debt' | 'income' | 'expense';

export interface ResolvedAnalyticsRange {
  startDate: string;
  endDate: string;
  startIso: string;
  endIso: string;
  label: string;
  bucket: 'day' | 'month';
}

export interface CashflowSeriesPoint {
  label: string;
  asOf: string;
  income: number;
  expense: number;
  net: number;
}

export interface AnalyticsCompositionEntry {
  categoryId: string;
  name: string;
  currency: CurrencyCode;
  amount: number;
  kind: AnalyticsCompositionKind;
}

function countDaysInclusive(startDate: string, endDate: string): number {
  const start = parseDateInputToLocalDate(startDate);
  const end = parseDateInputToLocalDate(endDate);
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
}

function countMonthsInclusive(startDate: string, endDate: string): number {
  const start = parseDateInputToLocalDate(monthStartDateKey(startDate));
  const end = parseDateInputToLocalDate(monthStartDateKey(endDate));
  return Math.max(
    1,
    (end.getFullYear() - start.getFullYear()) * 12 +
      (end.getMonth() - start.getMonth()) +
      1
  );
}

function buildRangeLabel(startDate: string, endDate: string, preset: string): string {
  if (preset === 'year') {
    return `${startDate.slice(0, 4)} 年累计`;
  }

  if (preset === '7') {
    return '最近 7 天';
  }

  if (preset === '30') {
    return '最近 30 天';
  }

  if (preset === '90') {
    return '最近 90 天';
  }

  if (preset === '365') {
    return '最近 365 天';
  }

  if (preset === 'day') {
    return '最近 1 天';
  }

  if (preset === 'week') {
    return '最近 7 天';
  }

  if (preset === 'month') {
    return '最近 30 天';
  }

  return `${startDate} 至 ${endDate}`;
}

export function resolveAnalyticsRange(
  asOf: string,
  preset: AnalyticsRangePreset,
  startDate?: string,
  endDate?: string
): ResolvedAnalyticsRange {
  const resolvedEnd = endDate ?? formatDateForDateInput(asOf);

  if (preset === 'year') {
    const resolvedStart = `${resolvedEnd.slice(0, 4)}-01-01`;
    return {
      startDate: resolvedStart,
      endDate: resolvedEnd,
      startIso: startOfLocalDateIso(resolvedStart),
      endIso: endOfLocalDateIso(resolvedEnd),
      label: buildRangeLabel(resolvedStart, resolvedEnd, preset),
      bucket: 'month'
    };
  }

  if (preset === '7' || preset === '30' || preset === '90' || preset === '365') {
    const offset = Number(preset) - 1;
    const resolvedStart = shiftLocalDateKey(resolvedEnd, offset * -1);

    return {
      startDate: resolvedStart,
      endDate: resolvedEnd,
      startIso: startOfLocalDateIso(resolvedStart),
      endIso: endOfLocalDateIso(resolvedEnd),
      label: buildRangeLabel(resolvedStart, resolvedEnd, preset),
      bucket: preset === '365' ? 'month' : 'day'
    };
  }

  const resolvedStart =
    startDate && startDate <= resolvedEnd ? startDate : resolvedEnd;

  return {
    startDate: resolvedStart,
    endDate: resolvedEnd,
    startIso: startOfLocalDateIso(resolvedStart),
    endIso: endOfLocalDateIso(resolvedEnd),
    label: buildRangeLabel(resolvedStart, resolvedEnd, preset),
    bucket: countDaysInclusive(resolvedStart, resolvedEnd) > 120 ? 'month' : 'day'
  };
}

export function resolveCompositionRange(
  asOf: string,
  preset: AnalyticsCompositionPreset,
  startDate?: string,
  endDate?: string
): ResolvedAnalyticsRange {
  const resolvedEnd = endDate ?? formatDateForDateInput(asOf);

  if (preset === 'day') {
    return {
      startDate: resolvedEnd,
      endDate: resolvedEnd,
      startIso: startOfLocalDateIso(resolvedEnd),
      endIso: endOfLocalDateIso(resolvedEnd),
      label: buildRangeLabel(resolvedEnd, resolvedEnd, preset),
      bucket: 'day'
    };
  }

  if (preset === 'week') {
    const resolvedStart = shiftLocalDateKey(resolvedEnd, -6);
    return {
      startDate: resolvedStart,
      endDate: resolvedEnd,
      startIso: startOfLocalDateIso(resolvedStart),
      endIso: endOfLocalDateIso(resolvedEnd),
      label: buildRangeLabel(resolvedStart, resolvedEnd, preset),
      bucket: 'day'
    };
  }

  if (preset === 'month') {
    const resolvedStart = shiftLocalDateKey(resolvedEnd, -29);
    return {
      startDate: resolvedStart,
      endDate: resolvedEnd,
      startIso: startOfLocalDateIso(resolvedStart),
      endIso: endOfLocalDateIso(resolvedEnd),
      label: buildRangeLabel(resolvedStart, resolvedEnd, preset),
      bucket: 'day'
    };
  }

  if (preset === 'year') {
    const resolvedStart = `${resolvedEnd.slice(0, 4)}-01-01`;
    return {
      startDate: resolvedStart,
      endDate: resolvedEnd,
      startIso: startOfLocalDateIso(resolvedStart),
      endIso: endOfLocalDateIso(resolvedEnd),
      label: buildRangeLabel(resolvedStart, resolvedEnd, preset),
      bucket: 'month'
    };
  }

  const resolvedStart =
    startDate && startDate <= resolvedEnd ? startDate : resolvedEnd;

  return {
    startDate: resolvedStart,
    endDate: resolvedEnd,
    startIso: startOfLocalDateIso(resolvedStart),
    endIso: endOfLocalDateIso(resolvedEnd),
    label: buildRangeLabel(resolvedStart, resolvedEnd, preset),
    bucket: countDaysInclusive(resolvedStart, resolvedEnd) > 120 ? 'month' : 'day'
  };
}

function summarizeTransactionsForRange(
  transactions: Transaction[],
  startIso: string,
  endIso: string
): Omit<CashflowSeriesPoint, 'label' | 'asOf'> {
  return transactions.reduce(
    (summary, transaction) => {
      if (transaction.occurredAt < startIso || transaction.occurredAt > endIso) {
        return summary;
      }

      if (transaction.direction === 'income') {
        summary.income += Math.abs(transaction.amount);
        summary.net += Math.abs(transaction.amount);
      }

      if (transaction.direction === 'expense') {
        summary.expense += Math.abs(transaction.amount);
        summary.net -= Math.abs(transaction.amount);
      }

      return summary;
    },
    {
      income: 0,
      expense: 0,
      net: 0
    }
  );
}

function formatDailyLabel(dateKey: string): string {
  return dateKey.slice(5);
}

function formatMonthlyLabel(dateKey: string): string {
  return `${dateKey.slice(5, 7)}月`;
}

function minDateKey(left: string, right: string): string {
  return left <= right ? left : right;
}

function resolveMonthlyBucket(
  pointMonth: string,
  range: Pick<ResolvedAnalyticsRange, 'startDate' | 'endDate'>
): { startDate: string; endDate: string } {
  const nextMonth = monthStartDateKey(shiftLocalMonthKey(pointMonth, 1));
  const monthEnd = shiftLocalDateKey(nextMonth, -1);

  return {
    startDate: pointMonth === monthStartDateKey(range.startDate) ? range.startDate : pointMonth,
    endDate: minDateKey(monthEnd, range.endDate)
  };
}

export function buildCashflowSeries(
  transactions: Transaction[],
  range: ResolvedAnalyticsRange
): CashflowSeriesPoint[] {
  if (range.bucket === 'month') {
    const firstMonth = monthStartDateKey(range.startDate);
    const lastMonth = monthStartDateKey(range.endDate);
    const monthCount = countMonthsInclusive(firstMonth, lastMonth);

    return Array.from({ length: monthCount }, (_, index) => {
      const pointMonth = monthStartDateKey(shiftLocalMonthKey(firstMonth, index));
      const bucket = resolveMonthlyBucket(pointMonth, range);
      const summary = summarizeTransactionsForRange(
        transactions,
        startOfLocalDateIso(bucket.startDate),
        endOfLocalDateIso(bucket.endDate)
      );

      return {
        label: formatMonthlyLabel(pointMonth),
        asOf: endOfLocalDateIso(bucket.endDate),
        ...summary
      };
    });
  }

  const dayCount = countDaysInclusive(range.startDate, range.endDate);

  return Array.from({ length: dayCount }, (_, index) => {
    const pointDate = shiftLocalDateKey(range.startDate, index);
    const summary = summarizeTransactionsForRange(
      transactions,
      startOfLocalDateIso(pointDate),
      endOfLocalDateIso(pointDate)
    );

    return {
      label: formatDailyLabel(pointDate),
      asOf: endOfLocalDateIso(pointDate),
      ...summary
    };
  });
}

export function buildAssetComposition(
  context: BalanceContext,
  balances: LeafCategoryBalance[],
  asOf: string
): AnalyticsCompositionEntry[] {
  const items: AnalyticsCompositionEntry[] = [];

  balances
    .filter((item) => item.amount !== 0)
    .forEach((item) => {
      const rate =
        item.currency === context.book.baseCurrency
          ? 1
          : resolveExchangeRateAt(
              context.exchangeRates,
              context.book.baseCurrency,
              item.currency,
              asOf
            )?.rate;

      if (!rate) {
        return;
      }

      items.push({
        categoryId: item.categoryId,
        name: item.name,
        currency: context.book.baseCurrency,
        amount: Math.round(item.amount * rate),
        kind: item.kind
      });
    });

  return items.sort((left, right) => Math.abs(right.amount) - Math.abs(left.amount));
}

export function buildFlowComposition(
  context: BalanceContext,
  range: ResolvedAnalyticsRange,
  mode: Extract<AnalyticsCompositionMode, 'income' | 'expense'>
): AnalyticsCompositionEntry[] {
  const categoryById = new Map(context.categories.map((category) => [category.id, category]));
  const totals = new Map<string, number>();
  const items: AnalyticsCompositionEntry[] = [];

  context.transactions.forEach((transaction) => {
    if (
      transaction.occurredAt < range.startIso ||
      transaction.occurredAt > range.endIso ||
      transaction.direction !== mode
    ) {
      return;
    }

    const rate =
      transaction.currency === context.book.baseCurrency
        ? 1
        : resolveExchangeRateAt(
            context.exchangeRates,
            context.book.baseCurrency,
            transaction.currency,
            transaction.occurredAt
          )?.rate;

    if (!rate) {
      return;
    }

    totals.set(
      transaction.categoryId,
      (totals.get(transaction.categoryId) ?? 0) + Math.round(Math.abs(transaction.amount) * rate)
    );
  });

  [...totals.entries()].forEach(([categoryId, amount]) => {
    const category = categoryById.get(categoryId);

    if (!category) {
      return;
    }

    items.push({
      categoryId,
      name: category.name,
      currency: context.book.baseCurrency,
      amount,
      kind: mode
    });
  });

  return items.sort((left, right) => right.amount - left.amount);
}

export function buildPurposeComposition(
  context: BalanceContext,
  range: ResolvedAnalyticsRange,
  mode: Extract<AnalyticsCompositionMode, 'income' | 'expense'>
): AnalyticsCompositionEntry[] {
  const totals = new Map<string, number>();
  const labels = new Map<string, string>();
  const normalizedCurrency = context.book.baseCurrency;

  context.transactions.forEach((transaction) => {
    if (
      transaction.occurredAt < range.startIso ||
      transaction.occurredAt > range.endIso ||
      transaction.direction !== mode
    ) {
      return;
    }

    const rate =
      transaction.currency === context.book.baseCurrency
        ? 1
        : resolveExchangeRateAt(
            context.exchangeRates,
            context.book.baseCurrency,
            transaction.currency,
            transaction.occurredAt
          )?.rate;

    if (!rate) {
      return;
    }

    const purpose = transaction.purpose.trim() || '未命名用途';
    const key = purpose.toLocaleLowerCase();
    labels.set(key, purpose);
    totals.set(key, (totals.get(key) ?? 0) + Math.round(Math.abs(transaction.amount) * rate));
  });

  return [...totals.entries()]
    .map(([purposeKey, amount]) => ({
      categoryId: `purpose:${mode}:${purposeKey}`,
      name: labels.get(purposeKey) ?? purposeKey,
      currency: normalizedCurrency,
      amount,
      kind: mode
    }))
    .sort((left, right) => right.amount - left.amount);
}
