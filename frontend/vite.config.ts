import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
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
