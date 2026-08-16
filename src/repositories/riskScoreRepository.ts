import { Pool } from 'pg';
import { combineRiskSignals } from '../services/riskScoring.js';

export interface RiskScore {
  accountId: string;
  score: number;
  contributingRules: Record<string, number>;
  updatedAt: Date;
}

interface RiskScoreRow {
  account_id: string;
  score: string;
  contributing_rules: Record<string, number>;
  updated_at: Date;
}

const SELECT_COLUMNS = 'account_id, score, contributing_rules, updated_at';

export async function recomputeRiskScores(pool: Pool): Promise<number> {
  const result = await pool.query<{ account_id: string; rule_name: string; score: string }>(
    `SELECT unnest(account_ids) AS account_id, rule_name, score FROM alerts`
  );

  const byAccount = new Map<string, { ruleName: string; score: number }[]>();
  for (const row of result.rows) {
    const list = byAccount.get(row.account_id) ?? [];
    list.push({ ruleName: row.rule_name, score: Number(row.score) });
    byAccount.set(row.account_id, list);
  }

  if (byAccount.size === 0) return 0;

  const accountIds: string[] = [];
  const scores: number[] = [];
  const contributingRules: string[] = [];

  for (const [accountId, signals] of byAccount) {
    accountIds.push(accountId);
    scores.push(combineRiskSignals(signals));
    contributingRules.push(
      JSON.stringify(
        signals.reduce<Record<string, number>>((acc, s) => {
          acc[s.ruleName] = Math.max(acc[s.ruleName] ?? 0, s.score);
          return acc;
        }, {})
      )
    );
  }

  // Single bulk upsert: one round trip regardless of how many accounts were
  // flagged, instead of one INSERT per account on the /detection/run path.
  await pool.query(
    `
    INSERT INTO risk_scores (account_id, score, contributing_rules, updated_at)
    SELECT account_id, score, contributing_rules, now()
    FROM unnest($1::text[], $2::float8[], $3::jsonb[])
      AS t(account_id, score, contributing_rules)
    ON CONFLICT (account_id) DO UPDATE
      SET score = EXCLUDED.score,
          contributing_rules = EXCLUDED.contributing_rules,
          updated_at = now()
    `,
    [accountIds, scores, contributingRules]
  );

  return byAccount.size;
}

export async function getRiskScore(pool: Pool, accountId: string): Promise<RiskScore | undefined> {
  const result = await pool.query<RiskScoreRow>(
    `SELECT ${SELECT_COLUMNS} FROM risk_scores WHERE account_id = $1`,
    [accountId]
  );
  return result.rows[0] ? mapRow(result.rows[0]) : undefined;
}

export async function listTopRiskScores(pool: Pool, limit = 20): Promise<RiskScore[]> {
  const result = await pool.query<RiskScoreRow>(
    `SELECT ${SELECT_COLUMNS} FROM risk_scores ORDER BY score DESC LIMIT $1`,
    [limit]
  );
  return result.rows.map(mapRow);
}

function mapRow(row: RiskScoreRow): RiskScore {
  return {
    accountId: row.account_id,
    score: Number(row.score),
    contributingRules: row.contributing_rules,
    updatedAt: row.updated_at
  };
}
