import { buildApp } from './app.js';
import { env } from './config/env.js';
import { closeDriver } from './db/neo4j.js';
import { closePool } from './db/postgres.js';

const app = buildApp();

app
  .listen({ port: env.PORT, host: '0.0.0.0' })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });

async function shutdown(): Promise<void> {
  await app.close();
  await closeDriver();
  await closePool();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
