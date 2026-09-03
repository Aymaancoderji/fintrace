import Fastify, { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import authPlugin from './plugins/auth.js';
import metricsPlugin from './plugins/metrics.js';
import { accountRoutes } from './routes/accounts.js';
import { transactionRoutes } from './routes/transactions.js';
import { detectionRoutes } from './routes/detection.js';
import { authRoutes } from './routes/auth.js';
import { caseRoutes } from './routes/cases.js';
import { env } from './config/env.js';
import { openApiDocument } from './docs/openapi.js';

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: true });

  app.register(cors, {
    origin: env.WEB_ORIGIN,
    methods: ['GET', 'POST', 'PATCH'],
    allowedHeaders: ['content-type', 'authorization']
  });
  app.register(multipart, {
    limits: { fileSize: 25 * 1024 * 1024 } // 25MB CSV upload cap
  });
  app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW_MS
  });
  app.register(authPlugin);
  app.register(metricsPlugin);
  app.register(swagger, { mode: 'static', specification: { document: openApiDocument } });
  app.register(swaggerUi, { routePrefix: '/docs' });

  app.get('/health', async () => {
    return { status: 'ok' };
  });

  app.register(authRoutes);
  app.register(accountRoutes);
  app.register(transactionRoutes);
  app.register(detectionRoutes);
  app.register(caseRoutes);

  return app;
}
