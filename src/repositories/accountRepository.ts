import { ManagedTransaction, Session } from 'neo4j-driver';
import { AccountInput } from '../domain/schemas.js';

export interface AccountDetail {
  id: string;
  createdAt: string;
  entityId: string | null;
  entityName: string | null;
}

export async function upsertAccount(session: Session, input: AccountInput): Promise<void> {
  await session.executeWrite(async (tx: ManagedTransaction) => {
    await tx.run(
      `
      MERGE (a:Account {id: $id})
      ON CREATE SET a.createdAt = datetime()
      `,
      { id: input.id }
    );

    if (input.entityId) {
      await tx.run(
        `
        MATCH (a:Account {id: $id})
        MERGE (e:Entity {id: $entityId})
        ON CREATE SET e.name = $entityName, e.createdAt = datetime()
        MERGE (e)-[:OWNS]->(a)
        `,
        { id: input.id, entityId: input.entityId, entityName: input.entityName ?? null }
      );
    }

    if (input.deviceId) {
      await tx.run(
        `
        MATCH (a:Account {id: $id})
        MERGE (d:Device {id: $deviceId})
        MERGE (a)-[:USED_DEVICE]->(d)
        `,
        { id: input.id, deviceId: input.deviceId }
      );
    }

    if (input.ipAddress) {
      await tx.run(
        `
        MATCH (a:Account {id: $id})
        MERGE (ip:IpAddress {id: $ipAddress})
        MERGE (a)-[:USED_IP]->(ip)
        `,
        { id: input.id, ipAddress: input.ipAddress }
      );
    }
  });
}

export async function getAccountById(session: Session, id: string): Promise<AccountDetail | undefined> {
  const result = await session.run(
    `
    MATCH (a:Account {id: $id})
    OPTIONAL MATCH (e:Entity)-[:OWNS]->(a)
    RETURN a.id AS id, toString(a.createdAt) AS createdAt, e.id AS entityId, e.name AS entityName
    `,
    { id }
  );

  if (result.records.length === 0) {
    return undefined;
  }

  const record = result.records[0];
  return {
    id: record.get('id') as string,
    createdAt: record.get('createdAt') as string,
    entityId: (record.get('entityId') as string | null) ?? null,
    entityName: (record.get('entityName') as string | null) ?? null
  };
}
