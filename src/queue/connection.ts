import { Redis } from 'ioredis';
import { env } from '../config/env.js';

let connection: Redis | undefined;

export function getRedisConnection(): Redis {
  if (!connection) {
    connection = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null, // required by BullMQ for blocking commands
      connectTimeout: 5000,
      retryStrategy: (attempts) => (attempts > 5 ? null : Math.min(attempts * 200, 2000))
    });
  }
  return connection;
}
