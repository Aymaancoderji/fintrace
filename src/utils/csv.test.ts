import { describe, it, expect } from 'vitest';
import { parseTransactionCsv } from './csv.js';

describe('parseTransactionCsv', () => {
  it('parses rows with a header into objects', () => {
    const csv = [
      'id,fromAccountId,toAccountId,amount,currency,timestamp',
      'txn-1,acct-a,acct-b,100.00,USD,2026-08-14T12:00:00Z',
      'txn-2,acct-b,acct-c,250.50,USD,2026-08-14T13:00:00Z'
    ].join('\n');

    const rows = parseTransactionCsv(Buffer.from(csv));

    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      id: 'txn-1',
      fromAccountId: 'acct-a',
      toAccountId: 'acct-b',
      amount: '100.00',
      currency: 'USD',
      timestamp: '2026-08-14T12:00:00Z'
    });
  });

  it('skips blank lines', () => {
    const csv = 'id,fromAccountId,toAccountId,amount,currency,timestamp\ntxn-1,a,b,1,USD,2026-08-14T12:00:00Z\n\n';
    const rows = parseTransactionCsv(Buffer.from(csv));
    expect(rows).toHaveLength(1);
  });
});
