import { z } from 'zod';
import { loadDotenv } from './load-dotenv.js';

loadDotenv();

const envSchema = z.object({
	API_PORT: z.string().default('4000'),
	/** Prefer this for the trainer API pool; if unset, `DATABASE_URL` is used (same DB in local dev). */
	TRAINER_DATABASE_URL: z.string().optional(),
	DATABASE_URL: z.string().optional(),
	REDIS_URL: z.string().default('redis://localhost:6379'),
	OPENAI_API_KEY: z.string().optional(),
	UPLOADTHING_TOKEN: z.string().optional(),
	CORS_ORIGIN: z.string().default('http://localhost:5173,http://localhost'),
	/** Optional overrides for pg.Pool (same names as frontend DATABASE_POOL_*). */
	DATABASE_POOL_MAX: z.string().optional(),
	DATABASE_POOL_IDLE_MS: z.string().optional(),
	DATABASE_POOL_CONNECTION_TIMEOUT_MS: z.string().optional()
});

const parsed = envSchema.parse(process.env);
const trainerDatabaseUrl = parsed.TRAINER_DATABASE_URL || parsed.DATABASE_URL;
if (!trainerDatabaseUrl?.trim()) {
	throw new Error(
		'Missing database URL: set TRAINER_DATABASE_URL or DATABASE_URL (see repo .env.example)'
	);
}

export const env = { ...parsed, TRAINER_DATABASE_URL: trainerDatabaseUrl };
