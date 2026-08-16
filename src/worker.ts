import { closeDriver } from './db/neo4j.js';
import { startIngestionWorker, WORKER_CONCURRENCY } from './queue/ingestionWorker.js';

const worker = startIngestionWorker();

// Logging every ingested row would put a synchronous stdout write inside the
// throughput-critical loop, so progress is aggregated instead.
const PROGRESS_EVERY = 5_000;
let written = 0;
let sinceLastLog = 0;

worker.on('completed', (job) => {
  written += job.data.length;
  sinceLastLog += job.data.length;
  if (sinceLastLog >= PROGRESS_EVERY) {
    sinceLastLog = 0;
    console.log(`[ingestion] ${written} transactions written`);
  }
});

worker.on('failed', (job, err) => {
  console.error(`[ingestion] batch ${job?.id} (${job?.data.length ?? 0} rows) failed:`, err);
});

console.log(`Ingestion worker started (concurrency ${WORKER_CONCURRENCY}).`);

// BullMQ's Worker.close() waits for in-flight jobs to finish before
// releasing the Redis connection, so a container stop doesn't abort a
// batch mid-write.
async function shutdown(): Promise<void> {
  await worker.close();
  await closeDriver();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
