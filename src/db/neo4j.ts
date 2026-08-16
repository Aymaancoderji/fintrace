import neo4j, { Driver, Session } from 'neo4j-driver';
import { env } from '../config/env.js';

let driver: Driver | undefined;

export function getDriver(): Driver {
  if (!driver) {
    driver = neo4j.driver(env.NEO4J_URI, neo4j.auth.basic(env.NEO4J_USER, env.NEO4J_PASSWORD));
  }
  return driver;
}

export function getSession(): Session {
  return getDriver().session();
}

/**
 * Runs `fn` with a session that is always closed afterwards. Preferred over
 * calling {@link getSession} directly — a leaked session holds a connection
 * from the driver's pool for the lifetime of the process.
 */
export async function withSession<T>(fn: (session: Session) => Promise<T>): Promise<T> {
  const session = getSession();
  try {
    return await fn(session);
  } finally {
    await session.close();
  }
}

export async function closeDriver(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = undefined;
  }
}
