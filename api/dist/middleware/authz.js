import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { trainerSessions } from '../db/schema/trainer.js';
function isParticipant(session, userId) {
    return session.instructorId === userId || session.studentId === userId;
}
/**
 * Load a session and verify the given user is a participant (instructor or student).
 * Returns the session row if authorised, or null if not found / not allowed.
 */
export async function getSessionForUser(sessionId, userId) {
    const [row] = await db.select().from(trainerSessions)
        .where(eq(trainerSessions.id, sessionId))
        .limit(1);
    if (!row)
        return null;
    if (!isParticipant(row, userId))
        return null;
    return row;
}
//# sourceMappingURL=authz.js.map