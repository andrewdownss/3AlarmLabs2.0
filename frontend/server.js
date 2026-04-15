import http from 'node:http';
import process from 'node:process';
import httpProxy from 'http-proxy';
import { handler } from './build/handler.js';

process.on('uncaughtException', (err) => {
	console.error('[frontend] uncaughtException', err);
	process.exit(1);
});
process.on('unhandledRejection', (reason) => {
	console.error('[frontend] unhandledRejection', reason);
	process.exit(1);
});

const host = process.env.HOST ?? '0.0.0.0';
const port = parseInt(process.env.PORT ?? '3000', 10);
const apiInternalUrl = process.env.API_INTERNAL_URL ?? 'http://api:4000';

/** `http-proxy` is CJS; use default import under Node ESM (no named exports). */
const apiProxy = httpProxy.createProxyServer({
	target: apiInternalUrl,
	changeOrigin: true,
	ws: true
});

apiProxy.on('error', (err, _req, res) => {
	if (!res || res.headersSent) return;
	res.writeHead(502, { 'Content-Type': 'application/json' });
	res.end(JSON.stringify({ error: 'bad_gateway', message: err.message }));
});

function isSocketIoRequest(url) {
	const pathname = url.split('?')[0] ?? '/';
	return pathname === '/socket.io' || pathname.startsWith('/socket.io/');
}

const server = http.createServer((req, res) => {
	const url = req.url ?? '/';
	if (url.startsWith('/api/trainer/')) {
		apiProxy.web(req, res);
		return;
	}

	// Socket.IO uses HTTP long-polling before upgrade; only proxying `upgrade` yields 404 on GET /socket.io/
	if (isSocketIoRequest(url)) {
		apiProxy.web(req, res);
		return;
	}

	handler(req, res);
});

server.on('upgrade', (req, socket, head) => {
	const url = req.url ?? '/';
	if (isSocketIoRequest(url)) {
		apiProxy.ws(req, socket, head);
		return;
	}

	socket.destroy();
});

server
	.listen(port, host, () => {
		console.log(`[frontend] Listening on http://${host}:${port} (api proxy -> ${apiInternalUrl})`);
	})
	.on('error', (err) => {
		console.error('[frontend] listen error', err);
		process.exit(1);
	});
