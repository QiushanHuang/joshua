import { z } from 'zod';
import type { MonetaryAmount } from '../types/entities';

export const currencySchema = z.enum(['CNY', 'SGD', 'USD', 'MYR']);
const AMOUNT_PRECISION = 2;
const MINOR_UNIT_SCALE = 10 ** AMOUNT_PRECISION;

const amountSchema = z
  .number()
  .finite()
  .refine((value) => {
    const normalized = Number(value.toFixed(AMOUNT_PRECISION));
    return Math.abs(value - normalized) < Number.EPSILON;
  }, `Amount must use at most ${AMOUNT_PRECISION} decimal places`)
  .transform((value) => Math.round(value * MINOR_UNIT_SCALE) as MonetaryAmount);

export const metadataSchema = z.object({
  revision: z.number().int().nonnegative(),
  deletedAt: z.string().datetime().nullable(),
  updatedBy: z.string().min(1),
  deviceId: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
}).strict();

export const bookSchema = metadataSchema.extend({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.literal('private'),
  baseCurrency: currencySchema
}).strict();

export const categorySchema = metadataSchema.extend({
  id: z.string().min(1),
  bookId: z.string().min(1),
  parentId: z.string().min(1).nullable(),
  name: z.string().min(1),
  kind: z.enum(['asset', 'debt', 'group']),
  currency: currencySchema,
  sortOrder: z.number().int(),
  isArchived: z.boolean()
}).strict();

export const transactionSchema = metadataSchema.extend({
  id: z.string().min(1),
  bookId: z.string().min(1),
  categoryId: z.string().min(1),
  amount: amountSchema,
  currency: currencySchema,
  direction: z.enum(['income', 'expense', 'transfer', 'adjustment']),
  purpose: z.string().min(1),
  description: z.string(),
  occurredAt: z.string().datetime()
}).strict();
