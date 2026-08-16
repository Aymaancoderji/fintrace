import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';

const { Pool } = pg;

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'db', 'migrations');

export interface PostgresTestContext {
  container: StartedPostgreSqlContainer;
  pool: pg.Pool;
}

export async function startPostgresTestContainer(): Promise<PostgresTestContext> {
  const container = await new PostgreSqlContainer('postgres:16-alpine').start();
  const pool = new Pool({ connectionString: container.getConnectionUri() });

  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf-8');
    await pool.query(sql);
  }

  return { container, pool };
}

export async function stopPostgresTestContainer(ctx: PostgresTestContext): Promise<void> {
  await ctx.pool.end();
  await ctx.container.stop();
}
