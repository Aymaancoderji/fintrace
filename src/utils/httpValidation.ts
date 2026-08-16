import { FastifyReply } from 'fastify';
import { z } from 'zod';

/**
 * Validates `data` against `schema`, sending the app's standard 400 envelope and
 * returning `undefined` on failure. Keeps the error contract in one place rather
 * than re-spelling it at every route.
 *
 *   const body = parseOrReply(CaseCreateSchema, request.body, reply);
 *   if (!body) return reply;
 */
export function parseOrReply<T extends z.ZodType>(
  schema: T,
  data: unknown,
  reply: FastifyReply
): z.infer<T> | undefined {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    reply.status(400).send({ error: 'invalid_input', details: parsed.error.flatten() });
    return undefined;
  }
  return parsed.data;
}

export function notFound(reply: FastifyReply): FastifyReply {
  return reply.status(404).send({ error: 'not_found' });
}
