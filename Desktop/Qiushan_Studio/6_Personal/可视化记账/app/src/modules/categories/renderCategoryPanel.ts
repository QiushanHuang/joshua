import type { Book } from '../../shared/types/entities';
import { createCategory } from '../../domain/categories/createCategory';
import { listCategoryTree } from '../../domain/categories/listCategoryTree';
import { escapeHtml } from '../../shared/utils/escapeHtml';
import { AssetTrackerDb } from '../../storage/db';

interface CategoryPanelContext {
  db: AssetTrackerDb;
  book: Book;
  target: HTMLElement;
  onChange?: () => Promise<void>;
}

export async function renderCategoryPanel({
  db,
  book,
  target,
  onChange
}: CategoryPanelContext): Promise<void> {
  const categories = await listCategoryTree(db, book.id);

  target.dataset.panel = 'categories';
  target.innerHTML = `
    <section class="panel">
      <header class="panel__header">
        <h2>分类</h2>
      </header>
      <form data-role="category-form">
        <input name="name" placeholder="新分类名称" required />
        <select name="parentId">
          <option value="">顶层分类</option>
          ${categories
            .map(
              (item) =>
                `<option value="${item.id}">${escapeHtml('— '.repeat(item.depth) + item.name)}</option>`
            )
            .join('')}
        </select>
        <select name="kind">
          <option value="asset">资产</option>
          <option value="debt">负债</option>
          <option value="group">分组</option>
        </select>
        <select name="currency">
          <option value="CNY">CNY</option>
          <option value="SGD">SGD</option>
          <option value="USD">USD</option>
          <option value="MYR">MYR</option>
        </select>
        <button type="submit">添加分类</button>
      </form>
      <ul data-role="category-list">
        ${categories.length === 0
          ? '<li class="panel__empty">还没有分类，先创建一个资产账户。</li>'
          : categories
              .map(
                (item) => `
                  <li data-depth="${item.depth}">
                    ${escapeHtml('— '.repeat(item.depth) + item.name)}
                  </li>
                `
              )
              .join('')}
      </ul>
    </section>
  `;

  target.querySelector<HTMLFormElement>('[data-role="category-form"]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    const submitButton = form.querySelector<HTMLButtonElement>('button');

    if (submitButton) {
      submitButton.disabled = true;
    }

    try {
      await createCategory(db, {
        bookId: book.id,
        name: String(formData.get('name') ?? ''),
        parentId: String(formData.get('parentId') ?? '') || null,
        kind: String(formData.get('kind') ?? 'asset') as 'asset' | 'debt' | 'group',
        currency: String(formData.get('currency') ?? 'CNY') as 'CNY' | 'SGD' | 'USD' | 'MYR'
      });

      form.reset();

      if (onChange) {
        await onChange();
        return;
      }

      await renderCategoryPanel({ db, book, target, onChange });
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
      }
    }
  });
}
