import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

function parsePoolInt(value: string | undefined, fallback: number) {
	if (value === undefined || value === '') return fallback;
	const n = Number.parseInt(value, 10);
	return Number.isFinite(n) && n > 0 ? n : fallback;
}

const pool = new pg.Pool({
	connectionString: env.DATABASE_URL,
	max: parsePoolInt(process.env.DATABASE_POOL_MAX, 20),
	idleTimeoutMillis: parsePoolInt(process.env.DATABASE_POOL_IDLE_MS, 30_000),
	connectionTimeoutMillis: parsePoolInt(process.env.DATABASE_POOL_CONNECTION_TIMEOUT_MS, 10_000)
});

export const db = drizzle(pool, { schema });
