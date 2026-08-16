import { FastifyInstance } from 'fastify';
import { withSession } from '../db/neo4j.js';
import { getPool } from '../db/postgres.js';
import { runDetection } from '../detection/engine.js';
import { listAlerts } from '../repositories/alertRepository.js';
import { PaginationQuerySchema } from '../domain/schemas.js';
import { parseOrReply } from '../utils/httpValidation.js';

export async function detectionRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.authenticate);

  app.post('/detection/run', { preHandler: app.requireRole('admin') }, async (_request, reply) => {
    const result = await withSession((session) => runDetection(session, getPool()));
    return reply.status(200).send(result);
  });

  app.get('/alerts', async (request, reply) => {
    const query = request.query as { rule?: string };
    const pagination = parseOrReply(PaginationQuerySchema, request.query, reply);
    if (!pagination) return reply;

    const alerts = await listAlerts(getPool(), query.rule, pagination);
    return reply.status(200).send({ alerts, limit: pagination.limit, offset: pagination.offset });
  });
}
