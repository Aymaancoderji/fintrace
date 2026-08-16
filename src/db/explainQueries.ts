/**
 * Dev tool: runs `EXPLAIN` (plan only, no execution) and `PROFILE` (plan + actual
 * row/db-hit counts) against each detection rule's real Cypher, so you can see
 * whether a rule is doing an index seek vs a full label scan before it's a
 * production problem. Requires a running Neo4j (see NEO4J_URI in .env).
 *
 * Usage: npm run db:explain
 */
import { closeDriver, getSession } from './neo4j.js';
import { CYPHER as STRUCTURING_CYPHER, DEFAULT_CONFIG as structuringConfig } from '../detection/rules/structuring.js';
import { buildCypher as buildCycleCypher, DEFAULT_CONFIG as cycleConfig } from '../detection/rules/cycles.js';
import {
  FAN_OUT_CYPHER,
  FAN_IN_CYPHER,
  DEFAULT_CONFIG as fanConfig
} from '../detection/rules/fanInFanOut.js';
import { CYPHER as MULE_CYPHER, DEFAULT_CONFIG as muleConfig } from '../detection/rules/muleNetwork.js';

const QUERIES: { name: string; cypher: string; params: Record<string, unknown> }[] = [
  {
    name: 'structuring',
    cypher: STRUCTURING_CYPHER,
    params: {
      threshold: structuringConfig.thresholdAmount,
      window: structuringConfig.windowIso,
      minCount: structuringConfig.minTransactionCount
    }
  },
  { name: 'cycle', cypher: buildCycleCypher(cycleConfig), params: {} },
  {
    name: 'fan-out',
    cypher: FAN_OUT_CYPHER,
    params: { window: fanConfig.windowIso, minCounterparties: fanConfig.minDistinctCounterparties }
  },
  {
    name: 'fan-in',
    cypher: FAN_IN_CYPHER,
    params: { window: fanConfig.windowIso, minCounterparties: fanConfig.minDistinctCounterparties }
  },
  { name: 'mule-network', cypher: MULE_CYPHER, params: { minSharedAccounts: muleConfig.minSharedAccounts } }
];

async function explainAndProfile(name: string, cypher: string, params: Record<string, unknown>): Promise<void> {
  const session = getSession();
  try {
    // eslint-disable-next-line no-console
    console.log(`\n=== ${name} ===`);

    const explain = await session.run(`EXPLAIN ${cypher}`, params);
    // eslint-disable-next-line no-console
    console.log('-- EXPLAIN (estimated plan) --');
    printPlan(explain.summary.plan);

    const profile = await session.run(`PROFILE ${cypher}`, params);
    // eslint-disable-next-line no-console
    console.log(`-- PROFILE (actual, ${profile.records.length} rows returned) --`);
    printPlan(profile.summary.profile);
  } finally {
    await session.close();
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function printPlan(plan: any, depth = 0): void {
  if (!plan) return;
  const indent = '  '.repeat(depth);
  const dbHits = plan.dbHits !== undefined ? ` dbHits=${plan.dbHits}` : '';
  const rows = plan.rows !== undefined ? ` rows=${plan.rows}` : '';
  // eslint-disable-next-line no-console
  console.log(`${indent}${plan.operatorType}${dbHits}${rows}`);
  for (const child of plan.children ?? []) {
    printPlan(child, depth + 1);
  }
}

async function main(): Promise<void> {
  try {
    for (const { name, cypher, params } of QUERIES) {
      await explainAndProfile(name, cypher, params);
    }
  } finally {
    await closeDriver();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
