import neo4j from 'neo4j-driver';
import { DetectionRule } from '../types.js';
import { toNumber } from '../../utils/neo4jValues.js';

export interface StructuringRuleConfig {
  /** Sub-threshold cutoff and aggregate reporting threshold, e.g. 10000 for a $10k CTR-style limit. */
  thresholdAmount: number;
  /** ISO 8601 duration string, e.g. 'P7D' for a 7-day lookback window. */
  windowIso: string;
  minTransactionCount: number;
  /** Caps the result set, matching the other rules — an unbounded scan at volume is a liability. */
  maxResults: number;
}

export const DEFAULT_CONFIG: StructuringRuleConfig = {
  thresholdAmount: 10_000,
  windowIso: 'P7D',
  minTransactionCount: 3,
  maxResults: 200
};

// Aggregates with sum()/count() rather than collect()ing whole Transaction nodes:
// the rule only needs the total, the count, and the ids, so materializing every
// node's properties per account is pure overhead.
export const CYPHER = `
  MATCH (a:Account)-[:SENT]->(t:Transaction)
  WHERE t.amount < $threshold AND t.timestamp >= datetime() - duration($window)
  WITH a, collect(t.id) AS transactionIds, sum(t.amount) AS total, count(t) AS count
  WHERE count >= $minCount AND total >= $threshold
  RETURN a.id AS accountId, total, count, transactionIds
  ORDER BY total DESC
  LIMIT $limit
`;

export function createStructuringRule(config: Partial<StructuringRuleConfig> = {}): DetectionRule {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  return {
    name: 'structuring',
    description:
      'Multiple sub-threshold transactions from one account aggregating above a reporting threshold within a time window.',
    async run(session) {
      const result = await session.run(CYPHER, {
        threshold: cfg.thresholdAmount,
        window: cfg.windowIso,
        minCount: cfg.minTransactionCount,
        limit: neo4j.int(cfg.maxResults)
      });

      return result.records.map((record) => {
        const total = toNumber(record.get('total'));
        const count = toNumber(record.get('count'));
        return {
          ruleName: 'structuring',
          score: Math.min(1, total / cfg.thresholdAmount / 3),
          accountIds: [record.get('accountId') as string],
          transactionIds: record.get('transactionIds') as string[],
          details: { total, count, thresholdAmount: cfg.thresholdAmount, windowIso: cfg.windowIso }
        };
      });
    }
  };
}

export const structuringRule = createStructuringRule();
