import { listLeafCategoryBalancesAt, loadBalanceContext, summarizeBookBalancesAt } from '../balances/balanceEngine';
import { AssetTrackerDb } from '../../storage/db';
import { listTransactionsForBook, type TransactionListItem } from '../transactions/listTransactionsForBook';
import {
  endOfLocalDateIso,
  formatDateForDateInput,
  monthStartDateKey,
  parseDateInputToLocalDate,
  shiftLocalDateKey,
  shiftLocalMonthKey,
  startOfLocalDateIso
} from '../../shared/utils/datetimeLocal';

export type DashboardTrendPeriod = 'week' | 'month' | 'year' | 'custom';

export interface DashboardSnapshotInput {
  asOf?: string;
  period?: DashboardTrendPeriod;
  rangeStart?: string;
  rangeEnd?: string;
}

export interface DashboardTrendPoint {
  label: string;
  asOf: string;
  value: number;
}

export interface DashboardCashflowWindow {
  key: 'month' | 'week' | 'day';
  label: string;
  income: number;
  expense: number;
  net: number;
}

export interface DashboardSnapshot {
  asOf: string;
  currentSummary: ReturnType<typeof summarizeBookBalancesAt>;
  previousWeekSummary: ReturnType<typeof summarizeBookBalancesAt>;
  previousMonthSummary: ReturnType<typeof summarizeBookBalancesAt>;
  selectedPeriod: DashboardTrendPeriod;
  selectedPeriodLabel: string;
  selectedPeriodDelta: number;
  rangeStart: string;
  rangeEnd: string;
  trend: DashboardTrendPoint[];
  topAssets: ReturnType<typeof listLeafCategoryBalancesAt>;
  topDebts: ReturnType<typeof listLeafCategoryBalancesAt>;
  recentTransactions: TransactionListItem[];
  recentCashflows: DashboardCashflowWindow[];
  memo: string;
}

interface ResolvedDashboardRange {
  startDate: string;
  endDate: string;
  startIso: string;
  endIso: string;
  label: string;
  bucket: 'day' | 'month';
}

function formatDayLabel(dateKey: string): string {
  return dateKey.slice(5).replace('-', '-');
}

function formatMonthLabel(dateKey: string): string {
  return `${dateKey.slice(5, 7)}月`;
}

function minDateKey(left: string, right: string): string {
  return left <= right ? left : right;
}

function resolveMonthlyBucket(
  pointMonth: string,
  range: Pick<ResolvedDashboardRange, 'startDate' | 'endDate'>
): { startDate: string; endDate: string } {
  const nextMonth = monthStartDateKey(shiftLocalMonthKey(pointMonth, 1));
  const monthEnd = shiftLocalDateKey(nextMonth, -1);

  return {
    startDate: pointMonth === monthStartDateKey(range.startDate) ? range.startDate : pointMonth,
    endDate: minDateKey(monthEnd, range.endDate)
  };
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

function formatRangeLabel(
  period: DashboardTrendPeriod,
  startDate: string,
  endDate: string
): string {
  if (period === 'week') {
    return '近 7 日';
  }

  if (period === 'month') {
    return '近 30 日';
  }

  if (period === 'year') {
    return '近 12 个月';
  }

  return `${startDate} 至 ${endDate}`;
}

function resolveDashboardRange(
  asOf: string,
  period: DashboardTrendPeriod,
  rangeStart?: string,
  rangeEnd?: string
): ResolvedDashboardRange {
  const defaultEndDate = formatDateForDateInput(asOf);
  const endDate = rangeEnd ?? defaultEndDate;

  if (period === 'week') {
    const startDate = shiftLocalDateKey(endDate, -6);
    return {
      startDate,
      endDate,
      startIso: startOfLocalDateIso(startDate),
      endIso: endOfLocalDateIso(endDate),
      label: '近 7 日',
      bucket: 'day'
    };
  }

  if (period === 'month') {
    const startDate = shiftLocalDateKey(endDate, -29);
    return {
      startDate,
      endDate,
      startIso: startOfLocalDateIso(startDate),
      endIso: endOfLocalDateIso(endDate),
      label: '近 30 日',
      bucket: 'day'
    };
  }

  if (period === 'year') {
    const startDate = monthStartDateKey(shiftLocalMonthKey(monthStartDateKey(endDate), -11));
    return {
      startDate,
      endDate,
      startIso: startOfLocalDateIso(startDate),
      endIso: endOfLocalDateIso(endDate),
      label: '近 12 个月',
      bucket: 'month'
    };
  }

  const startDate = rangeStart && rangeStart <= endDate ? rangeStart : endDate;
  const rangeDays = countDaysInclusive(startDate, endDate);

  return {
    startDate,
    endDate,
    startIso: startOfLocalDateIso(startDate),
    endIso: endOfLocalDateIso(endDate),
    label: `${startDate} 至 ${endDate}`,
    bucket: rangeDays > 90 ? 'month' : 'day'
  };
}

function buildTrend(
  context: Awaited<ReturnType<typeof loadBalanceContext>>,
  range: ResolvedDashboardRange
): DashboardTrendPoint[] {
  if (range.bucket === 'month') {
    const firstMonth = monthStartDateKey(range.startDate);
    const lastMonth = monthStartDateKey(range.endDate);
    const monthCount = countMonthsInclusive(firstMonth, lastMonth);

    return Array.from({ length: monthCount }, (_, index) => {
      const pointMonth = monthStartDateKey(shiftLocalMonthKey(firstMonth, index));
      const bucket = resolveMonthlyBucket(pointMonth, range);
      const pointAsOf = endOfLocalDateIso(bucket.endDate);
      const pointSummary = summarizeBookBalancesAt(context, pointAsOf);

      return {
        label: formatMonthLabel(pointMonth),
        asOf: pointAsOf,
        value: pointSummary.netAmount
      };
    });
  }

  const dayCount = countDaysInclusive(range.startDate, range.endDate);

  return Array.from({ length: dayCount }, (_, index) => {
    const pointDate = shiftLocalDateKey(range.startDate, index);
    const pointAsOf = endOfLocalDateIso(pointDate);
    const pointSummary = summarizeBookBalancesAt(context, pointAsOf);

    return {
      label: formatDayLabel(pointDate),
      asOf: pointAsOf,
      value: pointSummary.netAmount
    };
  });
}

function summarizeCashflowWindow(
  transactions: TransactionListItem[],
  startIso: string,
  endIso: string
): Omit<DashboardCashflowWindow, 'key' | 'label'> {
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

export async function calculateDashboardSnapshot(
  db: AssetTrackerDb,
  bookId: string,
  input: DashboardSnapshotInput = {}
): Promise<DashboardSnapshot> {
  const requestedAsOf = input.asOf ?? new Date().toISOString();
  const resolvedRange = resolveDashboardRange(
    requestedAsOf,
    input.period ?? 'month',
    input.rangeStart,
    input.rangeEnd
  );
  const [context, recentTransactions] = await Promise.all([
    loadBalanceContext(db, bookId),
    listTransactionsForBook(db, bookId)
  ]);
  const currentSummary = summarizeBookBalancesAt(context, resolvedRange.endIso);
  const previousWeekSummary = summarizeBookBalancesAt(
    context,
    endOfLocalDateIso(shiftLocalDateKey(resolvedRange.endDate, -7))
  );
  const previousMonthSummary = summarizeBookBalancesAt(
    context,
    endOfLocalDateIso(shiftLocalDateKey(resolvedRange.endDate, -30))
  );
  const balances = listLeafCategoryBalancesAt(context, resolvedRange.endIso);
  const topAssets = balances
    .filter((item) => item.amount > 0)
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 5);
  const topDebts = balances
    .filter((item) => item.kind === 'debt' && item.amount < 0)
    .sort((left, right) => Math.abs(right.amount) - Math.abs(left.amount))
    .slice(0, 5);
  const baselineSummary = summarizeBookBalancesAt(
    context,
    endOfLocalDateIso(shiftLocalDateKey(resolvedRange.startDate, -1))
  );
  const recentCashflows: DashboardCashflowWindow[] = [
    {
      key: 'month',
      label: '近 30 日',
      ...summarizeCashflowWindow(
        recentTransactions,
        startOfLocalDateIso(shiftLocalDateKey(resolvedRange.endDate, -29)),
        resolvedRange.endIso
      )
    },
    {
      key: 'week',
      label: '近 7 日',
      ...summarizeCashflowWindow(
        recentTransactions,
        startOfLocalDateIso(shiftLocalDateKey(resolvedRange.endDate, -6)),
        resolvedRange.endIso
      )
    },
    {
      key: 'day',
      label: '近 1 日',
      ...summarizeCashflowWindow(
        recentTransactions,
        startOfLocalDateIso(resolvedRange.endDate),
        resolvedRange.endIso
      )
    }
  ];

  return {
    asOf: resolvedRange.endIso,
    currentSummary,
    previousWeekSummary,
    previousMonthSummary,
    selectedPeriod: input.period ?? 'month',
    selectedPeriodLabel: resolvedRange.label,
    selectedPeriodDelta: currentSummary.netAmount - baselineSummary.netAmount,
    rangeStart: resolvedRange.startDate,
    rangeEnd: resolvedRange.endDate,
    trend: buildTrend(context, resolvedRange),
    topAssets,
    topDebts,
    recentTransactions: recentTransactions
      .filter((transaction) => transaction.occurredAt <= resolvedRange.endIso)
      .slice(0, 6),
    recentCashflows,
    memo: context.book.memo
  };
}
