import { Neo4jContainer, StartedNeo4jContainer } from '@testcontainers/neo4j';
import neo4j, { Driver } from 'neo4j-driver';
import { initSchema } from '../db/schema.js';

export interface Neo4jTestContext {
  container: StartedNeo4jContainer;
  driver: Driver;
}

export async function startNeo4jTestContainer(): Promise<Neo4jTestContext> {
  const container = await new Neo4jContainer('neo4j:5-community').withPassword('fintrace_test').start();
  const driver = neo4j.driver(container.getBoltUri(), neo4j.auth.basic('neo4j', container.getPassword()));

  const session = driver.session();
  try {
    await initSchema(session);
  } finally {
    await session.close();
  }

  return { container, driver };
}

export async function stopNeo4jTestContainer(ctx: Neo4jTestContext): Promise<void> {
  await ctx.driver.close();
  await ctx.container.stop();
}
