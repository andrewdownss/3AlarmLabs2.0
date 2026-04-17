import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	// Monorepo: `.env` lives next to `frontend/` (see repo `.env.example`).
	envDir: path.resolve(__dirname, '..'),
	plugins: [tailwindcss(), sveltekit()],
	server: {
		// Dev-only: browser calls same origin, Vite forwards to the API. In production, prefer a single
		// host (e.g. reverse proxy `/socket.io` and `/api/trainer` → API) so the client avoids extra DNS/TLS hops.
		proxy: {
			'/socket.io': {
				target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:4000',
				ws: true
			},
			'/api/trainer': {
				target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:4000'
			}
		}
	}
});
