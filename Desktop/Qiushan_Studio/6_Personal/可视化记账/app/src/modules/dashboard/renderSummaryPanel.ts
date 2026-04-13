import type { Book } from '../../shared/types/entities';
import { calculateBookSummary } from '../../domain/dashboard/calculateBookSummary';
import { AssetTrackerDb } from '../../storage/db';

interface SummaryPanelContext {
  db: AssetTrackerDb;
  book: Book;
  target: HTMLElement;
}

function formatMinorUnits(amount: number): string {
  return (amount / 100).toFixed(2);
}

export async function renderSummaryPanel({ db, book, target }: SummaryPanelContext): Promise<void> {
  const summary = await calculateBookSummary(db, book.id);

  target.dataset.panel = 'summary';
  target.innerHTML = `
    <section class="panel">
      <header class="panel__header">
        <h2>总览</h2>
      </header>
      <div class="metric-grid">
        <article class="metric-card">
          <span>净资产</span>
          <strong>${formatMinorUnits(summary.netAmount)}</strong>
        </article>
        <article class="metric-card">
          <span>资产</span>
          <strong>${formatMinorUnits(summary.assetAmount)}</strong>
        </article>
        <article class="metric-card">
          <span>负债</span>
          <strong>${formatMinorUnits(summary.debtAmount)}</strong>
        </article>
        <article class="metric-card">
          <span>账单数</span>
          <strong>${summary.transactionCount}</strong>
        </article>
      </div>
      ${summary.unsupportedCurrencies.length > 0
        ? `<p class="panel__empty">当前总览仅统计 ${book.baseCurrency} 账户，已跳过：${summary.unsupportedCurrencies.join(', ')}</p>`
        : ''}
    </section>
  `;
}
