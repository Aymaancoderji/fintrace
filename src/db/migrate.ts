import { closeDriver, getSession } from './neo4j.js';
import { initSchema } from './schema.js';

async function main(): Promise<void> {
  const session = getSession();
  try {
    await initSchema(session);
    // eslint-disable-next-line no-console
    console.log('Neo4j schema (constraints + indexes) applied.');
  } finally {
    await session.close();
    await closeDriver();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
