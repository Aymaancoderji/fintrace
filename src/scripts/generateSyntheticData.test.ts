import { describe, it, expect } from 'vitest';
import { generateSyntheticCsv } from './generateSyntheticData.js';
import { parseTransactionCsv } from '../utils/csv.js';
import { TransactionInputSchema } from '../domain/schemas.js';

describe('generateSyntheticCsv', () => {
  it('produces rows that all validate against TransactionInputSchema', () => {
    const { csv, rowCount } = generateSyntheticCsv({
      transactionCount: 100,
      accountCount: 20,
      structuringAccounts: 2,
      fanAccounts: 2
    });

    const rows = parseTransactionCsv(Buffer.from(csv));
    expect(rows).toHaveLength(rowCount);

    for (const row of rows) {
      const parsed = TransactionInputSchema.safeParse(row);
      expect(parsed.success).toBe(true);
    }
  });

  it('injects a structuring pattern: 4 sub-threshold transfers per structurer account', () => {
    const { csv } = generateSyntheticCsv({
      transactionCount: 0,
      accountCount: 10,
      structuringAccounts: 1,
      fanAccounts: 0
    });
    const rows = parseTransactionCsv(Buffer.from(csv));
    const fromStructurer = rows.filter((r) => r.fromAccountId === 'acct-structurer-0');
    expect(fromStructurer).toHaveLength(4);
    for (const row of fromStructurer) {
      expect(Number(row.amount)).toBeLessThan(10_000);
    }
    const total = fromStructurer.reduce((sum, r) => sum + Number(r.amount), 0);
    expect(total).toBeGreaterThan(10_000);
  });

  it('injects a fan-out pattern: 6 distinct counterparties per fan account', () => {
    const { csv } = generateSyntheticCsv({
      transactionCount: 0,
      accountCount: 10,
      structuringAccounts: 0,
      fanAccounts: 1
    });
    const rows = parseTransactionCsv(Buffer.from(csv));
    const fromFanner = rows.filter((r) => r.fromAccountId === 'acct-fanner-0');
    const distinctRecipients = new Set(fromFanner.map((r) => r.toAccountId));
    expect(distinctRecipients.size).toBe(6);
  });

  it('never generates a self-transfer for the random clean transactions', () => {
    const { csv } = generateSyntheticCsv({
      transactionCount: 500,
      accountCount: 5,
      structuringAccounts: 0,
      fanAccounts: 0
    });
    const rows = parseTransactionCsv(Buffer.from(csv));
    expect(rows.every((r) => r.fromAccountId !== r.toAccountId)).toBe(true);
  });
});
