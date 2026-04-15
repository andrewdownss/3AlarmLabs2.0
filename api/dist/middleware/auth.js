import { eq, and, gt } from 'drizzle-orm';
import { db } from '../db/index.js';
import { session } from '../db/schema/trainer.js';
import { parseBetterAuthSessionCookieHeader, sessionTokenFromBetterAuthCookieValue } from '../lib/better-auth-session-token.js';
export async function requireAuth(req, res, next) {
    try {
        const parsed = parseBetterAuthSessionCookieHeader(req.headers.cookie);
        if (!parsed) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }
        const sessionToken = sessionTokenFromBetterAuthCookieValue(parsed.raw);
        const found = await db.select().from(session)
            .where(and(eq(session.token, sessionToken), gt(session.expiresAt, new Date())))
            .limit(1);
        if (!found.length) {
            res.status(401).json({ error: 'Session expired' });
            return;
        }
        req.userId = found[0].userId;
        next();
    }
    catch (err) {
        console.error('[auth] Error:', err);
        res.status(500).json({ error: 'Auth error' });
    }
}
//# sourceMappingURL=auth.js.map