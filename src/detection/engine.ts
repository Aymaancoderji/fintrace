import { Session } from 'neo4j-driver';
import { Pool } from 'pg';
import { DetectionRule } from './types.js';
import { insertAlerts } from '../repositories/alertRepository.js';
import { recomputeRiskScores } from '../repositories/riskScoreRepository.js';
import { structuringRule } from './rules/structuring.js';
import { cycleRule } from './rules/cycles.js';
import { fanInFanOutRule } from './rules/fanInFanOut.js';
import { muleNetworkRule } from './rules/muleNetwork.js';

export const defaultRules: DetectionRule[] = [structuringRule, cycleRule, fanInFanOutRule, muleNetworkRule];

export interface DetectionRunSummary {
  rule: string;
  alertsCreated: number;
  /** Set when the rule threw; the run continues so one bad rule can't halt the rest. */
  error?: string;
}

export interface DetectionRunResult {
  summary: DetectionRunSummary[];
  alertCount: number;
}

export async function runDetection(
  session: Session,
  pool: Pool,
  rules: DetectionRule[] = defaultRules
): Promise<DetectionRunResult> {
  const summary: DetectionRunSummary[] = [];
  let alertCount = 0;

  for (const rule of rules) {
    try {
      const candidates = await rule.run(session);
      const created = await insertAlerts(pool, candidates);
      alertCount += created;
      summary.push({ rule: rule.name, alertsCreated: created });
    } catch (err) {
      // Rules are independent by contract, so isolate failures: a broken rule
      // shouldn't abort the others or leave risk scores unrecomputed.
      summary.push({ rule: rule.name, alertsCreated: 0, error: (err as Error).message });
    }
  }

  await recomputeRiskScores(pool);

  return { summary, alertCount };
}
