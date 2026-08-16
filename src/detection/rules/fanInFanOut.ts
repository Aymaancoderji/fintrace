import { Session } from 'neo4j-driver';
import { AlertCandidate, DetectionRule } from '../types.js';
import { toNumber } from '../../utils/neo4jValues.js';

export interface FanRuleConfig {
  /** ISO 8601 duration string, e.g. 'P7D' for a 7-day lookback window. */
  windowIso: string;
  minDistinctCounterparties: number;
}

export const DEFAULT_CONFIG: FanRuleConfig = {
  windowIso: 'P7D',
  minDistinctCounterparties: 5
};

export const FAN_OUT_CYPHER = `
  MATCH (a:Account)-[:SENT]->(t:Transaction)-[:RECEIVED_BY]->(cp:Account)
  WHERE t.timestamp >= datetime() - duration($window)
  WITH a, collect(DISTINCT cp.id) AS counterparties, collect(DISTINCT t.id) AS transactionIds
  WHERE size(counterparties) >= $minCounterparties
  RETURN a.id AS accountId, counterparties, transactionIds, size(counterparties) AS distinctCount
`;

export const FAN_IN_CYPHER = `
  MATCH (cp:Account)-[:SENT]->(t:Transaction)-[:RECEIVED_BY]->(a:Account)
  WHERE t.timestamp >= datetime() - duration($window)
  WITH a, collect(DISTINCT cp.id) AS counterparties, collect(DISTINCT t.id) AS transactionIds
  WHERE size(counterparties) >= $minCounterparties
  RETURN a.id AS accountId, counterparties, transactionIds, size(counterparties) AS distinctCount
`;

async function runDirection(
  session: Session,
  cypher: string,
  direction: 'fan-out' | 'fan-in',
  cfg: FanRuleConfig
): Promise<AlertCandidate[]> {
  const result = await session.run(cypher, {
    window: cfg.windowIso,
    minCounterparties: cfg.minDistinctCounterparties
  });

  return result.records.map((record) => {
    const distinctCount = toNumber(record.get('distinctCount'));
    return {
      ruleName: 'fan-in-fan-out',
      score: Math.min(1, distinctCount / (cfg.minDistinctCounterparties * 3)),
      accountIds: [record.get('accountId') as string],
      transactionIds: record.get('transactionIds') as string[],
      details: {
        direction,
        distinctCounterparties: distinctCount,
        counterpartyIds: record.get('counterparties') as string[]
      }
    };
  });
}

export function createFanInFanOutRule(config: Partial<FanRuleConfig> = {}): DetectionRule {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  return {
    name: 'fan-in-fan-out',
    description:
      'One account concentrating funds from, or distributing funds to, many distinct counterparties within a time window.',
    async run(session) {
      const [fanOut, fanIn] = await Promise.all([
        runDirection(session, FAN_OUT_CYPHER, 'fan-out', cfg),
        runDirection(session, FAN_IN_CYPHER, 'fan-in', cfg)
      ]);
      return [...fanOut, ...fanIn];
    }
  };
}

export const fanInFanOutRule = createFanInFanOutRule();
