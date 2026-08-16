import { DetectionRule } from '../types.js';

export interface MuleNetworkRuleConfig {
  minSharedAccounts: number;
}

export const DEFAULT_CONFIG: MuleNetworkRuleConfig = {
  minSharedAccounts: 2
};

export const CYPHER = `
  MATCH (a:Account)-[:USED_DEVICE|USED_IP]->(shared)
  WITH shared, collect(DISTINCT a.id) AS accountIds
  WHERE size(accountIds) >= $minSharedAccounts
  RETURN labels(shared)[0] AS sharedType, shared.id AS sharedId, accountIds
  LIMIT 200
`;

export function createMuleNetworkRule(config: Partial<MuleNetworkRuleConfig> = {}): DetectionRule {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  return {
    name: 'mule-network',
    description:
      'Multiple accounts sharing a device or IP address, indicating a possible mule network under common control.',
    async run(session) {
      const result = await session.run(CYPHER, { minSharedAccounts: cfg.minSharedAccounts });

      return result.records.map((record) => {
        const accountIds = record.get('accountIds') as string[];
        return {
          ruleName: 'mule-network',
          score: Math.min(1, accountIds.length / (cfg.minSharedAccounts * 3)),
          accountIds,
          transactionIds: [],
          details: {
            sharedType: record.get('sharedType') as string,
            sharedId: record.get('sharedId') as string,
            accountCount: accountIds.length
          }
        };
      });
    }
  };
}

export const muleNetworkRule = createMuleNetworkRule();
