import type { Socket } from 'socket.io';
import { eq, and, gt } from 'drizzle-orm';
import { db } from '../db/index.js';
import { session } from '../db/schema/trainer.js';
import { sessionTokenFromBetterAuthCookieValue } from '../lib/better-auth-session-token.js';
import cookie from 'cookie';

export async function socketAuth(socket: Socket, next: (err?: Error) => void) {
	try {
		const rawCookie = socket.handshake.headers.cookie || '';
		const cookies = cookie.parse(rawCookie);
		const cookieName = cookies['__Secure-better-auth.session_token']
			? '__Secure-better-auth.session_token'
			: cookies['better-auth.session_token']
				? 'better-auth.session_token'
				: null;

		if (!cookieName) {
			const names = Object.keys(cookies).join(', ');
			console.warn(`[socket-auth] No session cookie. Available cookies: [${names}]`);
			return next(new Error('Not authenticated'));
		}

		const token = cookies[cookieName]!;
		const sessionToken = sessionTokenFromBetterAuthCookieValue(token);

		const now = new Date();
		const found = await db.select().from(session)
			.where(and(eq(session.token, sessionToken), gt(session.expiresAt, now)))
			.limit(1);

		if (!found.length) {
			const byToken = await db.select({ expiresAt: session.expiresAt, userId: session.userId })
				.from(session)
				.where(eq(session.token, sessionToken))
				.limit(1);

			if (byToken.length) {
				const exp = byToken[0].expiresAt;
				console.warn(
					`[socket-auth] Session expired for user ${byToken[0].userId}. ` +
					`expiresAt=${exp instanceof Date ? exp.toISOString() : exp}, now=${now.toISOString()}`
				);
			} else {
				console.warn(
					`[socket-auth] No session row for token (first 8: ${sessionToken.slice(0, 8)}…). ` +
					`Cookie name: ${cookieName}, raw length: ${token.length}, derived length: ${sessionToken.length}`
				);
			}
			return next(new Error('Session expired'));
		}

		(socket as any).userId = found[0].userId;
		next();
	} catch (err) {
		console.error('[socket-auth] Unexpected error:', err);
		next(new Error('Auth error'));
	}
}
