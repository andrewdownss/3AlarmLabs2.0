import { browser } from '$app/environment';
import { io, type Socket } from 'socket.io-client';

let socketInstance: Socket | null = null;

export function getTrainerSocket(): Socket | null {
	if (!browser) return null;
	if (socketInstance) return socketInstance;

	socketInstance = io('/', {
		path: '/socket.io',
		withCredentials: true,
		reconnection: true,
		reconnectionAttempts: Infinity,
		reconnectionDelay: 1000,
		reconnectionDelayMax: 5000,
		timeout: 10000
	});

	socketInstance.on('connect', () => {
		console.log('[socket] Connected:', socketInstance?.id);
	});

	socketInstance.on('disconnect', (reason) => {
		console.log('[socket] Disconnected:', reason);
	});

	socketInstance.on('connect_error', (err) => {
		console.error('[socket] Connection error:', err.message);
	});

	return socketInstance;
}
