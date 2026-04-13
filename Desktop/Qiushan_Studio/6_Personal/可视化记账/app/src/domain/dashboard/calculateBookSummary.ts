import { AssetTrackerDb } from '../../storage/db';
import { CategoryRepository } from '../../storage/repositories/categoryRepository';
import { TransactionRepository } from '../../storage/repositories/transactionRepository';

export interface BookSummary {
  netAmount: number;
  assetAmount: number;
  debtAmount: number;
  transactionCount: number;
  unsupportedCurrencies: string[];
}

export async function calculateBookSummary(
  db: AssetTrackerDb,
  bookId: string
): Promise<BookSummary> {
  const book = await db.books.get(bookId);

  if (!book) {
    throw new Error('Book does not exist');
  }

  const categoryRepository = new CategoryRepository(db);
  const transactionRepository = new TransactionRepository(db);
  const [categories, transactions] = await Promise.all([
    categoryRepository.listByBook(bookId),
    transactionRepository.listByBook(bookId)
  ]);

  const categoryById = new Map(
    categories.filter((category) => category.deletedAt === null).map((category) => [category.id, category])
  );
  const totalsByCategory = new Map<string, number>();

  for (const transaction of transactions.filter((item) => item.deletedAt === null)) {
    const currentTotal = totalsByCategory.get(transaction.categoryId) ?? 0;
    totalsByCategory.set(transaction.categoryId, currentTotal + transaction.amount);
  }

  let assetAmount = 0;
  let debtAmount = 0;
  const unsupportedCurrencies = new Set<string>();

  for (const [categoryId, total] of totalsByCategory.entries()) {
    const category = categoryById.get(categoryId);

    if (!category) {
      continue;
    }

    if (category.currency !== book.baseCurrency) {
      unsupportedCurrencies.add(category.currency);
      continue;
    }

    if (category.kind === 'debt') {
      if (total < 0) {
        debtAmount += Math.abs(total);
      } else {
        assetAmount += total;
      }

      continue;
    }

    assetAmount += total;
  }

  return {
    netAmount: assetAmount - debtAmount,
    assetAmount,
    debtAmount,
    transactionCount: transactions.filter((item) => item.deletedAt === null).length,
    unsupportedCurrencies: [...unsupportedCurrencies].sort()
  };
}
