import bcrypt from 'bcryptjs';
import { FastifyInstance } from 'fastify';
import { LoginInputSchema } from '../domain/schemas.js';
import { getPool } from '../db/postgres.js';
import { findUserByUsername } from '../repositories/userRepository.js';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/auth/login',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const parsed = LoginInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'invalid_input', details: parsed.error.flatten() });
      }

      const user = await findUserByUsername(getPool(), parsed.data.username);
      if (!user) {
        return reply.status(401).send({ error: 'invalid_credentials' });
      }

      const passwordOk = await bcrypt.compare(parsed.data.password, user.passwordHash);
      if (!passwordOk) {
        return reply.status(401).send({ error: 'invalid_credentials' });
      }

      const token = await reply.jwtSign(
        { sub: user.id, username: user.username, role: user.role },
        { expiresIn: '8h' }
      );

      return reply.status(200).send({ token });
    }
  );
}
