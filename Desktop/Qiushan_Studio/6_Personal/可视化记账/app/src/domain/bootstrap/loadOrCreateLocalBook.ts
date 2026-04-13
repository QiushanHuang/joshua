import type { Book } from '../../shared/types/entities';
import { AssetTrackerDb } from '../../storage/db';
import { BookRepository } from '../../storage/repositories/bookRepository';

export async function loadOrCreateLocalBook(db: AssetTrackerDb): Promise<Book> {
  const repository = new BookRepository(db);
  const existing = await repository.getById('book_local');

  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  const book: Book = {
    id: 'book_local',
    name: 'Local Book',
    type: 'private',
    baseCurrency: 'CNY',
    revision: 1,
    deletedAt: null,
    updatedBy: 'local-user',
    deviceId: 'device_local',
    createdAt: now,
    updatedAt: now
  };

  try {
    await repository.put(book);
  } catch (error) {
    if (error instanceof Error && error.message === 'Revision conflict') {
      const concurrentBook = await repository.getById('book_local');

      if (concurrentBook) {
        return concurrentBook;
      }
    }

    throw error;
  }

  return book;
}
