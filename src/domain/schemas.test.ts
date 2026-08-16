import { describe, it, expect } from 'vitest';
import {
  AccountInputSchema,
  CaseCreateSchema,
  CaseUpdateSchema,
  LoginInputSchema,
  PaginationQuerySchema,
  TransactionInputSchema
} from './schemas.js';

describe('TransactionInputSchema', () => {
  it('accepts a valid transaction', () => {
    const result = TransactionInputSchema.safeParse({
      id: 'txn-1',
      fromAccountId: 'acct-a',
      toAccountId: 'acct-b',
      amount: '9999.50',
      currency: 'usd',
      timestamp: '2026-08-14T12:00:00Z'
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toBe(9999.5);
      expect(result.data.currency).toBe('USD');
    }
  });

  it('rejects a non-positive amount', () => {
    const result = TransactionInputSchema.safeParse({
      id: 'txn-2',
      fromAccountId: 'acct-a',
      toAccountId: 'acct-b',
      amount: -5,
      currency: 'USD',
      timestamp: '2026-08-14T12:00:00Z'
    });

    expect(result.success).toBe(false);
  });

  it('rejects a malformed currency code', () => {
    const result = TransactionInputSchema.safeParse({
      id: 'txn-3',
      fromAccountId: 'acct-a',
      toAccountId: 'acct-b',
      amount: 100,
      currency: 'US',
      timestamp: '2026-08-14T12:00:00Z'
    });

    expect(result.success).toBe(false);
  });

  it('rejects a missing required field', () => {
    const result = TransactionInputSchema.safeParse({
      id: 'txn-4',
      toAccountId: 'acct-b',
      amount: 100,
      currency: 'USD',
      timestamp: '2026-08-14T12:00:00Z'
    });

    expect(result.success).toBe(false);
  });
});

describe('AccountInputSchema', () => {
  it('accepts an account with no owning entity', () => {
    const result = AccountInputSchema.safeParse({ id: 'acct-a' });
    expect(result.success).toBe(true);
  });

  it('accepts an account with an owning entity', () => {
    const result = AccountInputSchema.safeParse({
      id: 'acct-a',
      entityId: 'entity-1',
      entityName: 'Jane Doe'
    });
    expect(result.success).toBe(true);
  });

  it('accepts an account with a device/IP fingerprint', () => {
    const result = AccountInputSchema.safeParse({
      id: 'acct-a',
      deviceId: 'device-1',
      ipAddress: '10.0.0.1'
    });
    expect(result.success).toBe(true);
  });
});

describe('LoginInputSchema', () => {
  it('accepts valid credentials', () => {
    expect(LoginInputSchema.safeParse({ username: 'analyst', password: 'secret' }).success).toBe(true);
  });

  it('rejects an empty password', () => {
    expect(LoginInputSchema.safeParse({ username: 'analyst', password: '' }).success).toBe(false);
  });
});

describe('CaseCreateSchema', () => {
  it('defaults accountIds and alertIds to empty arrays', () => {
    const result = CaseCreateSchema.safeParse({ title: 'Suspicious activity' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.accountIds).toEqual([]);
      expect(result.data.alertIds).toEqual([]);
    }
  });

  it('rejects a missing title', () => {
    expect(CaseCreateSchema.safeParse({}).success).toBe(false);
  });
});

describe('CaseUpdateSchema', () => {
  it('rejects an invalid status', () => {
    expect(CaseUpdateSchema.safeParse({ status: 'archived' }).success).toBe(false);
  });

  it('accepts a valid status transition', () => {
    expect(CaseUpdateSchema.safeParse({ status: 'in_review' }).success).toBe(true);
  });
});

describe('PaginationQuerySchema', () => {
  it('defaults limit and offset when omitted', () => {
    const result = PaginationQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ limit: 50, offset: 0 });
    }
  });

  it('coerces string query params into numbers', () => {
    const result = PaginationQuerySchema.safeParse({ limit: '25', offset: '10' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ limit: 25, offset: 10 });
    }
  });

  it('rejects a limit above the max of 200', () => {
    expect(PaginationQuerySchema.safeParse({ limit: '500' }).success).toBe(false);
  });

  it('rejects a negative offset', () => {
    expect(PaginationQuerySchema.safeParse({ offset: '-1' }).success).toBe(false);
  });
});
