import { listAssetStateAnchorsForBook } from '../assetStates/listAssetStateAnchorsForBook';
import {
  buildCategoryTreeSnapshot,
  listLeafCategoryBalancesAt,
  loadBalanceContext,
  summarizeBookBalancesAt,
  type BalanceContext,
  type LeafCategoryBalance
} from '../balances/balanceEngine';
import {
  buildAssetComposition,
  buildCashflowSeries,
  buildFlowComposition,
  buildPurposeComposition,
  resolveAnalyticsRange,
  resolveCompositionRange,
  type AnalyticsCompositionEntry,
  type AnalyticsCompositionKind,
  type AnalyticsCompositionMode,
  type AnalyticsCompositionPreset,
  type AnalyticsRangePreset,
  type CashflowSeriesPoint,
  type ResolvedAnalyticsRange
} from './analyticsRanges';
import type { CurrencyCode } from '../../shared/types/entities';
import { listAutomationOccurrences } from '../automation/schedule';
import { AssetTrackerDb } from '../../storage/db';
import { AutomationRuleRepository } from '../../storage/repositories/automationRuleRepository';
import { resolveExchangeRateAt } from '../settings/exchangeRateTimeline';
import { formatDateForDateInput, shiftLocalDateKey } from '../../shared/utils/datetimeLocal';

export interface AnalyticsSnapshotInput {
  bookId: string;
  asOf: string;
  compareAt: string;
  metric: 'net' | 'asset' | 'debt';
  analysisPreset: AnalyticsRangePreset;
  analysisStart?: string;
  analysisEnd?: string;
  compositionMode?: AnalyticsCompositionMode;
  compositionPreset?: AnalyticsCompositionPreset;
  compositionStart?: string;
  compositionEnd?: string;
  piePreset?: AnalyticsCompositionPreset;
  pieStart?: string;
  pieEnd?: string;
  forecastDays?: number;
}

export interface AnalyticsCurrencyComparisonItem {
  currency: string;
  currentNetAmount: number;
  compareNetAmount: number;
  currentConvertedNetAmount: number | null;
  compareConvertedNetAmount: number | null;
}

export interface AnalyticsCategoryCompositionItem {
  categoryId: string;
  name: string;
  currency: string;
  kind: AnalyticsCompositionKind;
  amount: number;
}

export interface AnalyticsForecastPoint {
  label: string;
  asOf: string;
  value: number;
}

export interface AnalyticsCashflowProjectionItem {
  label: string;
  amount: number;
  frequency: string;
}

export interface AnalyticsRadarMetric {
  label: string;
  value: number;
  note: string;
}

export interface AnalyticsPieComposition {
  mode: AnalyticsCompositionMode;
  label: string;
  total: number;
  items: AnalyticsCategoryCompositionItem[];
}

export interface AnalyticsSnapshot {
  asOf: string;
  compareAt: string;
  metric: 'net' | 'asset' | 'debt';
  currentSummary: ReturnType<typeof summarizeBookBalancesAt>;
  compareSummary: ReturnType<typeof summarizeBookBalancesAt>;
  analysisRange: ResolvedAnalyticsRange;
  analysisSeries: CashflowSeriesPoint[];
  forecast: AnalyticsForecastPoint[];
  categoryCompositionMode: AnalyticsCompositionMode;
  categoryCompositionRange: ResolvedAnalyticsRange;
  categoryComposition: AnalyticsCategoryCompositionItem[];
  pieRange: ResolvedAnalyticsRange;
  pieCompositions: AnalyticsPieComposition[];
  currencyComparison: AnalyticsCurrencyComparisonItem[];
  latestAnchor: Awaited<ReturnType<typeof listAssetStateAnchorsForBook>>[number] | null;
  categoryTree: ReturnType<typeof buildCategoryTreeSnapshot>;
  cashflowProjection: AnalyticsCashflowProjectionItem[];
  radarMetrics: AnalyticsRadarMetric[];
}

function addDaysToDate(date: string, days: number): string {
  return shiftLocalDateKey(date, days);
}

function formatTrendLabel(isoString: string): string {
  const dateKey = formatDateForDateInput(isoString);
  const month = dateKey.slice(5, 7);
  const day = dateKey.slice(8, 10);

  return `${month}-${day}`;
}

function summarizeLeafBalances(
  context: BalanceContext,
  balances: LeafCategoryBalance[],
  asOf: string
): ReturnType<typeof summarizeBookBalancesAt> {
  const rawBreakdown = new Map<CurrencyCode, { assetAmount: number; debtAmount: number }>();

  for (const balance of balances) {
    if (balance.amount === 0) {
      continue;
    }

    const totals = rawBreakdown.get(balance.currency) ?? { assetAmount: 0, debtAmount: 0 };

    if (balance.kind === 'debt') {
      if (balance.amount < 0) {
        totals.debtAmount += Math.abs(balance.amount);
      } else {
        totals.assetAmount += balance.amount;
      }
    } else {
      totals.assetAmount += balance.amount;
    }

    rawBreakdown.set(balance.currency, totals);
  }

  let assetAmount = 0;
  let debtAmount = 0;
  const unresolvedCurrencies: string[] = [];
  const currencyBreakdown: Array<{
    currency: CurrencyCode;
    assetAmount: number;
    debtAmount: number;
    netAmount: number;
    convertedNetAmount: number | null;
  }> = [];

  rawBreakdown.forEach((totals, currency) => {
    const netAmount = totals.assetAmount - totals.debtAmount;
    const rate =
      currency === context.book.baseCurrency
        ? 1
        : resolveExchangeRateAt(context.exchangeRates, context.book.baseCurrency, currency, asOf)?.rate;
    const convertedNetAmount = rate ? Math.round(netAmount * rate) : null;

    if (rate) {
      assetAmount += Math.round(totals.assetAmount * rate);
      debtAmount += Math.round(totals.debtAmount * rate);
    } else {
      unresolvedCurrencies.push(currency);
    }

    currencyBreakdown.push({
      currency,
      assetAmount: totals.assetAmount,
      debtAmount: totals.debtAmount,
      netAmount,
      convertedNetAmount
    });
  });

  return {
    netAmount: assetAmount - debtAmount,
    assetAmount,
    debtAmount,
    transactionCount: context.transactions.length,
    unresolvedCurrencies: unresolvedCurrencies.sort(),
    currencyBreakdown: currencyBreakdown.sort((left, right) => left.currency.localeCompare(right.currency))
  };
}

function metricValue(
  summary: ReturnType<typeof summarizeBookBalancesAt>,
  metric: 'net' | 'asset' | 'debt'
): number {
  if (metric === 'asset') {
    return summary.assetAmount;
  }

  if (metric === 'debt') {
    return summary.debtAmount;
  }

  return summary.netAmount;
}

function toCompositionItems(items: AnalyticsCompositionEntry[]): AnalyticsCategoryCompositionItem[] {
  return items.map((item) => ({
    categoryId: item.categoryId,
    name: item.name,
    currency: item.currency,
    amount: item.amount,
    kind: item.kind
  }));
}

function buildPieComposition(
  mode: AnalyticsCompositionMode,
  label: string,
  items: AnalyticsCompositionEntry[]
): AnalyticsPieComposition {
  const normalizedItems = toCompositionItems(items);

  return {
    mode,
    label,
    total: normalizedItems.reduce((sum, item) => sum + Math.abs(item.amount), 0),
    items: normalizedItems
  };
}

export async function calculateAnalyticsSnapshot(
  db: AssetTrackerDb,
  input: AnalyticsSnapshotInput
): Promise<AnalyticsSnapshot> {
  const context = await loadBalanceContext(db, input.bookId);
  const [anchorTimelineRaw, rawRules] = await Promise.all([
    listAssetStateAnchorsForBook(db, input.bookId),
    new AutomationRuleRepository(db).listByBook(input.bookId)
  ]);
  const anchorTimeline = [...anchorTimelineRaw].sort((left, right) =>
    right.anchoredAt.localeCompare(left.anchoredAt)
  );
  const currentSummary = summarizeBookBalancesAt(context, input.asOf);
  const compareSummary = summarizeBookBalancesAt(context, input.compareAt);
  const analysisRange = resolveAnalyticsRange(
    input.asOf,
    input.analysisPreset,
    input.analysisStart,
    input.analysisEnd
  );
  const analysisSeries = buildCashflowSeries(context.transactions, analysisRange);
  const assetComposition = buildAssetComposition(
    context,
    listLeafCategoryBalancesAt(context, input.asOf),
    input.asOf
  );
  const categoryCompositionMode = input.compositionMode ?? 'asset';
  const categoryCompositionRange = resolveCompositionRange(
    input.asOf,
    input.compositionPreset ?? 'month',
    input.compositionStart,
    input.compositionEnd
  );
  const categoryComposition =
    categoryCompositionMode === 'asset'
      ? toCompositionItems(assetComposition)
      : toCompositionItems(buildFlowComposition(context, categoryCompositionRange, categoryCompositionMode));
  const pieRange = resolveCompositionRange(
    input.asOf,
    input.piePreset ?? 'month',
    input.pieStart,
    input.pieEnd
  );
  const pieCompositions: AnalyticsPieComposition[] = [
    buildPieComposition('asset', `截至 ${formatDateForDateInput(input.asOf)}`, assetComposition),
    buildPieComposition('income', pieRange.label, buildPurposeComposition(context, pieRange, 'income')),
    buildPieComposition('expense', pieRange.label, buildPurposeComposition(context, pieRange, 'expense'))
  ];
  const currentBreakdownByCurrency = new Map(
    currentSummary.currencyBreakdown.map((item) => [item.currency, item])
  );
  const compareBreakdownByCurrency = new Map(
    compareSummary.currencyBreakdown.map((item) => [item.currency, item])
  );
  const currencies = [
    ...new Set([...currentBreakdownByCurrency.keys(), ...compareBreakdownByCurrency.keys()])
  ].sort() as CurrencyCode[];
  const categoryTree = buildCategoryTreeSnapshot(context, input.asOf);

  const forecastDays = Math.max(7, input.forecastDays ?? 30);
  const forecastStartDate = formatDateForDateInput(input.asOf);
  const forecastEndDate = addDaysToDate(forecastStartDate, forecastDays);
  const activeRules = rawRules.filter((rule) => rule.deletedAt === null && rule.isActive);
  const forecastBalanceMap = new Map(
    listLeafCategoryBalancesAt(context, input.asOf).map((item) => [item.categoryId, { ...item }])
  );
  const cashflowByDate = new Map<string, Array<{ categoryId: string; amount: number }>>();
  const cashflowByLabel = new Map<string, { amount: number; frequency: string }>();

  activeRules.forEach((rule) => {
    listAutomationOccurrences(rule, forecastEndDate, forecastStartDate)
      .filter((occurrence) => occurrence.occurredAt > input.asOf)
      .forEach((occurrence) => {
        const items = cashflowByDate.get(occurrence.date) ?? [];
        items.push({
          categoryId: rule.categoryId,
          amount: rule.amount
        });
        cashflowByDate.set(occurrence.date, items);
      });

    const projection = cashflowByLabel.get(rule.purpose) ?? {
      amount: 0,
      frequency: rule.frequency
    };
    projection.amount += rule.amount;
    cashflowByLabel.set(rule.purpose, projection);
  });

  const forecast: AnalyticsForecastPoint[] = [
    {
      label: formatTrendLabel(input.asOf),
      asOf: input.asOf,
      value: metricValue(currentSummary, input.metric)
    }
  ];

  Array.from({ length: forecastDays }, (_, index) => addDaysToDate(forecastStartDate, index + 1)).forEach(
    (date) => {
      (cashflowByDate.get(date) ?? []).forEach((delta) => {
        const existing = forecastBalanceMap.get(delta.categoryId);

        if (!existing) {
          return;
        }

        forecastBalanceMap.set(delta.categoryId, {
          ...existing,
          amount: existing.amount + delta.amount
        });
      });

      const projectedSummary = summarizeLeafBalances(
        context,
        [...forecastBalanceMap.values()],
        `${date}T00:00:00.000Z`
      );
      forecast.push({
        label: formatTrendLabel(`${date}T00:00:00.000Z`),
        asOf: `${date}T00:00:00.000Z`,
        value: metricValue(projectedSummary, input.metric)
      });
    }
  );

  const leafCount = listLeafCategoryBalancesAt(context, input.asOf).length || 1;
  const radarMetrics: AnalyticsRadarMetric[] = [
    {
      label: '现金流活跃度',
      value: Math.min(100, analysisSeries.filter((item) => item.income > 0 || item.expense > 0).length * 12),
      note: analysisRange.label
    },
    {
      label: '资产集中度',
      value: assetComposition[0] ? Math.min(100, Math.round((Math.abs(assetComposition[0].amount) / Math.max(currentSummary.assetAmount, 1)) * 100)) : 0,
      note: assetComposition[0]?.name ?? '暂无资产'
    },
    {
      label: '币种覆盖',
      value: Math.min(100, Math.round((currencies.length / 4) * 100)),
      note: `${currencies.length} 个币种`
    },
    {
      label: '盘点覆盖',
      value: Math.min(100, Math.round((anchorTimeline.length / leafCount) * 100)),
      note: `${anchorTimeline.length} 个锚点`
    },
    {
      label: '自动化密度',
      value: Math.min(100, activeRules.length * 18),
      note: `${activeRules.length} 条规则`
    }
  ];

  return {
    asOf: input.asOf,
    compareAt: input.compareAt,
    metric: input.metric,
    currentSummary,
    compareSummary,
    analysisRange,
    analysisSeries,
    forecast,
    categoryCompositionMode,
    categoryCompositionRange,
    categoryComposition,
    pieRange,
    pieCompositions,
    currencyComparison: currencies.map((currency) => {
      const current = currentBreakdownByCurrency.get(currency);
      const compare = compareBreakdownByCurrency.get(currency);

      return {
        currency,
        currentNetAmount: current?.netAmount ?? 0,
        compareNetAmount: compare?.netAmount ?? 0,
        currentConvertedNetAmount: current ? current.convertedNetAmount : 0,
        compareConvertedNetAmount: compare ? compare.convertedNetAmount : 0
      };
    }),
    latestAnchor: anchorTimeline[0] ?? null,
    categoryTree,
    cashflowProjection: [...cashflowByLabel.entries()].map(([label, projection]) => ({
      label,
      amount: projection.amount,
      frequency: projection.frequency
    })),
    radarMetrics
  };
}
