import { z } from 'zod';

export const AccountInputSchema = z.object({
  id: z.string().min(1),
  entityId: z.string().min(1).optional(),
  entityName: z.string().min(1).optional(),
  deviceId: z.string().min(1).optional(),
  ipAddress: z.string().min(1).optional()
});
export type AccountInput = z.infer<typeof AccountInputSchema>;

export const TransactionInputSchema = z.object({
  id: z.string().min(1),
  fromAccountId: z.string().min(1),
  toAccountId: z.string().min(1),
  amount: z.coerce.number().positive(),
  currency: z
    .string()
    .length(3)
    .transform((v) => v.toUpperCase()),
  timestamp: z.iso.datetime({ offset: true }).or(z.iso.date())
});
export type TransactionInput = z.infer<typeof TransactionInputSchema>;

export const LoginInputSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const CaseCreateSchema = z.object({
  title: z.string().min(1),
  accountIds: z.array(z.string().min(1)).default([]),
  alertIds: z.array(z.string().min(1)).default([]),
  assignedTo: z.string().min(1).optional()
});
export type CaseCreateInput = z.infer<typeof CaseCreateSchema>;

export const CaseUpdateSchema = z.object({
  status: z.enum(['open', 'in_review', 'closed']).optional(),
  assignedTo: z.string().min(1).optional()
});
export type CaseUpdateInput = z.infer<typeof CaseUpdateSchema>;

export const CaseNoteInputSchema = z.object({
  body: z.string().min(1)
});
export type CaseNoteInput = z.infer<typeof CaseNoteInputSchema>;

export const PaginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
