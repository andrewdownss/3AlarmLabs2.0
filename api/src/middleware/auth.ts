import type { Request, Response, NextFunction } from 'express';
import { eq, and, gt } from 'drizzle-orm';
import { db } from '../db/index.js';
import { session } from '../db/schema/trainer.js';
import { sessionTokenFromBetterAuthCookieValue } from '../lib/better-auth-session-token.js';
import cookie from 'cookie';

export interface AuthenticatedRequest extends Request {
	userId?: string;
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
	try {
		const cookies = cookie.parse(req.headers.cookie || '');
		const token = cookies['better-auth.session_token'] || cookies['__Secure-better-auth.session_token'];

		if (!token) {
			res.status(401).json({ error: 'Not authenticated' });
			return;
		}

		const sessionToken = sessionTokenFromBetterAuthCookieValue(token);

		const found = await db.select().from(session)
			.where(and(eq(session.token, sessionToken), gt(session.expiresAt, new Date())))
			.limit(1);

		if (!found.length) {
			res.status(401).json({ error: 'Session expired' });
			return;
		}

		req.userId = found[0].userId;
		next();
	} catch (err) {
		console.error('[auth] Error:', err);
		res.status(500).json({ error: 'Auth error' });
	}
}
