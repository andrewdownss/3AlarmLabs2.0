import http from 'node:http';
import process from 'node:process';
import { createProxyServer } from 'http-proxy';
import { handler } from './build/handler.js';

const port = parseInt(process.env.PORT ?? '3000', 10);
const apiInternalUrl = process.env.API_INTERNAL_URL ?? 'http://api:4000';

const apiProxy = createProxyServer({
	target: apiInternalUrl,
	changeOrigin: true,
	ws: true
});

apiProxy.on('error', (err, _req, res) => {
	if (!res || res.headersSent) return;
	res.writeHead(502, { 'Content-Type': 'application/json' });
	res.end(JSON.stringify({ error: 'bad_gateway', message: err.message }));
});

const server = http.createServer((req, res) => {
	const url = req.url ?? '/';
	if (url.startsWith('/api/trainer/')) {
		apiProxy.web(req, res);
		return;
	}

	handler(req, res);
});

server.on('upgrade', (req, socket, head) => {
	const url = req.url ?? '/';
	if (url.startsWith('/socket.io/')) {
		apiProxy.ws(req, socket, head);
		return;
	}

	socket.destroy();
});

server.listen(port, () => {
	console.log(`[frontend] Listening on port ${port} (api proxy -> ${apiInternalUrl})`);
});

