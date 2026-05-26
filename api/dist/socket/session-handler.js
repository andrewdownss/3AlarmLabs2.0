import { db } from '../db/index.js';
import { classrooms, trainerSessions, trainerSessionEvents, trainerCommandBoardEntries } from '../db/schema/trainer.js';
import { eq, and } from 'drizzle-orm';
import { getSessionForUser } from '../middleware/authz.js';
import { applyStateDispatch } from '../lib/state-dispatch.js';
import { evaluateAfterBoardChange } from '../lib/self-paced-runtime.js';
function getSocketUserId(socket) {
    return socket.userId;
}
function getSocketParticipantId(socket) {
    return socket.data.participantId;
}
async function loadSessionRow(sessionId) {
    const [row] = await db.select().from(trainerSessions).where(eq(trainerSessions.id, sessionId)).limit(1);
    return row ?? null;
}
async function getSessionAccessForSocket(socket, sessionId) {
    const userId = getSocketUserId(socket);
    const participantId = getSocketParticipantId(socket);
    const session = await loadSessionRow(sessionId);
    if (!session)
        return null;
    if (session.mode !== 'classroom') {
        if (!userId)
            return null;
        const participantSession = await getSessionForUser(sessionId, userId);
        if (!participantSession)
            return null;
        return {
            session,
            isInstructor: participantSession.instructorId === userId,
            isCalledOnParticipant: false
        };
    }
    if (!session.classroomId)
        return null;
    const [classroom] = await db
        .select()
        .from(classrooms)
        .where(eq(classrooms.id, session.classroomId))
        .limit(1);
    if (!classroom || classroom.endedAt)
        return null;
    const isInstructor = Boolean(userId && classroom.instructorId === userId);
    const isCalledOnParticipant = Boolean(participantId &&
        socket.data.classroomId === classroom.id &&
        classroom.calledOnParticipantId === participantId);
    if (!isInstructor && !isCalledOnParticipant)
        return null;
    return { session, isInstructor, isCalledOnParticipant };
}
async function finalizeTrainerSession(io, sessionId, options = {}) {
    const [row] = await db.select().from(trainerSessions).where(eq(trainerSessions.id, sessionId)).limit(1);
    if (!row || row.endedAt)
        return;
    if (options.requireInstructorLed && row.mode !== 'instructor_led')
        return;
    await db.update(trainerSessions).set({ endedAt: new Date() }).where(eq(trainerSessions.id, sessionId));
    await db.insert(trainerSessionEvents).values({
        id: crypto.randomUUID(),
        sessionId,
        eventType: 'session_ended',
        payloadJson: options.payload ?? {}
    });
    io.to(`session:${sessionId}`).emit('trainer:session:ended');
}
function trackTrainerSession(socket, sessionId) {
    const data = socket.data;
    if (!data.trainerSessionIds)
        data.trainerSessionIds = new Set();
    data.trainerSessionIds.add(sessionId);
}
function untrackTrainerSession(socket, sessionId) {
    const ids = socket.data.trainerSessionIds;
    ids?.delete(sessionId);
}
export function registerSessionHandlers(io, socket) {
    socket.on('trainer:session:join', async (data) => {
        const userId = getSocketUserId(socket);
        if (!userId) {
            socket.emit('error', { message: 'Not authenticated' });
            return;
        }
        const session = await getSessionForUser(data.sessionId, userId);
        if (!session) {
            socket.emit('error', { message: 'Session not found or access denied' });
            return;
        }
        socket.join(`session:${data.sessionId}`);
        trackTrainerSession(socket, data.sessionId);
        console.log(`[socket] User ${userId} joined session ${data.sessionId}`);
        const role = session.instructorId === userId ? 'instructor' : 'student';
        if (role === 'student') {
            socket.to(`session:${data.sessionId}`).emit('trainer:student:joined', { userId });
        }
        else if (role === 'instructor') {
            if (session.studentId) {
                socket.emit('trainer:student:joined', { userId: session.studentId });
            }
            if (session.hasStarted) {
                socket.emit('trainer:session:started', { startedAt: session.startedAt.toISOString() });
            }
        }
    });
    socket.on('trainer:session:leave', async (data) => {
        if (!data.sessionId)
            return;
        const userId = getSocketUserId(socket);
        if (!userId)
            return;
        const session = await getSessionForUser(data.sessionId, userId);
        if (!session)
            return;
        await finalizeTrainerSession(io, data.sessionId, {
            requireInstructorLed: true,
            payload: { reason: 'participant_left' }
        });
        socket.leave(`session:${data.sessionId}`);
        untrackTrainerSession(socket, data.sessionId);
    });
    socket.on('trainer:state:dispatch', async (data) => {
        const { sessionId, ...stateUpdate } = data;
        if (!sessionId)
            return;
        const access = await getSessionAccessForSocket(socket, sessionId);
        if (!access)
            return;
        if (access.session.mode === 'classroom' && !access.isInstructor)
            return;
        await applyStateDispatch(io, sessionId, stateUpdate, { source: 'instructor' });
    });
    socket.on('trainer:session:start', async (data) => {
        if (!data.sessionId)
            return;
        const access = await getSessionAccessForSocket(socket, data.sessionId);
        if (!access)
            return;
        if (access.session.mode === 'classroom' && !access.isInstructor)
            return;
        const startedAt = new Date();
        await db.update(trainerSessions).set({ hasStarted: true, startedAt }).where(eq(trainerSessions.id, data.sessionId));
        await db.insert(trainerSessionEvents).values({
            id: crypto.randomUUID(), sessionId: data.sessionId,
            eventType: 'simulation_started', payloadJson: {}
        });
        io.to(`session:${data.sessionId}`).emit('trainer:session:started', { startedAt: startedAt.toISOString() });
    });
    socket.on('trainer:board:assign', async (data) => {
        if (!data.sessionId || !data.unitName || !data.division)
            return;
        const access = await getSessionAccessForSocket(socket, data.sessionId);
        if (!access)
            return;
        const existing = await db.select().from(trainerCommandBoardEntries)
            .where(and(eq(trainerCommandBoardEntries.sessionId, data.sessionId), eq(trainerCommandBoardEntries.unitName, data.unitName))).limit(1);
        let entryId;
        if (existing.length > 0) {
            entryId = existing[0].id;
            await db.update(trainerCommandBoardEntries)
                .set({ division: data.division, assignment: data.assignment ?? '', status: data.status ?? 'Assigned', location: data.division, lastUpdatedAt: new Date() })
                .where(eq(trainerCommandBoardEntries.id, entryId));
        }
        else {
            entryId = crypto.randomUUID();
            await db.insert(trainerCommandBoardEntries).values({
                id: entryId,
                sessionId: data.sessionId,
                division: data.division,
                unitName: data.unitName,
                assignment: data.assignment ?? '',
                location: data.division,
                status: data.status ?? 'Assigned'
            });
        }
        io.to(`session:${data.sessionId}`).emit('trainer:board:updated', {
            entry: { id: entryId, division: data.division, unitName: data.unitName, assignment: data.assignment ?? '', status: data.status ?? 'Assigned' }
        });
        await evaluateAfterBoardChange(io, data.sessionId);
    });
    socket.on('trainer:board:correct', async (data) => {
        if (!data.sessionId || !data.unitName)
            return;
        const access = await getSessionAccessForSocket(socket, data.sessionId);
        if (!access)
            return;
        const actorId = getSocketUserId(socket) ?? getSocketParticipantId(socket) ?? 'unknown';
        const existing = await db.select().from(trainerCommandBoardEntries)
            .where(and(eq(trainerCommandBoardEntries.sessionId, data.sessionId), eq(trainerCommandBoardEntries.unitName, data.unitName))).limit(1);
        const division = data.division?.trim() || existing[0]?.division || 'Unassigned';
        const assignment = data.assignment ?? existing[0]?.assignment ?? '';
        const status = data.status?.trim() || existing[0]?.status || 'Assigned';
        let entryId;
        if (existing.length > 0) {
            entryId = existing[0].id;
            await db.update(trainerCommandBoardEntries)
                .set({ division, assignment, status, location: division, lastUpdatedAt: new Date() })
                .where(eq(trainerCommandBoardEntries.id, entryId));
        }
        else {
            entryId = crypto.randomUUID();
            await db.insert(trainerCommandBoardEntries).values({
                id: entryId,
                sessionId: data.sessionId,
                division,
                unitName: data.unitName,
                assignment,
                location: division,
                status
            });
        }
        await db.insert(trainerSessionEvents).values({
            id: crypto.randomUUID(),
            sessionId: data.sessionId,
            eventType: 'command_board_corrected',
            payloadJson: {
                entryId,
                unitName: data.unitName,
                division,
                assignment,
                status,
                correctedBy: actorId,
                radioMessageId: data.radioMessageId ?? null
            }
        });
        io.to(`session:${data.sessionId}`).emit('trainer:board:updated', {
            entry: { id: entryId, division, unitName: data.unitName, assignment, status }
        });
        await evaluateAfterBoardChange(io, data.sessionId);
    });
    socket.on('trainer:board:remove', async (data) => {
        if (!data.sessionId || !data.unitName)
            return;
        const access = await getSessionAccessForSocket(socket, data.sessionId);
        if (!access)
            return;
        await db.delete(trainerCommandBoardEntries)
            .where(and(eq(trainerCommandBoardEntries.sessionId, data.sessionId), eq(trainerCommandBoardEntries.unitName, data.unitName)));
        io.to(`session:${data.sessionId}`).emit('trainer:board:removed', { unitName: data.unitName });
        await evaluateAfterBoardChange(io, data.sessionId);
    });
    socket.on('trainer:board:update-status', async (data) => {
        if (!data.sessionId || !data.unitName || !data.status)
            return;
        const access = await getSessionAccessForSocket(socket, data.sessionId);
        if (!access)
            return;
        await db.update(trainerCommandBoardEntries)
            .set({ status: data.status, lastUpdatedAt: new Date() })
            .where(and(eq(trainerCommandBoardEntries.sessionId, data.sessionId), eq(trainerCommandBoardEntries.unitName, data.unitName)));
        io.to(`session:${data.sessionId}`).emit('trainer:board:status-changed', {
            unitName: data.unitName,
            status: data.status
        });
        await evaluateAfterBoardChange(io, data.sessionId);
    });
    socket.on('trainer:session:end', async (data) => {
        if (!data.sessionId)
            return;
        const access = await getSessionAccessForSocket(socket, data.sessionId);
        if (!access)
            return;
        if (access.session.mode === 'classroom' && !access.isInstructor)
            return;
        await finalizeTrainerSession(io, data.sessionId, { payload: { reason: 'ended_by_user' } });
        untrackTrainerSession(socket, data.sessionId);
        socket.leave(`session:${data.sessionId}`);
    });
    socket.on('disconnect', async () => {
        const ids = socket.data.trainerSessionIds;
        if (!ids?.size)
            return;
        const sessionIds = [...ids];
        ids.clear();
        for (const sessionId of sessionIds) {
            await finalizeTrainerSession(io, sessionId, {
                requireInstructorLed: true,
                payload: { reason: 'participant_disconnected' }
            });
        }
    });
}
//# sourceMappingURL=session-handler.js.map