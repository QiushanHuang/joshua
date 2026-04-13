import { AssetTrackerDb } from '../../storage/db';
import { CategoryRepository } from '../../storage/repositories/categoryRepository';
import { TransactionRepository } from '../../storage/repositories/transactionRepository';

export interface TransactionListItem {
  id: string;
  categoryId: string;
  categoryName: string;
  amount: number;
  currency: 'CNY' | 'SGD' | 'USD' | 'MYR';
  direction: 'income' | 'expense' | 'transfer' | 'adjustment';
  purpose: string;
  description: string;
  occurredAt: string;
}

export async function listTransactionsForBook(
  db: AssetTrackerDb,
  bookId: string
): Promise<TransactionListItem[]> {
  const transactionRepository = new TransactionRepository(db);
  const categoryRepository = new CategoryRepository(db);
  const [transactions, categories] = await Promise.all([
    transactionRepository.listByBook(bookId),
    categoryRepository.listByBook(bookId)
  ]);
  const categoryNameById = new Map(categories.map((category) => [category.id, category.name]));

  return transactions
    .filter((item) => item.deletedAt === null)
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    .map((transaction) => ({
      id: transaction.id,
      categoryId: transaction.categoryId,
      categoryName: categoryNameById.get(transaction.categoryId) ?? '未知分类',
      amount: transaction.amount,
      currency: transaction.currency,
      direction: transaction.direction,
      purpose: transaction.purpose,
      description: transaction.description,
      occurredAt: transaction.occurredAt
    }));
}
