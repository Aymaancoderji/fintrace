import { Session } from 'neo4j-driver';
import { TransactionInput } from '../domain/schemas.js';
import { toNumber } from '../utils/neo4jValues.js';

export interface TransactionDetail {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  currency: string;
  timestamp: string;
}

const WRITE_TRANSACTIONS_CYPHER = `
  UNWIND $rows AS row
  MERGE (from:Account {id: row.fromAccountId})
  ON CREATE SET from.createdAt = datetime()
  MERGE (to:Account {id: row.toAccountId})
  ON CREATE SET to.createdAt = datetime()
  MERGE (t:Transaction {id: row.id})
  ON CREATE SET
    t.amount = row.amount,
    t.currency = row.currency,
    t.timestamp = datetime(row.timestamp),
    t.createdAt = datetime()
  MERGE (from)-[:SENT]->(t)
  MERGE (t)-[:RECEIVED_BY]->(to)
`;

/**
 * Writes a batch of transactions in a single Cypher statement, so the cost is
 * one commit per batch instead of one per row — the dominant term in ingestion
 * throughput. Idempotent: every write is a MERGE on a unique id.
 *
 * Rows are sorted by sender so concurrent workers touching the same hot account
 * acquire its lock in a consistent order.
 */
export async function writeTransactions(session: Session, inputs: TransactionInput[]): Promise<void> {
  if (inputs.length === 0) return;

  const rows = [...inputs].sort((a, b) => a.fromAccountId.localeCompare(b.fromAccountId));
  await session.run(WRITE_TRANSACTIONS_CYPHER, { rows });
}

export async function writeTransaction(session: Session, input: TransactionInput): Promise<void> {
  await writeTransactions(session, [input]);
}

export async function getTransactionById(session: Session, id: string): Promise<TransactionDetail | undefined> {
  const result = await session.run(
    `
    MATCH (from:Account)-[:SENT]->(t:Transaction {id: $id})-[:RECEIVED_BY]->(to:Account)
    RETURN t.id AS id, from.id AS fromAccountId, to.id AS toAccountId, t.amount AS amount,
           t.currency AS currency, toString(t.timestamp) AS timestamp
    `,
    { id }
  );

  if (result.records.length === 0) {
    return undefined;
  }

  const record = result.records[0];
  return {
    id: record.get('id') as string,
    fromAccountId: record.get('fromAccountId') as string,
    toAccountId: record.get('toAccountId') as string,
    amount: toNumber(record.get('amount')),
    currency: record.get('currency') as string,
    timestamp: record.get('timestamp') as string
  };
}
