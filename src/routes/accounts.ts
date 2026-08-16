import { FastifyInstance } from 'fastify';
import { AccountInputSchema } from '../domain/schemas.js';
import { getSession } from '../db/neo4j.js';
import { getPool } from '../db/postgres.js';
import { getAccountById, upsertAccount } from '../repositories/accountRepository.js';
import { getAccountSubgraph } from '../repositories/subgraphRepository.js';
import { getRiskScore, listTopRiskScores } from '../repositories/riskScoreRepository.js';

export async function accountRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.authenticate);

  app.post('/accounts', async (request, reply) => {
    const parsed = AccountInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid_input', details: parsed.error.flatten() });
    }

    const session = getSession();
    try {
      await upsertAccount(session, parsed.data);
    } finally {
      await session.close();
    }

    return reply.status(201).send({ id: parsed.data.id, status: 'created' });
  });

  app.get('/accounts/risk', async (request, reply) => {
    const query = request.query as { limit?: string };
    const limit = query.limit ? Number(query.limit) : undefined;
    const scores = await listTopRiskScores(getPool(), limit);
    return reply.status(200).send({ scores });
  });

  app.get('/accounts/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const session = getSession();
    try {
      const account = await getAccountById(session, id);
      if (!account) {
        return reply.status(404).send({ error: 'not_found' });
      }
      return reply.status(200).send(account);
    } finally {
      await session.close();
    }
  });

  app.get('/accounts/:id/subgraph', async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as { depth?: string };
    const depth = query.depth ? Number(query.depth) : 2;

    const session = getSession();
    try {
      const subgraph = await getAccountSubgraph(session, id, depth);
      if (!subgraph) {
        return reply.status(404).send({ error: 'not_found' });
      }
      return reply.status(200).send(subgraph);
    } finally {
      await session.close();
    }
  });

  app.get('/accounts/:id/risk', async (request, reply) => {
    const { id } = request.params as { id: string };
    const score = await getRiskScore(getPool(), id);
    if (!score) {
      return reply.status(404).send({ error: 'not_found' });
    }
    return reply.status(200).send(score);
  });
}
