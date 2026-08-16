/**
 * Generates a synthetic transaction CSV for ingestion load testing, mixing
 * unremarkable random transfers with injected structuring/fan-out patterns so
 * that a subsequent `POST /detection/run` has something real to find.
 *
 * Usage: npm run generate:data -- [txnCount] [outputPath]
 *   npm run generate:data -- 50000 .data/synthetic-transactions.csv
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

export interface GenerateOptions {
  transactionCount: number;
  accountCount: number;
  structuringAccounts: number;
  fanAccounts: number;
}

const CSV_HEADER = 'id,fromAccountId,toAccountId,amount,currency,timestamp';

function randomTimestampWithinDays(days: number): string {
  const now = Date.now();
  const past = now - Math.floor(Math.random() * days * 24 * 60 * 60 * 1000);
  return new Date(past).toISOString();
}

function randomAmount(min: number, max: number): number {
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

function csvRow(fields: (string | number)[]): string {
  return fields.join(',');
}

export function generateSyntheticCsv(options: GenerateOptions): { csv: string; rowCount: number } {
  const { transactionCount, accountCount, structuringAccounts, fanAccounts } = options;
  const accounts = Array.from({ length: accountCount }, (_, i) => `acct-synthetic-${i}`);
  const rows: string[] = [CSV_HEADER];

  for (let i = 0; i < transactionCount; i++) {
    const from = accounts[Math.floor(Math.random() * accounts.length)];
    let to = accounts[Math.floor(Math.random() * accounts.length)];
    while (to === from) {
      to = accounts[Math.floor(Math.random() * accounts.length)];
    }
    rows.push(
      csvRow([randomUUID(), from, to, randomAmount(10, 5000), 'USD', randomTimestampWithinDays(30)])
    );
  }

  // Injected structuring pattern: 4 sub-threshold transfers from one account, summing above $10k.
  for (let s = 0; s < structuringAccounts; s++) {
    const structurer = `acct-structurer-${s}`;
    for (let i = 0; i < 4; i++) {
      rows.push(
        csvRow([
          randomUUID(),
          structurer,
          `acct-struct-recipient-${s}-${i}`,
          randomAmount(2500, 3500),
          'USD',
          new Date().toISOString()
        ])
      );
    }
  }

  // Injected fan-out pattern: one account sending to 6 distinct counterparties.
  for (let f = 0; f < fanAccounts; f++) {
    const fanner = `acct-fanner-${f}`;
    for (let i = 0; i < 6; i++) {
      rows.push(
        csvRow([randomUUID(), fanner, `acct-fan-recipient-${f}-${i}`, randomAmount(50, 500), 'USD', new Date().toISOString()])
      );
    }
  }

  return { csv: rows.join('\n') + '\n', rowCount: rows.length - 1 };
}

async function main(): Promise<void> {
  const [countArg, outputArg] = process.argv.slice(2);
  const transactionCount = countArg ? Number(countArg) : 10_000;
  const outputPath = outputArg ?? '.data/synthetic-transactions.csv';

  const { csv, rowCount } = generateSyntheticCsv({
    transactionCount,
    accountCount: Math.max(100, Math.floor(transactionCount / 20)),
    structuringAccounts: 5,
    fanAccounts: 5
  });

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, csv, 'utf-8');

  // eslint-disable-next-line no-console
  console.log(`Wrote ${rowCount} transactions (${(csv.length / 1024 / 1024).toFixed(2)} MB) to ${outputPath}`);
}

// Only run when executed directly (not when imported by tests).
if (process.argv[1]?.endsWith('generateSyntheticData.ts')) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
}
