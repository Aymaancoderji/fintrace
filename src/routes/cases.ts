import { FastifyInstance } from 'fastify';
import { CaseCreateSchema, CaseNoteInputSchema, CaseUpdateSchema, PaginationQuerySchema } from '../domain/schemas.js';
import { getPool } from '../db/postgres.js';
import { addCaseNote, createCase, getCaseById, listCaseNotes, listCases, updateCase } from '../repositories/caseRepository.js';

export async function caseRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.authenticate);

  app.post('/cases', async (request, reply) => {
    const parsed = CaseCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid_input', details: parsed.error.flatten() });
    }

    const created = await createCase(getPool(), parsed.data);
    return reply.status(201).send(created);
  });

  app.get('/cases', async (request, reply) => {
    const query = request.query as { status?: string; limit?: string; offset?: string };
    const pagination = PaginationQuerySchema.safeParse(query);
    if (!pagination.success) {
      return reply.status(400).send({ error: 'invalid_input', details: pagination.error.flatten() });
    }

    const cases = await listCases(getPool(), query.status, pagination.data);
    return reply.status(200).send({ cases, limit: pagination.data.limit, offset: pagination.data.offset });
  });

  app.get('/cases/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const found = await getCaseById(getPool(), id);
    if (!found) {
      return reply.status(404).send({ error: 'not_found' });
    }
    const notes = await listCaseNotes(getPool(), id);
    return reply.status(200).send({ ...found, notes });
  });

  app.patch('/cases/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = CaseUpdateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid_input', details: parsed.error.flatten() });
    }

    const updated = await updateCase(getPool(), id, parsed.data);
    if (!updated) {
      return reply.status(404).send({ error: 'not_found' });
    }
    return reply.status(200).send(updated);
  });

  app.post('/cases/:id/notes', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = CaseNoteInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid_input', details: parsed.error.flatten() });
    }

    const existing = await getCaseById(getPool(), id);
    if (!existing) {
      return reply.status(404).send({ error: 'not_found' });
    }

    const note = await addCaseNote(getPool(), id, request.user.username, parsed.data.body);
    return reply.status(201).send(note);
  });
}
