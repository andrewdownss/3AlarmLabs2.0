import { eq, and, gt } from 'drizzle-orm';
import { db } from '../db/index.js';
import { classroomParticipants, classrooms, session } from '../db/schema/trainer.js';
import { parseBetterAuthSessionCookieHeader, sessionTokenFromBetterAuthCookieValue } from '../lib/better-auth-session-token.js';
import { CLASSROOM_COOKIE_NAME, verifyClassroomCookieValue } from '../lib/classroom-cookie.js';
import cookie from 'cookie';
async function authenticateClassroomParticipant(header, socket) {
    const parsedCookies = cookie.parse(header);
    const classroomPayload = verifyClassroomCookieValue(parsedCookies[CLASSROOM_COOKIE_NAME]);
    if (!classroomPayload)
        return false;
    const [participant] = await db
        .select({
        id: classroomParticipants.id,
        displayName: classroomParticipants.displayName,
        kickedAt: classroomParticipants.kickedAt,
        classroomEndedAt: classrooms.endedAt
    })
        .from(classroomParticipants)
        .innerJoin(classrooms, eq(classroomParticipants.classroomId, classrooms.id))
        .where(and(eq(classroomParticipants.id, classroomPayload.participantId), eq(classroomParticipants.classroomId, classroomPayload.classroomId)))
        .limit(1);
    if (!participant || participant.kickedAt || participant.classroomEndedAt)
        return false;
    socket.data.role = 'student-anon';
    socket.data.classroomId = classroomPayload.classroomId;
    socket.data.participantId = classroomPayload.participantId;
    socket.data.displayName = participant.displayName;
    return true;
}
export async function socketAuth(socket, next) {
    try {
        const header = socket.handshake.headers.cookie || '';
        const parsed = parseBetterAuthSessionCookieHeader(header);
        if (!parsed) {
            if (await authenticateClassroomParticipant(header, socket))
                return next();
            const parsedCookies = cookie.parse(header);
            const names = Object.keys(parsedCookies).join(', ');
            console.warn(`[socket-auth] No session cookie. Available cookies: [${names}]`);
            return next(new Error('Not authenticated'));
        }
        const { cookieName, raw: token } = parsed;
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
                console.warn(`[socket-auth] Session expired for user ${byToken[0].userId}. ` +
                    `expiresAt=${exp instanceof Date ? exp.toISOString() : exp}, now=${now.toISOString()}`);
            }
            else {
                console.warn(`[socket-auth] No session row for token (first 8: ${sessionToken.slice(0, 8)}…). ` +
                    `Cookie name: ${cookieName}, raw length: ${token.length}, derived length: ${sessionToken.length}`);
            }
            if (await authenticateClassroomParticipant(header, socket))
                return next();
            return next(new Error('Session expired'));
        }
        socket.userId = found[0].userId;
        socket.data.role = 'user';
        // A logged-in browser can still join a public classroom as a named participant.
        // Keep the user identity for instructor checks, but also attach classroom participant data if present.
        await authenticateClassroomParticipant(header, socket);
        socket.data.role = 'user';
        next();
    }
    catch (err) {
        console.error('[socket-auth] Unexpected error:', err);
        next(new Error('Auth error'));
    }
}
//# sourceMappingURL=socket-auth.js.map