import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { Alert, AlertCandidate } from '../detection/types.js';
import { PaginationQuery } from '../domain/schemas.js';

interface AlertRow {
  id: string;
  rule_name: string;
  score: string;
  account_ids: string[];
  transaction_ids: string[];
  details: Record<string, unknown>;
  created_at: Date;
}

const SELECT_COLUMNS = 'id, rule_name, score, account_ids, transaction_ids, details, created_at';
const DEFAULT_PAGINATION: PaginationQuery = { limit: 50, offset: 0 };

export async function insertAlert(pool: Pool, candidate: AlertCandidate): Promise<Alert> {
  const id = randomUUID();
  const result = await pool.query<AlertRow>(
    `
    INSERT INTO alerts (id, rule_name, score, account_ids, transaction_ids, details)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING ${SELECT_COLUMNS}
    `,
    [
      id,
      candidate.ruleName,
      candidate.score,
      candidate.accountIds,
      candidate.transactionIds,
      JSON.stringify(candidate.details)
    ]
  );

  return mapRow(result.rows[0]);
}

/**
 * Inserts a whole rule's worth of candidates in one round trip. Returns the
 * number of rows written rather than the rows themselves — the detection run
 * only reports counts, and `details` blobs can be large enough that shipping
 * them back to be discarded is a measurable waste.
 */
const COLUMNS_PER_ALERT = 6;
// Postgres caps a statement at 65535 bound parameters; stay well under it.
const MAX_ALERTS_PER_INSERT = Math.floor(60_000 / COLUMNS_PER_ALERT);

export async function insertAlerts(pool: Pool, candidates: AlertCandidate[]): Promise<number> {
  let inserted = 0;

  for (let start = 0; start < candidates.length; start += MAX_ALERTS_PER_INSERT) {
    const batch = candidates.slice(start, start + MAX_ALERTS_PER_INSERT);

    // A multi-row VALUES list rather than unnest(): two of the columns are
    // themselves text[], and Postgres has no array-of-arrays type for unnest
    // to expand into.
    const values = batch
      .map((_, i) => {
        const p = i * COLUMNS_PER_ALERT;
        return `($${p + 1}, $${p + 2}, $${p + 3}, $${p + 4}, $${p + 5}, $${p + 6})`;
      })
      .join(', ');

    const params = batch.flatMap((c) => [
      randomUUID(),
      c.ruleName,
      c.score,
      c.accountIds,
      c.transactionIds,
      JSON.stringify(c.details)
    ]);

    const result = await pool.query(
      `INSERT INTO alerts (id, rule_name, score, account_ids, transaction_ids, details) VALUES ${values}`,
      params
    );
    inserted += result.rowCount ?? 0;
  }

  return inserted;
}

export async function listAlerts(
  pool: Pool,
  ruleName?: string,
  pagination: PaginationQuery = DEFAULT_PAGINATION
): Promise<Alert[]> {
  const result = await pool.query<AlertRow>(
    `SELECT ${SELECT_COLUMNS} FROM alerts
     WHERE ($1::text IS NULL OR rule_name = $1)
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [ruleName ?? null, pagination.limit, pagination.offset]
  );

  return result.rows.map(mapRow);
}

function mapRow(row: AlertRow): Alert {
  return {
    id: row.id,
    ruleName: row.rule_name,
    score: Number(row.score),
    accountIds: row.account_ids,
    transactionIds: row.transaction_ids,
    details: row.details,
    createdAt: row.created_at
  };
}
