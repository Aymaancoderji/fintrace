/**
 * End-to-end load test against a running FinTrace API + worker.
 *
 * Measures the two numbers the project's benchmark deliverable cares about:
 *   1. Ingestion throughput (txns/sec): time from POSTing a synthetic CSV batch
 *      to the BullMQ ingestion queue draining (i.e. every row actually written
 *      to Neo4j by the worker), not just the HTTP response time.
 *   2. Alert query latency: concurrent-load percentiles for GET /alerts via autocannon.
 *
 * Prereqs: `docker compose up -d`, `npm run db:migrate`, `npm run db:migrate:postgres`,
 * `npm run db:seed`, the API (`npm run dev`) and worker (`npm run worker`) running,
 * and a generated CSV (`npm run generate:data`).
 *
 * Usage: npm run load-test -- [csvPath] [baseUrl]
 */
import { readFileSync } from 'node:fs';
import autocannon from 'autocannon';
import { getIngestionQueue } from '../queue/ingestionQueue.js';
import { getRedisConnection } from '../queue/connection.js';

interface LoginResponse {
  token: string;
}

async function login(baseUrl: string): Promise<string> {
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin_dev_password' })
  });
  if (!res.ok) {
    throw new Error(`Login failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as LoginResponse;
  return body.token;
}

async function ingestBatch(baseUrl: string, token: string, csvPath: string): Promise<number> {
  const csv = readFileSync(csvPath);
  const form = new FormData();
  form.append('file', new Blob([csv], { type: 'text/csv' }), 'transactions.csv');

  const start = performance.now();
  const res = await fetch(`${baseUrl}/transactions/batch`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: form
  });
  if (!res.ok) {
    throw new Error(`Batch ingest failed: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { total: number; queued: number; errors: unknown[] };
  const uploadMs = performance.now() - start;
  // eslint-disable-next-line no-console
  console.log(
    `Uploaded ${body.total} rows (${body.queued} queued, ${body.errors.length} rejected) in ${uploadMs.toFixed(0)}ms`
  );
  return body.queued;
}

async function waitForQueueDrain(expectedCount: number, pollIntervalMs = 500, timeoutMs = 10 * 60_000): Promise<number> {
  const queue = getIngestionQueue();
  const start = performance.now();

  while (performance.now() - start < timeoutMs) {
    const counts = await queue.getJobCounts('waiting', 'active', 'delayed');
    const pending = counts.waiting + counts.active + counts.delayed;
    if (pending === 0) {
      return performance.now() - start;
    }
    // eslint-disable-next-line no-console
    console.log(`  draining... ${pending} jobs remaining (of ~${expectedCount})`);
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`Queue did not drain within ${timeoutMs}ms`);
}

async function runDetection(baseUrl: string, token: string): Promise<number> {
  const start = performance.now();
  const res = await fetch(`${baseUrl}/detection/run`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` }
  });
  const elapsed = performance.now() - start;
  if (!res.ok) {
    throw new Error(`Detection run failed: ${res.status} ${await res.text()}`);
  }
  const body = await res.json();
  // eslint-disable-next-line no-console
  console.log(`Detection run: ${JSON.stringify(body)} in ${elapsed.toFixed(0)}ms`);
  return elapsed;
}

async function benchmarkAlertsEndpoint(baseUrl: string, token: string): Promise<void> {
  const result = await autocannon({
    url: `${baseUrl}/alerts`,
    connections: 20,
    duration: 15,
    headers: { authorization: `Bearer ${token}` }
  });
  // eslint-disable-next-line no-console
  console.log('\n=== GET /alerts under load (20 connections, 15s) ===');
  // eslint-disable-next-line no-console
  console.log(`req/sec: avg=${result.requests.average} p99=${result.requests.p99}`);
  // eslint-disable-next-line no-console
  console.log(
    `latency (ms): p50=${result.latency.p50} p95=${result.latency.p97_5} p99=${result.latency.p99}`
  );
  // eslint-disable-next-line no-console
  console.log(`errors: ${result.errors}, timeouts: ${result.timeouts}, non-2xx: ${result.non2xx}`);
}

async function main(): Promise<void> {
  const [csvPathArg, baseUrlArg] = process.argv.slice(2);
  const csvPath = csvPathArg ?? '.data/synthetic-transactions.csv';
  const baseUrl = baseUrlArg ?? 'http://localhost:3000';

  // eslint-disable-next-line no-console
  console.log(`Logging in to ${baseUrl}...`);
  const token = await login(baseUrl);

  // eslint-disable-next-line no-console
  console.log(`Ingesting ${csvPath}...`);
  const queued = await ingestBatch(baseUrl, token, csvPath);

  // eslint-disable-next-line no-console
  console.log('Waiting for ingestion queue to drain (this is the real throughput measurement)...');
  const drainMs = await waitForQueueDrain(queued);
  const txnsPerSec = queued / (drainMs / 1000);
  // eslint-disable-next-line no-console
  console.log(`\n=== Ingestion throughput ===`);
  // eslint-disable-next-line no-console
  console.log(`${queued} transactions written in ${(drainMs / 1000).toFixed(1)}s (${txnsPerSec.toFixed(1)} txns/sec)`);

  await runDetection(baseUrl, token);
  await benchmarkAlertsEndpoint(baseUrl, token);

  await getRedisConnection().quit();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
