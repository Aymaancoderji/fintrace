import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { CaseCreateInput, CaseUpdateInput } from '../domain/schemas.js';

export interface Pagination {
  limit: number;
  offset: number;
}

export interface Case {
  id: string;
  title: string;
  status: 'open' | 'in_review' | 'closed';
  assignedTo: string | null;
  accountIds: string[];
  alertIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CaseNote {
  id: string;
  caseId: string;
  author: string;
  body: string;
  createdAt: Date;
}

export async function createCase(pool: Pool, input: CaseCreateInput): Promise<Case> {
  const result = await pool.query(
    `
    INSERT INTO cases (id, title, account_ids, alert_ids, assigned_to)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, title, status, assigned_to, account_ids, alert_ids, created_at, updated_at
    `,
    [randomUUID(), input.title, input.accountIds, input.alertIds, input.assignedTo ?? null]
  );
  return mapCaseRow(result.rows[0]);
}

export async function listCases(
  pool: Pool,
  status?: string,
  pagination: Pagination = { limit: 50, offset: 0 }
): Promise<Case[]> {
  const result = status
    ? await pool.query(
        `SELECT id, title, status, assigned_to, account_ids, alert_ids, created_at, updated_at
         FROM cases WHERE status = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [status, pagination.limit, pagination.offset]
      )
    : await pool.query(
        `SELECT id, title, status, assigned_to, account_ids, alert_ids, created_at, updated_at
         FROM cases ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
        [pagination.limit, pagination.offset]
      );
  return result.rows.map(mapCaseRow);
}

export async function getCaseById(pool: Pool, id: string): Promise<Case | undefined> {
  const result = await pool.query(
    `SELECT id, title, status, assigned_to, account_ids, alert_ids, created_at, updated_at
     FROM cases WHERE id = $1`,
    [id]
  );
  return result.rows[0] ? mapCaseRow(result.rows[0]) : undefined;
}

export async function updateCase(pool: Pool, id: string, input: CaseUpdateInput): Promise<Case | undefined> {
  const result = await pool.query(
    `
    UPDATE cases
    SET status = COALESCE($2, status),
        assigned_to = COALESCE($3, assigned_to),
        updated_at = now()
    WHERE id = $1
    RETURNING id, title, status, assigned_to, account_ids, alert_ids, created_at, updated_at
    `,
    [id, input.status ?? null, input.assignedTo ?? null]
  );
  return result.rows[0] ? mapCaseRow(result.rows[0]) : undefined;
}

export async function addCaseNote(pool: Pool, caseId: string, author: string, body: string): Promise<CaseNote> {
  const result = await pool.query(
    `
    INSERT INTO case_notes (id, case_id, author, body)
    VALUES ($1, $2, $3, $4)
    RETURNING id, case_id, author, body, created_at
    `,
    [randomUUID(), caseId, author, body]
  );
  const row = result.rows[0];
  return { id: row.id, caseId: row.case_id, author: row.author, body: row.body, createdAt: row.created_at };
}

export async function listCaseNotes(pool: Pool, caseId: string): Promise<CaseNote[]> {
  const result = await pool.query(
    `SELECT id, case_id, author, body, created_at FROM case_notes WHERE case_id = $1 ORDER BY created_at ASC`,
    [caseId]
  );
  return result.rows.map((row) => ({
    id: row.id,
    caseId: row.case_id,
    author: row.author,
    body: row.body,
    createdAt: row.created_at
  }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCaseRow(row: any): Case {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    assignedTo: row.assigned_to,
    accountIds: row.account_ids,
    alertIds: row.alert_ids,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
