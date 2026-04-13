import type { Book } from '../../shared/types/entities';
import { listCategoryTree } from '../../domain/categories/listCategoryTree';
import { createTransaction } from '../../domain/transactions/createTransaction';
import { listTransactionsForBook } from '../../domain/transactions/listTransactionsForBook';
import { escapeHtml } from '../../shared/utils/escapeHtml';
import { AssetTrackerDb } from '../../storage/db';

interface TransactionPanelContext {
  db: AssetTrackerDb;
  book: Book;
  target: HTMLElement;
  onChange?: () => Promise<void>;
}

function formatMinorUnits(amount: number): string {
  return (amount / 100).toFixed(2);
}

export async function renderTransactionPanel({
  db,
  book,
  target,
  onChange
}: TransactionPanelContext): Promise<void> {
  const [categories, transactions] = await Promise.all([
    listCategoryTree(db, book.id),
    listTransactionsForBook(db, book.id)
  ]);
  const leafCategories = categories.filter((item) => item.kind !== 'group');
  const categoryById = new Map(leafCategories.map((item) => [item.id, item]));

  target.dataset.panel = 'transactions';
  target.innerHTML = `
    <section class="panel">
      <header class="panel__header">
        <h2>账单</h2>
      </header>
      <form data-role="transaction-form">
        <select name="categoryId" required>
          <option value="">选择分类</option>
          ${leafCategories
            .map(
              (item) =>
                `<option value="${item.id}">${escapeHtml('— '.repeat(item.depth) + item.name)}</option>`
            )
            .join('')}
        </select>
        <select name="direction">
          <option value="income">收入</option>
          <option value="expense">支出</option>
          <option value="adjustment">调整</option>
        </select>
        <input name="amount" type="number" step="0.01" placeholder="金额" required />
        <input name="purpose" placeholder="用途" required />
        <input name="description" placeholder="备注" />
        <input name="occurredAt" type="datetime-local" required />
        <button type="submit">记录账单</button>
      </form>
      <ul data-role="transaction-list">
        ${transactions.length === 0
          ? '<li class="panel__empty">还没有账单，录入第一笔资金变动。</li>'
          : transactions
              .map(
                (item) => `
                  <li>
                    <strong>${escapeHtml(item.categoryName)}</strong>
                    <span>${escapeHtml(item.purpose)}</span>
                    <span>${escapeHtml(item.description || '无备注')}</span>
                    <span>${formatMinorUnits(item.amount)}</span>
                  </li>
                `
              )
              .join('')}
      </ul>
    </section>
  `;

  target.querySelector<HTMLFormElement>('[data-role="transaction-form"]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    const occurredAtValue = String(formData.get('occurredAt') ?? '');
    const submitButton = form.querySelector<HTMLButtonElement>('button');
    const categoryId = String(formData.get('categoryId') ?? '');
    const category = categoryById.get(categoryId);

    if (!category) {
      throw new Error('Category does not exist');
    }

    if (submitButton) {
      submitButton.disabled = true;
    }

    try {
      await createTransaction(db, {
        bookId: book.id,
        categoryId,
        amount: Number(formData.get('amount') ?? 0),
        currency: category.currency,
        direction: String(formData.get('direction') ?? 'expense') as
          | 'income'
          | 'expense'
          | 'transfer'
          | 'adjustment',
        purpose: String(formData.get('purpose') ?? ''),
        description: String(formData.get('description') ?? ''),
        occurredAt: new Date(occurredAtValue).toISOString()
      });

      form.reset();

      if (onChange) {
        await onChange();
        return;
      }

      await renderTransactionPanel({ db, book, target, onChange });
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
      }
    }
  });
}
