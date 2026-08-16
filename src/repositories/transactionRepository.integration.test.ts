import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startNeo4jTestContainer, stopNeo4jTestContainer, Neo4jTestContext } from '../testUtils/neo4jTestContainer.js';
import { writeTransaction } from './transactionRepository.js';
import { upsertAccount } from './accountRepository.js';

describe('transactionRepository (integration)', () => {
  let ctx: Neo4jTestContext;

  beforeAll(async () => {
    ctx = await startNeo4jTestContainer();
  }, 120_000);

  afterAll(async () => {
    await stopNeo4jTestContainer(ctx);
  });

  it('writing the same transaction twice is idempotent', async () => {
    const session = ctx.driver.session();
    try {
      const input = {
        id: 'txn-idempotent-1',
        fromAccountId: 'acct-a',
        toAccountId: 'acct-b',
        amount: 500,
        currency: 'USD',
        timestamp: '2026-08-14T12:00:00Z'
      };

      await writeTransaction(session, input);
      await writeTransaction(session, input);

      const result = await session.run('MATCH (t:Transaction {id: $id}) RETURN count(t) AS count', {
        id: input.id
      });
      expect(result.records[0].get('count').toNumber()).toBe(1);

      const rel = await session.run(
        `
        MATCH (from:Account {id: $fromId})-[:SENT]->(t:Transaction {id: $id})-[:RECEIVED_BY]->(to:Account {id: $toId})
        RETURN count(t) AS count
        `,
        { fromId: input.fromAccountId, toId: input.toAccountId, id: input.id }
      );
      expect(rel.records[0].get('count').toNumber()).toBe(1);
    } finally {
      await session.close();
    }
  });

  it('links an account to its owning entity', async () => {
    const session = ctx.driver.session();
    try {
      await upsertAccount(session, { id: 'acct-owned', entityId: 'entity-1', entityName: 'Jane Doe' });

      const result = await session.run(
        `MATCH (e:Entity {id: $entityId})-[:OWNS]->(a:Account {id: $accountId}) RETURN e.name AS name`,
        { entityId: 'entity-1', accountId: 'acct-owned' }
      );
      expect(result.records).toHaveLength(1);
      expect(result.records[0].get('name')).toBe('Jane Doe');
    } finally {
      await session.close();
    }
  });

  it('links an account to a shared device and IP address', async () => {
    const session = ctx.driver.session();
    try {
      await upsertAccount(session, { id: 'acct-device-1', deviceId: 'device-xyz', ipAddress: '10.0.0.1' });

      const result = await session.run(
        `
        MATCH (a:Account {id: $accountId})-[:USED_DEVICE]->(d:Device {id: $deviceId})
        MATCH (a)-[:USED_IP]->(ip:IpAddress {id: $ip})
        RETURN d.id AS deviceId, ip.id AS ipId
        `,
        { accountId: 'acct-device-1', deviceId: 'device-xyz', ip: '10.0.0.1' }
      );
      expect(result.records).toHaveLength(1);
    } finally {
      await session.close();
    }
  });
});
