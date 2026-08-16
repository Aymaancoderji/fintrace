import { Job, Worker } from 'bullmq';
import { withSession } from '../db/neo4j.js';
import { writeTransactions } from '../repositories/transactionRepository.js';
import { getRedisConnection } from './connection.js';
import { INGESTION_QUEUE_NAME, IngestionJob } from './ingestionQueue.js';

/**
 * Batches are written to Neo4j concurrently. BullMQ defaults to 1, which makes
 * the whole pipeline serial regardless of queue depth; the driver's connection
 * pool bounds the real parallelism here.
 */
export const WORKER_CONCURRENCY = Number(process.env.INGESTION_CONCURRENCY ?? 8);

export function startIngestionWorker(): Worker<IngestionJob> {
  return new Worker<IngestionJob>(
    INGESTION_QUEUE_NAME,
    async (job: Job<IngestionJob>) => {
      await withSession((session) => writeTransactions(session, job.data));
      return job.data.length;
    },
    { connection: getRedisConnection(), concurrency: WORKER_CONCURRENCY }
  );
}
