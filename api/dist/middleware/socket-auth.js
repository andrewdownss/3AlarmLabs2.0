import { eq, and, gt } from 'drizzle-orm';
import { db } from '../db/index.js';
import { session } from '../db/schema/trainer.js';
import cookie from 'cookie';
export async function socketAuth(socket, next) {
    try {
        const cookies = cookie.parse(socket.handshake.headers.cookie || '');
        const token = cookies['better-auth.session_token'] || cookies['__Secure-better-auth.session_token'];
        if (!token)
            return next(new Error('Not authenticated'));
        const sessionToken = token.split('.')[0];
        const found = await db.select().from(session)
            .where(and(eq(session.token, sessionToken), gt(session.expiresAt, new Date())))
            .limit(1);
        if (!found.length)
            return next(new Error('Session expired'));
        socket.userId = found[0].userId;
        next();
    }
    catch (err) {
        next(new Error('Auth error'));
    }
}
//# sourceMappingURL=socket-auth.js.map