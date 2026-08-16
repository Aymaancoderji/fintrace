import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Session } from 'neo4j-driver';
import {
  startNeo4jTestContainer,
  stopNeo4jTestContainer,
  Neo4jTestContext
} from '../testUtils/neo4jTestContainer.js';
import {
  startPostgresTestContainer,
  stopPostgresTestContainer,
  PostgresTestContext
} from '../testUtils/postgresTestContainer.js';
import { writeTransaction } from '../repositories/transactionRepository.js';
import { upsertAccount } from '../repositories/accountRepository.js';
import { runDetection } from './engine.js';
import { listAlerts } from '../repositories/alertRepository.js';
import { getRiskScore, listTopRiskScores } from '../repositories/riskScoreRepository.js';

async function txn(
  session: Session,
  id: string,
  from: string,
  to: string,
  amount: number
): Promise<void> {
  await writeTransaction(session, {
    id,
    fromAccountId: from,
    toAccountId: to,
    amount,
    currency: 'USD',
    timestamp: new Date().toISOString()
  });
}

describe('detection engine (integration)', () => {
  let neo4jCtx: Neo4jTestContext;
  let pgCtx: PostgresTestContext;

  beforeAll(async () => {
    [neo4jCtx, pgCtx] = await Promise.all([startNeo4jTestContainer(), startPostgresTestContainer()]);

    const session = neo4jCtx.driver.session();
    try {
      // Structuring: 4 sub-threshold transfers from one account totalling above the $10k threshold.
      for (let i = 0; i < 4; i++) {
        await txn(session, `struct-txn-${i}`, 'structurer-1', `struct-recipient-${i}`, 3000);
      }

      // Cycle: structurer-free triangle, funds routed back to the originating account.
      await txn(session, 'cycle-txn-1', 'cyc-a', 'cyc-b', 5000);
      await txn(session, 'cycle-txn-2', 'cyc-b', 'cyc-c', 4900);
      await txn(session, 'cycle-txn-3', 'cyc-c', 'cyc-a', 4800);

      // Fan-out: one account sending to 6 distinct counterparties.
      for (let i = 0; i < 6; i++) {
        await txn(session, `fanout-txn-${i}`, 'fanner-1', `fanout-recipient-${i}`, 100);
      }

      // Fan-in: one account receiving from 6 distinct counterparties.
      for (let i = 0; i < 6; i++) {
        await txn(session, `fanin-txn-${i}`, `fanin-sender-${i}`, 'collector-1', 100);
      }

      // Mule network: two otherwise-unrelated accounts sharing a device.
      await upsertAccount(session, { id: 'mule-1', deviceId: 'shared-device-1' });
      await upsertAccount(session, { id: 'mule-2', deviceId: 'shared-device-1' });

      // Clean, unremarkable transaction that should not trip any rule.
      await txn(session, 'clean-txn-1', 'clean-a', 'clean-b', 500);
    } finally {
      await session.close();
    }
  }, 180_000);

  afterAll(async () => {
    await Promise.all([stopNeo4jTestContainer(neo4jCtx), stopPostgresTestContainer(pgCtx)]);
  });

  it('flags each seeded pattern and persists alerts', async () => {
    const session = neo4jCtx.driver.session();
    let result;
    try {
      result = await runDetection(session, pgCtx.pool);
    } finally {
      await session.close();
    }

    const summaryByRule = Object.fromEntries(result.summary.map((s) => [s.rule, s.alertsCreated]));
    expect(summaryByRule.structuring).toBeGreaterThanOrEqual(1);
    expect(summaryByRule.cycle).toBeGreaterThanOrEqual(1);
    expect(summaryByRule['fan-in-fan-out']).toBeGreaterThanOrEqual(2);
    expect(summaryByRule['mule-network']).toBeGreaterThanOrEqual(1);

    const structuringAlerts = await listAlerts(pgCtx.pool, 'structuring');
    expect(structuringAlerts.some((a) => a.accountIds.includes('structurer-1'))).toBe(true);

    const cycleAlerts = await listAlerts(pgCtx.pool, 'cycle');
    expect(cycleAlerts.some((a) => ['cyc-a', 'cyc-b', 'cyc-c'].includes(a.accountIds[0]))).toBe(true);

    const fanAlerts = await listAlerts(pgCtx.pool, 'fan-in-fan-out');
    expect(fanAlerts.some((a) => a.accountIds.includes('fanner-1') && a.details.direction === 'fan-out')).toBe(
      true
    );
    expect(fanAlerts.some((a) => a.accountIds.includes('collector-1') && a.details.direction === 'fan-in')).toBe(
      true
    );

    const muleAlerts = await listAlerts(pgCtx.pool, 'mule-network');
    expect(
      muleAlerts.some((a) => a.accountIds.includes('mule-1') && a.accountIds.includes('mule-2'))
    ).toBe(true);

    const allAlerts = await listAlerts(pgCtx.pool);
    const flaggedAccounts = new Set(allAlerts.flatMap((a) => a.accountIds));
    expect(flaggedAccounts.has('clean-a')).toBe(false);
    expect(flaggedAccounts.has('clean-b')).toBe(false);
  });

  it('computes and persists a risk score for flagged accounts, but not clean ones', async () => {
    const session = neo4jCtx.driver.session();
    try {
      await runDetection(session, pgCtx.pool);
    } finally {
      await session.close();
    }

    const muleScore = await getRiskScore(pgCtx.pool, 'mule-1');
    expect(muleScore).toBeDefined();
    expect(muleScore!.score).toBeGreaterThan(0);
    expect(muleScore!.contributingRules['mule-network']).toBeGreaterThan(0);

    const cleanScore = await getRiskScore(pgCtx.pool, 'clean-a');
    expect(cleanScore).toBeUndefined();

    const top = await listTopRiskScores(pgCtx.pool, 50);
    expect(top.length).toBeGreaterThan(0);
    expect(top).toEqual([...top].sort((a, b) => b.score - a.score));
  });
});
