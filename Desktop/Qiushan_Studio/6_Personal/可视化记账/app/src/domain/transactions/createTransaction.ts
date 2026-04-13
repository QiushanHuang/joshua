import type { Transaction } from '../../shared/types/entities';
import { transactionSchema } from '../../shared/validation/schemas';
import { AssetTrackerDb } from '../../storage/db';
import { CategoryRepository } from '../../storage/repositories/categoryRepository';
import { TransactionRepository } from '../../storage/repositories/transactionRepository';

export interface CreateTransactionInput {
  bookId: string;
  categoryId: string;
  amount: number;
  currency: 'CNY' | 'SGD' | 'USD' | 'MYR';
  direction: 'income' | 'expense' | 'transfer' | 'adjustment';
  purpose: string;
  description: string;
  occurredAt: string;
}

function normalizeAmount(amount: number, direction: CreateTransactionInput['direction']): number {
  if (direction === 'income') {
    return Math.abs(amount);
  }

  if (direction === 'expense') {
    return Math.abs(amount) * -1;
  }

  return amount;
}

export async function createTransaction(
  db: AssetTrackerDb,
  input: CreateTransactionInput
): Promise<Transaction> {
  const categoryRepository = new CategoryRepository(db);
  const categories = await categoryRepository.listByBook(input.bookId);
  const category = categories.find((item) => item.id === input.categoryId && item.deletedAt === null);

  if (!category) {
    throw new Error('Category does not exist');
  }

  if (category.kind === 'group') {
    throw new Error('Cannot attach transactions to a group category');
  }

  if (category.currency !== input.currency) {
    throw new Error('Transaction currency must match category currency');
  }

  const repository = new TransactionRepository(db);
  const now = new Date().toISOString();
  const transaction = transactionSchema.parse({
    id: `txn_${crypto.randomUUID()}`,
    bookId: input.bookId,
    categoryId: input.categoryId,
    amount: normalizeAmount(input.amount, input.direction),
    currency: input.currency,
    direction: input.direction,
    purpose: input.purpose.trim(),
    description: input.description.trim(),
    occurredAt: input.occurredAt,
    revision: 1,
    deletedAt: null,
    updatedBy: 'local-user',
    deviceId: 'device_local',
    createdAt: now,
    updatedAt: now
  });

  await repository.put(transaction);

  return transaction;
}
