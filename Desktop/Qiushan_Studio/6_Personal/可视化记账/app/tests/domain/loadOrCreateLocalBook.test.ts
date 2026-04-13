import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AssetTrackerDb } from '../../src/storage/db';
import { loadOrCreateLocalBook } from '../../src/domain/bootstrap/loadOrCreateLocalBook';

describe('loadOrCreateLocalBook', () => {
  let db: AssetTrackerDb;

  beforeEach(async () => {
    db = new AssetTrackerDb('asset-tracker-db-load-test');
    await db.delete();
    await db.open();
  });

  afterEach(async () => {
    await db.delete();
    db.close();
  });

  it('creates a default local book on first boot', async () => {
    const book = await loadOrCreateLocalBook(db);

    expect(book.id).toBe('book_local');
    expect(book.type).toBe('private');
    expect(book.baseCurrency).toBe('CNY');
  });

  it('returns the same local book when two fresh bootstraps race', async () => {
    const dbName = `asset-tracker-db-load-race-${crypto.randomUUID()}`;
    const firstDb = new AssetTrackerDb(dbName);
    const secondDb = new AssetTrackerDb(dbName);

    await Promise.all([firstDb.open(), secondDb.open()]);

    await expect(
      Promise.all([loadOrCreateLocalBook(firstDb), loadOrCreateLocalBook(secondDb)])
    ).resolves.toEqual([
      expect.objectContaining({ id: 'book_local' }),
      expect.objectContaining({ id: 'book_local' })
    ]);

    expect(await firstDb.books.count()).toBe(1);

    firstDb.close();
    secondDb.close();
    await firstDb.delete();
  });
});
