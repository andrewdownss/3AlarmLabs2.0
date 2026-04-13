import { Server as SocketServer } from 'socket.io';
import type { Server } from 'http';
import { env } from '../config/env.js';
import { socketAuth } from '../middleware/socket-auth.js';
import { registerSessionHandlers } from './session-handler.js';

const allowedOrigins = env.CORS_ORIGIN.split(',').map(s => s.trim());

/** Single-node Socket.io. For multiple API replicas, add the Redis adapter and sticky sessions at the load balancer. */
export function createSocketServer(httpServer: Server) {
	const io = new SocketServer(httpServer, {
		cors: { origin: allowedOrigins, credentials: true },
		path: '/socket.io'
	});

	io.use(socketAuth);

	io.on('connection', (socket) => {
		console.log(`[socket] Client connected: ${socket.id}`);
		registerSessionHandlers(io, socket);

		socket.on('disconnect', () => {
			console.log(`[socket] Client disconnected: ${socket.id}`);
		});
	});

	return io;
}
