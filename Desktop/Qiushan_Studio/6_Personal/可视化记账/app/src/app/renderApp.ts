import type { Book } from '../shared/types/entities';
import { AssetTrackerDb } from '../storage/db';
import { renderCategoryPanel } from '../modules/categories/renderCategoryPanel';
import { renderSummaryPanel } from '../modules/dashboard/renderSummaryPanel';
import { renderTransactionPanel } from '../modules/transactions/renderTransactionPanel';

export interface AppRenderContext {
  db: AssetTrackerDb;
  book: Book;
  target: HTMLElement;
}

export async function renderApp({ db, book, target }: AppRenderContext): Promise<void> {
  target.innerHTML = `
    <section class="workspace-grid">
      <div data-panel="summary"></div>
      <div data-panel="categories"></div>
      <div data-panel="transactions"></div>
    </section>
  `;

  const summaryTarget = target.querySelector<HTMLElement>('[data-panel="summary"]');
  const categoryTarget = target.querySelector<HTMLElement>('[data-panel="categories"]');
  const transactionTarget = target.querySelector<HTMLElement>('[data-panel="transactions"]');

  if (!summaryTarget || !categoryTarget || !transactionTarget) {
    throw new Error('Missing workspace panel target');
  }

  let refreshQueue = Promise.resolve();

  const runRefresh = async (): Promise<void> => {
    await Promise.all([
      renderSummaryPanel({
        db,
        book,
        target: summaryTarget
      }),
      renderCategoryPanel({
        db,
        book,
        target: categoryTarget,
        onChange: refresh
      }),
      renderTransactionPanel({
        db,
        book,
        target: transactionTarget,
        onChange: refresh
      })
    ]);
  };

  const refresh = (): Promise<void> => {
    const nextRefresh = refreshQueue.then(runRefresh);
    refreshQueue = nextRefresh.catch(() => undefined);
    return nextRefresh;
  };

  await refresh();
}
