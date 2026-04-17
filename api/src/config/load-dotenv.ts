import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Loads `.env` from the monorepo root, then `api/.env`, so `npm run dev` in `api/`
 * picks up the same vars as the frontend without manual export.
 */
export function loadDotenv(): void {
	const here = dirname(fileURLToPath(import.meta.url));
	const apiRoot = resolve(here, '../..');
	const repoRoot = resolve(here, '../../..');

	const rootEnv = resolve(repoRoot, '.env');
	const apiEnv = resolve(apiRoot, '.env');

	if (existsSync(rootEnv)) config({ path: rootEnv });
	if (existsSync(apiEnv)) config({ path: apiEnv, override: true });
}
