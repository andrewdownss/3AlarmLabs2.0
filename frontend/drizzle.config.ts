import { defineConfig } from 'drizzle-kit';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	dialect: 'postgresql',
	dbCredentials: { url: process.env.DATABASE_URL },
	verbose: true,
	// Interactive confirmation (blocks CI/Docker). Enable locally: DRIZZLE_STRICT=true npm run db:push
	strict: process.env.DRIZZLE_STRICT === 'true'
});
