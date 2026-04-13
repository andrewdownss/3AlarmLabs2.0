import { rateLimit } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redis } from '../config/redis.js';
const sendCommand = (command, ...args) => redis.call(command, ...args);
/** 100 req/min per IP across all /api/trainer/* routes */
export const globalLimiter = rateLimit({
    windowMs: 60_000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({ sendCommand, prefix: 'rl:global:' })
});
/** 10 req/min per authenticated user for the radio (OpenAI) endpoint */
export const radioLimiter = rateLimit({
    windowMs: 60_000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.userId ?? req.ip ?? 'unknown',
    store: new RedisStore({ sendCommand, prefix: 'rl:radio:' })
});
//# sourceMappingURL=rate-limit.js.map