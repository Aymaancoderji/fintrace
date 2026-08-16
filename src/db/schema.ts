import { Session } from 'neo4j-driver';

const CONSTRAINTS_AND_INDEXES = [
  'CREATE CONSTRAINT account_id_unique IF NOT EXISTS FOR (a:Account) REQUIRE a.id IS UNIQUE',
  'CREATE CONSTRAINT transaction_id_unique IF NOT EXISTS FOR (t:Transaction) REQUIRE t.id IS UNIQUE',
  'CREATE CONSTRAINT entity_id_unique IF NOT EXISTS FOR (e:Entity) REQUIRE e.id IS UNIQUE',
  'CREATE CONSTRAINT device_id_unique IF NOT EXISTS FOR (d:Device) REQUIRE d.id IS UNIQUE',
  'CREATE CONSTRAINT ip_address_id_unique IF NOT EXISTS FOR (ip:IpAddress) REQUIRE ip.id IS UNIQUE',
  'CREATE INDEX transaction_timestamp IF NOT EXISTS FOR (t:Transaction) ON (t.timestamp)',
  'CREATE INDEX transaction_amount IF NOT EXISTS FOR (t:Transaction) ON (t.amount)',
  // Composite index for range queries filtering on both fields together (e.g. a future
  // "transactions in window under amount" lookup) — cheaper than intersecting two single-
  // property index scans. The detection rules themselves traverse from Account via SENT/
  // RECEIVED_BY rather than seeking Transaction by these properties, so this index doesn't
  // change their plans; see src/db/explainQueries.ts for how to verify that with PROFILE.
  'CREATE INDEX transaction_timestamp_amount IF NOT EXISTS FOR (t:Transaction) ON (t.timestamp, t.amount)'
];

export async function initSchema(session: Session): Promise<void> {
  for (const statement of CONSTRAINTS_AND_INDEXES) {
    await session.run(statement);
  }
}
