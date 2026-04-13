import type { EntityMetadata } from './metadata';

export type CurrencyCode = 'CNY' | 'SGD' | 'USD' | 'MYR';
declare const monetaryAmountBrand: unique symbol;

export type MonetaryAmount = number & {
  readonly [monetaryAmountBrand]: 'minor-unit-amount';
};

export interface Book extends EntityMetadata {
  id: string;
  name: string;
  type: 'private';
  baseCurrency: CurrencyCode;
}

export interface Category extends EntityMetadata {
  id: string;
  bookId: string;
  parentId: string | null;
  name: string;
  kind: 'asset' | 'debt' | 'group';
  currency: CurrencyCode;
  sortOrder: number;
  isArchived: boolean;
}

export interface Transaction extends EntityMetadata {
  id: string;
  bookId: string;
  categoryId: string;
  // Persist money in minor units to avoid floating-point drift during bookkeeping math.
  amount: MonetaryAmount;
  currency: CurrencyCode;
  direction: 'income' | 'expense' | 'transfer' | 'adjustment';
  purpose: string;
  description: string;
  occurredAt: string;
}
