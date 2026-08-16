import { FastifyInstance } from 'fastify';
import { TransactionInput, TransactionInputSchema } from '../domain/schemas.js';
import { enqueueTransaction, enqueueTransactions } from '../queue/ingestionQueue.js';
import { parseTransactionCsv } from '../utils/csv.js';
import { parseOrReply, notFound } from '../utils/httpValidation.js';
import { withSession } from '../db/neo4j.js';
import { getTransactionById } from '../repositories/transactionRepository.js';

const MAX_BATCH_ROWS = 50_000;

export async function transactionRoutes(app: FastifyInstance): Promise<void> {
  app.get('/transactions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const transaction = await withSession((session) => getTransactionById(session, id));
    return transaction ? reply.status(200).send(transaction) : notFound(reply);
  });

  app.post('/transactions', async (request, reply) => {
    const input = parseOrReply(TransactionInputSchema, request.body, reply);
    if (!input) return reply;

    await enqueueTransaction(input);
    return reply.status(202).send({ id: input.id, status: 'queued' });
  });

  app.post('/transactions/batch', async (request, reply) => {
    const file = await request.file();
    if (!file) {
      return reply.status(400).send({ error: 'missing_file', details: 'Upload a CSV file as multipart field.' });
    }

    const buffer = await file.toBuffer();
    let rows: Record<string, string>[];
    try {
      rows = parseTransactionCsv(buffer);
    } catch (err) {
      return reply.status(400).send({ error: 'invalid_csv', details: (err as Error).message });
    }

    if (rows.length > MAX_BATCH_ROWS) {
      return reply
        .status(413)
        .send({ error: 'batch_too_large', details: `Max ${MAX_BATCH_ROWS} rows per batch.` });
    }

    const errors: { row: number; details: unknown }[] = [];
    const valid: TransactionInput[] = [];

    for (const [index, row] of rows.entries()) {
      const parsed = TransactionInputSchema.safeParse(row);
      if (parsed.success) {
        valid.push(parsed.data);
      } else {
        errors.push({ row: index + 1, details: parsed.error.flatten() });
      }
    }

    // Enqueued as chunked batches in bulk — one Redis round trip per chunk of
    // jobs rather than one per row.
    const queued = await enqueueTransactions(valid);

    return reply.status(202).send({ total: rows.length, queued, errors });
  });
}
