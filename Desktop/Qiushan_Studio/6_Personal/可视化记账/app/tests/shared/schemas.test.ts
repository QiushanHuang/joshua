import { describe, expect, it } from 'vitest';
import type { MonetaryAmount } from '../../src/shared/types/entities';
import {
  bookSchema,
  categorySchema,
  metadataSchema,
  transactionSchema
} from '../../src/shared/validation/schemas';

// @ts-expect-error Monetary amounts must be branded minor-unit integers, not plain numbers.
const invalidMinorUnitAmount: MonetaryAmount = 20.5;

void invalidMinorUnitAmount;

describe('entity schemas', () => {
  it('accepts a category with revision metadata', () => {
    const category = categorySchema.parse({
      id: 'cat_001',
      bookId: 'book_local',
      parentId: null,
      name: '银行卡',
      kind: 'group',
      currency: 'CNY',
      sortOrder: 0,
      isArchived: false,
      revision: 1,
      deletedAt: null,
      updatedBy: 'local-user',
      deviceId: 'device_local',
      createdAt: '2026-04-13T00:00:00.000Z',
      updatedAt: '2026-04-13T00:00:00.000Z'
    });

    expect(category.name).toBe('银行卡');
  });

  it('accepts a private book with supported currency', () => {
    const book = bookSchema.parse({
      id: 'book_local',
      name: '默认账本',
      type: 'private',
      baseCurrency: 'CNY',
      revision: 1,
      deletedAt: null,
      updatedBy: 'local-user',
      deviceId: 'device_local',
      createdAt: '2026-04-13T00:00:00.000Z',
      updatedAt: '2026-04-13T00:00:00.000Z'
    });

    expect(book.baseCurrency).toBe('CNY');
  });

  it('rejects a transaction without occurredAt', () => {
    expect(() =>
      transactionSchema.parse({
        id: 'txn_001',
        bookId: 'book_local',
        categoryId: 'cat_001',
        amount: 20,
        currency: 'CNY',
        direction: 'expense',
        purpose: '餐饮',
        description: '午饭'
      })
    ).toThrow();
  });

  it('normalizes valid transaction amounts into integer minor units', () => {
    const transaction = transactionSchema.parse({
      id: 'txn_001',
      bookId: 'book_local',
      categoryId: 'cat_001',
      amount: 20.5,
      currency: 'CNY',
      direction: 'expense',
      purpose: '餐饮',
      description: '午饭',
      revision: 1,
      deletedAt: null,
      updatedBy: 'local-user',
      deviceId: 'device_local',
      createdAt: '2026-04-13T00:00:00.000Z',
      updatedAt: '2026-04-13T00:00:00.000Z',
      occurredAt: '2026-04-13T00:00:00.000Z'
    });

    const amount: MonetaryAmount = transaction.amount;

    expect(transaction.amount).toBe(2050);
    expect(amount).toBe(2050);
  });

  it('rejects unsupported category currency values', () => {
    expect(() =>
      categorySchema.parse({
        id: 'cat_001',
        bookId: 'book_local',
        parentId: null,
        name: '银行卡',
        kind: 'group',
        currency: 'EUR',
        sortOrder: 0,
        isArchived: false,
        revision: 1,
        deletedAt: null,
        updatedBy: 'local-user',
        deviceId: 'device_local',
        createdAt: '2026-04-13T00:00:00.000Z',
        updatedAt: '2026-04-13T00:00:00.000Z'
      })
    ).toThrow();
  });

  it('rejects invalid metadata datetime values', () => {
    expect(() =>
      metadataSchema.parse({
        revision: 1,
        deletedAt: null,
        updatedBy: 'local-user',
        deviceId: 'device_local',
        createdAt: 'not-a-date',
        updatedAt: '2026-04-13T00:00:00.000Z'
      })
    ).toThrow();
  });

  it('rejects transactions with more than two decimal places', () => {
    expect(() =>
      transactionSchema.parse({
        id: 'txn_001',
        bookId: 'book_local',
        categoryId: 'cat_001',
        amount: 20.123,
        currency: 'CNY',
        direction: 'expense',
        purpose: '餐饮',
        description: '午饭',
        revision: 1,
        deletedAt: null,
        updatedBy: 'local-user',
        deviceId: 'device_local',
        createdAt: '2026-04-13T00:00:00.000Z',
        updatedAt: '2026-04-13T00:00:00.000Z',
        occurredAt: '2026-04-13T00:00:00.000Z'
      })
    ).toThrow();
  });

  it('rejects unknown keys instead of stripping them silently', () => {
    expect(() =>
      categorySchema.parse({
        id: 'cat_001',
        bookId: 'book_local',
        parentId: null,
        name: '银行卡',
        kind: 'group',
        currency: 'CNY',
        sortOrder: 0,
        isArchived: false,
        revision: 1,
        deletedAt: null,
        updatedBy: 'local-user',
        deviceId: 'device_local',
        createdAt: '2026-04-13T00:00:00.000Z',
        updatedAt: '2026-04-13T00:00:00.000Z',
        futureField: 'unexpected'
      })
    ).toThrow();
  });
});
