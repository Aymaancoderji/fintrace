import 'dotenv/config';
import { z } from 'zod';

const DEV_JWT_SECRET = 'fintrace_dev_secret_do_not_use_in_prod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  NEO4J_URI: z.string().min(1).default('bolt://localhost:7687'),
  NEO4J_USER: z.string().min(1).default('neo4j'),
  NEO4J_PASSWORD: z.string().min(1).default('fintrace_dev'),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  DATABASE_URL: z.string().min(1).default('postgres://fintrace:fintrace_dev@localhost:5432/fintrace'),
  // Dev-only default. Always set a real secret via env in any shared/deployed environment.
  JWT_SECRET: z.string().min(1).default(DEV_JWT_SECRET),
  RATE_LIMIT_MAX: z.coerce.number().default(300),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
  WEB_ORIGIN: z.string().min(1).default('http://localhost:5173')
});

export const env = EnvSchema.parse(process.env);

if (env.NODE_ENV === 'production' && env.JWT_SECRET === DEV_JWT_SECRET) {
  throw new Error('JWT_SECRET must be set to a real secret when NODE_ENV=production.');
}
