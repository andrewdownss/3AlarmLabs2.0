import IORedis from 'ioredis';
import { env } from './env.js';

export const redis = new IORedis.default(env.REDIS_URL, { maxRetriesPerRequest: 3 });

redis.on('error', (err: Error) => console.error('[redis] Connection error:', err));
redis.on('connect', () => console.log('[redis] Connected'));
