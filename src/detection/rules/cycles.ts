import neo4j from 'neo4j-driver';
import { DetectionRule } from '../types.js';
import { toNumber } from '../../utils/neo4jValues.js';
import { hopRange } from '../../utils/cypher.js';

export interface CycleRuleConfig {
  /** Minimum number of transaction hops in the cycle (2 hops per transaction: SENT + RECEIVED_BY). */
  minHops: number;
  /** Maximum number of transaction hops to search — bounds the variable-length traversal. */
  maxHops: number;
  maxResults: number;
}

export const DEFAULT_CONFIG: CycleRuleConfig = {
  minHops: 4,
  // Unbounded variable-length traversal is the most expensive query in the engine — cost grows
  // combinatorially with maxHops on a densely connected graph, since every Account node is a
  // potential path start (NodeByLabelScan) with no index seek to narrow it. 10 hops (5 chained
  // transactions) catches the realistic layering depth for round-tripping without letting a
  // single dense account blow up traversal cost; raise only after confirming with PROFILE
  // (src/db/explainQueries.ts) that it's still cheap enough on your data volume.
  maxHops: 10,
  maxResults: 200
};

export function buildCypher(cfg: CycleRuleConfig): string {
  // A cycle is found once per member account and once per rotation, so the same
  // ring would otherwise raise N near-identical alerts. Keeping only the path
  // whose start is the smallest account id in the ring canonicalises each cycle
  // to exactly one row.
  return `
  MATCH path = (a:Account)-[:SENT|RECEIVED_BY${hopRange(cfg.minHops, cfg.maxHops)}]->(a)
  WITH a, path, [n IN nodes(path) WHERE n:Account | n.id] AS accountIds
  WHERE a.id = reduce(lowest = head(accountIds), x IN accountIds |
    CASE WHEN x < lowest THEN x ELSE lowest END)
  RETURN a.id AS accountId,
         length(path) AS pathLength,
         [n IN nodes(path) WHERE n:Transaction | n.id] AS transactionIds
  LIMIT $limit
`;
}

export function createCycleRule(config: Partial<CycleRuleConfig> = {}): DetectionRule {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const cypher = buildCypher(cfg);

  return {
    name: 'cycle',
    description: 'Funds routed through a chain of accounts and back to the originating account (round-tripping).',
    async run(session) {
      const result = await session.run(cypher, { limit: neo4j.int(cfg.maxResults) });

      return result.records.map((record) => {
        const pathLength = toNumber(record.get('pathLength'));
        const transactionIds = record.get('transactionIds') as string[];
        return {
          ruleName: 'cycle',
          score: Math.min(1, 3 / transactionIds.length),
          accountIds: [record.get('accountId') as string],
          transactionIds,
          details: { pathLength, transactionCount: transactionIds.length }
        };
      });
    }
  };
}

export const cycleRule = createCycleRule();
