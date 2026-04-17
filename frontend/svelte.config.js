import path from 'node:path';
import { fileURLToPath } from 'node:url';
import adapter from '@sveltejs/adapter-node';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		// `$env/*` uses `loadEnv(mode, kit.env.dir)` — not Vite's `envDir`. Monorepo `.env` is next to `frontend/`.
		env: { dir: path.resolve(__dirname, '..') },
		adapter: adapter(),
		alias: {
			$components: 'src/lib/components',
			$server: 'src/lib/server'
		}
	}
};

export default config;
