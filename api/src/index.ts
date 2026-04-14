import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { env } from './config/env.js';
import { requireAuth } from './middleware/auth.js';
import scenariosRouter from './routes/scenarios.js';
import { createSessionsRouter } from './routes/sessions.js';
import { createRadioRouter } from './routes/radio.js';
import { createSocketServer } from './socket/index.js';

const app = express();
const httpServer = createServer(app);

const allowedOrigins = env.CORS_ORIGIN.split(',').map(s => s.trim());
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

const io = createSocketServer(httpServer);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/trainer/scenarios', requireAuth, scenariosRouter);
app.use('/api/trainer/sessions', requireAuth, createSessionsRouter(io));
app.use('/api/trainer/radio', requireAuth, createRadioRouter(io));

const port = parseInt(env.API_PORT, 10);
httpServer.listen(port, () => {
	console.log(`[api] Listening on port ${port}`);
});
