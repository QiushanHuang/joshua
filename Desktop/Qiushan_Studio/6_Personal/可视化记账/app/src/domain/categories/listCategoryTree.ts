import type { CurrencyCode } from '../../shared/types/entities';
import { AssetTrackerDb } from '../../storage/db';
import { CategoryRepository } from '../../storage/repositories/categoryRepository';

export interface CategoryTreeItem {
  id: string;
  name: string;
  parentId: string | null;
  depth: number;
  kind: 'asset' | 'debt' | 'group';
  currency: CurrencyCode;
  aggregateAmount: number;
  sortOrder: number;
}

export async function listCategoryTree(
  db: AssetTrackerDb,
  bookId: string
): Promise<CategoryTreeItem[]> {
  const repository = new CategoryRepository(db);
  const categories = (await repository.listByBook(bookId))
    .filter((item) => item.deletedAt === null)
    .sort((left, right) => {
      if (left.parentId === right.parentId) {
        return left.sortOrder - right.sortOrder || left.createdAt.localeCompare(right.createdAt);
      }

      return (left.parentId ?? '').localeCompare(right.parentId ?? '');
    });

  const childrenByParent = new Map<string | null, typeof categories>();

  for (const category of categories) {
    const siblings = childrenByParent.get(category.parentId) ?? [];
    siblings.push(category);
    childrenByParent.set(category.parentId, siblings);
  }

  const items: CategoryTreeItem[] = [];

  const walk = (parentId: string | null, depth: number): void => {
    const siblings = childrenByParent.get(parentId) ?? [];

    siblings
      .sort((left, right) => left.sortOrder - right.sortOrder || left.createdAt.localeCompare(right.createdAt))
      .forEach((category) => {
        items.push({
          id: category.id,
          name: category.name,
          parentId: category.parentId,
          depth,
          kind: category.kind,
          currency: category.currency,
          aggregateAmount: 0,
          sortOrder: category.sortOrder
        });

        walk(category.id, depth + 1);
      });
  };

  walk(null, 0);

  return items;
}
