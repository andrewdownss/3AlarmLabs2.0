import { z } from 'zod';

const envSchema = z.object({
	API_PORT: z.string().default('4000'),
	TRAINER_DATABASE_URL: z.string(),
	REDIS_URL: z.string().default('redis://localhost:6379'),
	OPENAI_API_KEY: z.string().optional(),
	UPLOADTHING_TOKEN: z.string().optional(),
	CORS_ORIGIN: z.string().default('http://localhost:5173,http://localhost'),
	/** Optional overrides for pg.Pool (same names as frontend DATABASE_POOL_*). */
	DATABASE_POOL_MAX: z.string().optional(),
	DATABASE_POOL_IDLE_MS: z.string().optional(),
	DATABASE_POOL_CONNECTION_TIMEOUT_MS: z.string().optional()
});

export const env = envSchema.parse(process.env);
