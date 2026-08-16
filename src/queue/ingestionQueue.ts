import { Queue } from 'bullmq';
import { TransactionInput } from '../domain/schemas.js';
import { getRedisConnection } from './connection.js';

export const INGESTION_QUEUE_NAME = 'transaction-ingestion';

/**
 * Each job carries a batch of transactions so the worker can write them with a
 * single `UNWIND` in one Neo4j commit. A batch of one is the degenerate case
 * used by the single-transaction endpoint.
 */
export type IngestionJob = TransactionInput[];

/** Rows per job: one Neo4j commit and one Redis payload per chunk. */
export const BATCH_SIZE = 500;

/** Jobs per `addBulk` call, so a large upload still pipelines its Redis writes. */
const ENQUEUE_CHUNK_JOBS = 50;

let queue: Queue<IngestionJob> | undefined;

export function getIngestionQueue(): Queue<IngestionJob> {
  if (!queue) {
    queue = new Queue<IngestionJob>(INGESTION_QUEUE_NAME, { connection: getRedisConnection() });
  }
  return queue;
}

const JOB_OPTIONS = { removeOnComplete: 1000, removeOnFail: 1000 } as const;

export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export async function enqueueTransaction(input: TransactionInput): Promise<void> {
  // jobId = transaction id: re-submitting the same transaction id while a job is
  // in flight is deduped by BullMQ; the Neo4j MERGE write is additionally
  // idempotent so re-processing after completion is also safe.
  await getIngestionQueue().add('ingest', [input], { jobId: input.id, ...JOB_OPTIONS });
}

/**
 * Enqueues a batch upload as chunked jobs via `addBulk`, so N rows cost
 * ~N/(BATCH_SIZE*ENQUEUE_CHUNK_JOBS) Redis round trips rather than N.
 *
 * Unlike {@link enqueueTransaction} these jobs get no explicit `jobId`: a batch
 * has no single natural id. Re-uploading the same CSV therefore re-runs the
 * writes, which is harmless because they MERGE on transaction id.
 */
export async function enqueueTransactions(inputs: TransactionInput[]): Promise<number> {
  const batches = chunk(inputs, BATCH_SIZE);
  const jobs = batches.map((batch) => ({ name: 'ingest', data: batch, opts: JOB_OPTIONS }));

  for (const jobChunk of chunk(jobs, ENQUEUE_CHUNK_JOBS)) {
    await getIngestionQueue().addBulk(jobChunk);
  }

  return inputs.length;
}
