import type { Book } from '../../shared/types/entities';
import {
  calculateDashboardSnapshot,
  type DashboardTrendPeriod
} from '../../domain/dashboard/calculateDashboardSnapshot';
import { updateBookMemo } from '../../domain/settings/updateBookMemo';
import { formatDateForDateInput } from '../../shared/utils/datetimeLocal';
import { escapeHtml } from '../../shared/utils/escapeHtml';
import { formatMinorUnits, formatMinorUnitsAbsolute } from '../../shared/utils/money';
import { AssetTrackerDb } from '../../storage/db';

interface SummaryPanelContext {
  db: AssetTrackerDb;
  book: Book;
  target: HTMLElement;
  now?: string;
  onChange?: () => Promise<void>;
  onStatus?: (message: string) => void;
}

interface SummaryPanelState {
  period: DashboardTrendPeriod;
  rangeStart: string;
  rangeEnd: string;
}

interface PositionedTick {
  label: string;
  position: string;
  edge: 'start' | 'middle' | 'end' | 'center';
}

interface AxisGuide {
  value: number;
  y: number;
}

function metricClassName(amount: number, kind: 'asset' | 'debt' | 'net'): string {
  if (kind === 'debt') {
    return 'negative';
  }

  if (kind === 'asset') {
    return 'summary-value--asset';
  }

  return amount >= 0 ? 'positive' : 'negative';
}

function buildAxisTicks(labels: string[], maxTicks = 6): PositionedTick[] {
  if (labels.length === 0) {
    return [];
  }

  const buildPosition = (
    index: number,
    length: number
  ): { position: string; edge: 'start' | 'middle' | 'end' | 'center' } => {
    if (length === 1) {
      return { position: 'left:50%', edge: 'center' };
    }

    if (index === 0) {
      return { position: 'left:0', edge: 'start' };
    }

    if (index === length - 1) {
      return { position: 'right:0', edge: 'end' };
    }

    return {
      position: `left:${((index / (length - 1)) * 100).toFixed(2)}%`,
      edge: 'middle'
    };
  };

  if (labels.length <= maxTicks) {
    return labels.map((label, index) => ({
      label,
      ...buildPosition(index, labels.length)
    }));
  }

  const step = Math.ceil((labels.length - 1) / (maxTicks - 1));
  const items = labels
    .map((label, index) => ({ label, index }))
    .filter(({ index }) => index === 0 || index === labels.length - 1 || index % step === 0);

  return items.map(({ label, index }) => ({
    label,
    ...buildPosition(index, labels.length)
  }));
}

function buildAxisGuides(values: number[], height = 160, tickCount = 4): AxisGuide[] {
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  if (max === min) {
    return Array.from({ length: tickCount }, (_, index) => {
      const ratio = tickCount === 1 ? 0.5 : index / (tickCount - 1);

      return {
        value: max,
        y: 16 + ratio * (height - 32)
      };
    });
  }

  const range = max - min;

  return Array.from({ length: tickCount }, (_, index) => {
    const ratio = tickCount === 1 ? 0.5 : index / (tickCount - 1);
    const value = max - range * ratio;

    return {
      value,
      y: 16 + ratio * (height - 32)
    };
  });
}

function buildTrendPath(values: number[], width = 520, height = 160): string {
  if (values.length === 0) {
    return '';
  }

  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  if (max === min) {
    const y = height / 2;

    return values
      .map((_, index) => {
        const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
        return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(' ');
  }

  const range = max - min;

  return values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
      const y = 16 + (1 - (value - min) / range) * (height - 32);

      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

function buildTrendArea(values: number[], width = 520, height = 160): string {
  if (values.length === 0) {
    return '';
  }

  const line = buildTrendPath(values, width, height);
  const lastX = values.length === 1 ? width / 2 : width;

  return `${line} L ${lastX.toFixed(2)} ${height - 16} L 0 ${height - 16} Z`;
}

function shiftDateKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function readSummaryState(target: HTMLElement, now: string): SummaryPanelState {
  const defaultEnd = formatDateForDateInput(now);

  try {
    const state = target.dataset.summaryState ? JSON.parse(target.dataset.summaryState) : {};
    const period =
      state.period === 'week' || state.period === 'year' || state.period === 'custom'
        ? state.period
        : 'month';
    const rangeEnd = typeof state.rangeEnd === 'string' ? state.rangeEnd : defaultEnd;
    const defaultStart =
      period === 'week' ? shiftDateKey(rangeEnd, -6) : period === 'year' ? shiftDateKey(rangeEnd, -364) : shiftDateKey(rangeEnd, -29);

    return {
      period,
      rangeStart: typeof state.rangeStart === 'string' ? state.rangeStart : defaultStart,
      rangeEnd
    };
  } catch {
    return {
      period: 'month',
      rangeStart: shiftDateKey(defaultEnd, -29),
      rangeEnd: defaultEnd
    };
  }
}

function persistSummaryState(target: HTMLElement, state: SummaryPanelState): void {
  target.dataset.summaryState = JSON.stringify(state);
}

function presetRange(period: Exclude<DashboardTrendPeriod, 'custom'>, endDate: string): SummaryPanelState {
  if (period === 'week') {
    return {
      period,
      rangeStart: shiftDateKey(endDate, -6),
      rangeEnd: endDate
    };
  }

  if (period === 'year') {
    return {
      period,
      rangeStart: shiftDateKey(endDate, -364),
      rangeEnd: endDate
    };
  }

  return {
    period,
    rangeStart: shiftDateKey(endDate, -29),
    rangeEnd: endDate
  };
}

export async function renderSummaryPanel({
  db,
  book,
  target,
  now,
  onChange,
  onStatus
}: SummaryPanelContext): Promise<void> {
  const nowIso = now ?? new Date().toISOString();
  const state = readSummaryState(target, nowIso);
  const snapshot = await calculateDashboardSnapshot(db, book.id, {
    asOf: nowIso,
    period: state.period,
    rangeStart: state.rangeStart,
    rangeEnd: state.rangeEnd
  });
  const weekDelta = snapshot.currentSummary.netAmount - snapshot.previousWeekSummary.netAmount;
  const monthDelta = snapshot.currentSummary.netAmount - snapshot.previousMonthSummary.netAmount;
  const trendValues = snapshot.trend.map((item) => item.value);
  const axisTicks = buildAxisTicks(snapshot.trend.map((item) => item.label));
  const axisGuides = buildAxisGuides(trendValues);

  persistSummaryState(target, {
    period: snapshot.selectedPeriod,
    rangeStart: snapshot.rangeStart,
    rangeEnd: snapshot.rangeEnd
  });
  target.dataset.panel = 'summary';
  target.innerHTML = `
    <section class="card asset-summary">
      <div class="card-header">
        <h3>资产总览</h3>
        <span class="tag">基准币种 ${book.baseCurrency}</span>
      </div>
      <div class="summary-grid">
        <article class="summary-item" data-summary-kind="net">
          <span class="label">净资产</span>
          <strong class="value ${metricClassName(snapshot.currentSummary.netAmount, 'net')}">${formatMinorUnits(snapshot.currentSummary.netAmount)}</strong>
        </article>
        <article class="summary-item" data-summary-kind="asset">
          <span class="label">资产</span>
          <strong class="value ${metricClassName(snapshot.currentSummary.assetAmount, 'asset')}">${formatMinorUnits(snapshot.currentSummary.assetAmount)}</strong>
        </article>
        <article class="summary-item" data-summary-kind="debt">
          <span class="label">负债</span>
          <strong class="value ${metricClassName(snapshot.currentSummary.debtAmount, 'debt')}">${formatMinorUnitsAbsolute(snapshot.currentSummary.debtAmount)}</strong>
        </article>
        <article class="summary-item" data-summary-kind="transactions">
          <span class="label">账单数</span>
          <strong class="value">${snapshot.currentSummary.transactionCount}</strong>
        </article>
      </div>
      ${
        snapshot.currentSummary.unresolvedCurrencies.length > 0
          ? `<p class="panel__empty">以下币种缺少汇率，暂未折算进总览：${snapshot.currentSummary.unresolvedCurrencies.join(', ')}</p>`
          : ''
      }
      <div class="asset-summary-currency" data-role="currency-summary">
        ${snapshot.currentSummary.currencyBreakdown
          .map(
            (item) => `
              <article class="currency-item">
                <div class="currency-name">${item.currency}</div>
                <div class="currency-amount">原币净额 ${formatMinorUnits(item.netAmount)}</div>
                <div class="currency-equivalent">
                  ${
                    item.convertedNetAmount === null
                      ? '缺少汇率'
                      : `折算 ${book.baseCurrency} ${formatMinorUnits(item.convertedNetAmount)}`
                  }
                </div>
              </article>
            `
          )
          .join('')}
      </div>
    </section>
    <div class="section-grid dashboard-detail-grid">
      <section class="card dashboard-span-5">
        <div class="card-header">
          <h3>总资产变化</h3>
          <span class="tag" data-role="dashboard-range-label">${escapeHtml(snapshot.selectedPeriodLabel)}</span>
        </div>
        <div class="summary-grid compact-summary-grid">
          <article class="summary-item">
            <span class="label">${snapshot.selectedPeriodLabel}变动</span>
            <strong class="value ${metricClassName(snapshot.selectedPeriodDelta, 'net')}">${formatMinorUnits(snapshot.selectedPeriodDelta)}</strong>
          </article>
          <article class="summary-item">
            <span class="label">近 7 日变动</span>
            <strong class="value ${metricClassName(weekDelta, 'net')}">${formatMinorUnits(weekDelta)}</strong>
          </article>
          <article class="summary-item">
            <span class="label">近 30 日变动</span>
            <strong class="value ${metricClassName(monthDelta, 'net')}">${formatMinorUnits(monthDelta)}</strong>
          </article>
          <article class="summary-item">
            <span class="label">资产 / 负债比</span>
            <strong class="value">${snapshot.currentSummary.debtAmount === 0 ? '∞' : (snapshot.currentSummary.assetAmount / snapshot.currentSummary.debtAmount).toFixed(2)}</strong>
          </article>
        </div>
        <div class="dashboard-flow-table">
          <div class="dashboard-flow-table-header">
            <span>时间</span>
            <span>收入</span>
            <span>支出</span>
            <span>净收入</span>
          </div>
          ${snapshot.recentCashflows
            .map(
              (item) => `
                <div class="dashboard-flow-row" data-window="${item.key}">
                  <span>${item.label}</span>
                  <strong data-flow-kind="income" class="positive">${formatMinorUnits(item.income)}</strong>
                  <strong data-flow-kind="expense" class="negative">${formatMinorUnits(item.expense)}</strong>
                  <strong data-flow-kind="net" class="${item.net >= 0 ? 'positive' : 'negative'}">${formatMinorUnits(item.net)}</strong>
                </div>
              `
            )
            .join('')}
        </div>
      </section>
      <section class="card dashboard-span-7">
        <div class="card-header">
          <h3>图表概况</h3>
          <span class="tag">金额轴 + 网格</span>
        </div>
        <form data-role="dashboard-range-form" class="dashboard-range-form">
          <div class="dashboard-range-controls">
            <select data-role="dashboard-period" name="period" class="dashboard-period-select">
              <option value="week" ${snapshot.selectedPeriod === 'week' ? 'selected' : ''}>周</option>
              <option value="month" ${snapshot.selectedPeriod === 'month' ? 'selected' : ''}>月</option>
              <option value="year" ${snapshot.selectedPeriod === 'year' ? 'selected' : ''}>年</option>
              <option value="custom" ${snapshot.selectedPeriod === 'custom' ? 'selected' : ''}>自定义</option>
            </select>
            <input data-role="dashboard-range-start" name="rangeStart" type="date" value="${snapshot.rangeStart}" />
            <input data-role="dashboard-range-end" name="rangeEnd" type="date" value="${snapshot.rangeEnd}" />
            <button type="submit" class="btn btn-secondary btn-sm">应用区间</button>
          </div>
        </form>
        <div class="dashboard-overview-chart dashboard-overview-chart--framed">
          <div class="dashboard-y-axis">
            ${axisGuides
              .map(
                (guide) =>
                  `<span data-role="dashboard-y-axis-label">${formatMinorUnits(Math.round(guide.value))}</span>`
              )
              .join('')}
          </div>
          <div class="dashboard-chart-canvas">
            <svg viewBox="0 0 520 160" preserveAspectRatio="none" role="img" aria-label="概览趋势图">
              ${axisGuides
                .map(
                  (guide) =>
                    `<line data-role="dashboard-grid-line" class="chart-grid-line" x1="0" x2="520" y1="${guide.y.toFixed(2)}" y2="${guide.y.toFixed(2)}"></line>`
                )
                .join('')}
              <path class="trend-area" d="${buildTrendArea(trendValues)}"></path>
              <path class="trend-line" d="${buildTrendPath(trendValues)}"></path>
            </svg>
            <div class="trend-axis trend-axis--positioned dashboard-axis dashboard-axis--positioned">
              ${axisTicks
                .map(
                  (item) =>
                    `<span data-edge="${item.edge}" style="${item.position}">${escapeHtml(item.label)}</span>`
                )
                .join('')}
            </div>
          </div>
        </div>
        <div class="dashboard-lists">
          <div>
            <strong>主要资产</strong>
            <div class="dashboard-chip-list">
              ${
                snapshot.topAssets.length === 0
                  ? '<span class="panel__empty">暂无</span>'
                  : snapshot.topAssets
                      .map((item) => `<span class="dashboard-chip summary-chip--asset">${escapeHtml(item.name)} · ${formatMinorUnits(item.amount)}</span>`)
                      .join('')
              }
            </div>
          </div>
          <div>
            <strong>主要负债</strong>
            <div class="dashboard-chip-list">
              ${
                snapshot.topDebts.length === 0
                  ? '<span class="panel__empty">暂无</span>'
                  : snapshot.topDebts
                      .map((item) => `<span class="dashboard-chip negative">${escapeHtml(item.name)} · ${formatMinorUnitsAbsolute(item.amount)}</span>`)
                      .join('')
              }
            </div>
          </div>
        </div>
      </section>
      <section class="card dashboard-span-7">
        <div class="card-header">
          <h3>最近账单</h3>
          <span class="tag">快速查看</span>
        </div>
        <div class="dashboard-transaction-list">
          ${
            snapshot.recentTransactions.length === 0
              ? '<p class="panel__empty">还没有账单，录入后会在这里快速显示。</p>'
              : snapshot.recentTransactions
                  .map(
                    (item) => `
                      <article class="dashboard-transaction-item">
                        <div>
                          <strong>${escapeHtml(item.purpose)}</strong>
                          <div class="dashboard-transaction-meta">${escapeHtml(item.categoryName)} · ${escapeHtml(item.occurredAt.slice(0, 16).replace('T', ' '))}</div>
                        </div>
                        <strong class="${item.amount >= 0 ? 'positive' : 'negative'}">${formatMinorUnits(item.amount)}</strong>
                      </article>
                    `
                  )
                  .join('')
          }
        </div>
      </section>
      <section class="card dashboard-span-5">
        <div class="card-header">
          <h3>概览备忘录</h3>
          <span class="tag">本地保存</span>
        </div>
        <form data-role="summary-memo-form" class="stack-form summary-memo-form">
          <textarea name="memo" rows="8" placeholder="记录提醒、对账备注、下一步计划...">${escapeHtml(snapshot.memo)}</textarea>
          <div class="action-row">
            <button type="submit" class="btn btn-primary">保存备忘录</button>
          </div>
        </form>
      </section>
    </div>
  `;

  target.querySelector<HTMLFormElement>('[data-role="summary-memo-form"]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const memo = (form.elements.namedItem('memo') as HTMLTextAreaElement).value;

    try {
      await updateBookMemo(db, {
        bookId: book.id,
        memo
      });
      onStatus?.('概览备忘录已保存');
      await onChange?.();
    } catch (error) {
      onStatus?.(error instanceof Error ? error.message : '保存备忘录失败');
    }
  });

  target.querySelector<HTMLSelectElement>('[data-role="dashboard-period"]')?.addEventListener('change', async (event) => {
    const nextPeriod = (event.currentTarget as HTMLSelectElement).value as DashboardTrendPeriod;
    const currentState = readSummaryState(target, nowIso);
    const nextState =
      nextPeriod === 'custom'
        ? {
            ...currentState,
            period: 'custom' as const
          }
        : presetRange(nextPeriod, currentState.rangeEnd);

    persistSummaryState(target, nextState);
    const rangeForm = (event.currentTarget as HTMLSelectElement).form;
    const rangeStartInput = rangeForm?.elements.namedItem('rangeStart') as HTMLInputElement | null;
    const rangeEndInput = rangeForm?.elements.namedItem('rangeEnd') as HTMLInputElement | null;

    if (rangeStartInput) {
      rangeStartInput.value = nextState.rangeStart;
    }

    if (rangeEndInput) {
      rangeEndInput.value = nextState.rangeEnd;
    }

    await renderSummaryPanel({ db, book, target, now: nowIso, onChange, onStatus });
  });

  target.querySelector<HTMLFormElement>('[data-role="dashboard-range-form"]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const rangeStart = (form.elements.namedItem('rangeStart') as HTMLInputElement).value;
    const rangeEnd = (form.elements.namedItem('rangeEnd') as HTMLInputElement).value;

    persistSummaryState(target, {
      period: 'custom',
      rangeStart: rangeStart || snapshot.rangeStart,
      rangeEnd: rangeEnd || snapshot.rangeEnd
    });
    await renderSummaryPanel({ db, book, target, now: nowIso, onChange, onStatus });
  });
}
