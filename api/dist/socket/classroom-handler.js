import { and, count, desc, eq, gt, isNull, lte, or } from 'drizzle-orm';
import { db } from '../db/index.js';
import { classroomParticipants, classrooms, organizations, trainerScenarios, trainerSessionEvents, trainerSessions } from '../db/schema/trainer.js';
import { maxClassroomSeatsForPlan } from '../lib/plan-policy.js';
import { parseSelfPacedConfig } from '../lib/self-paced.js';
import { endSession, runTimelineTick } from '../lib/self-paced-runtime.js';
import { loadBoardState } from '../lib/board-persistence.js';
function getSocketUserId(socket) {
    return socket.userId;
}
function getSocketParticipantId(socket) {
    return socket.data.participantId;
}
function classroomRoom(classroomId) {
    return `classroom:${classroomId}`;
}
function sessionRoom(sessionId) {
    return `session:${sessionId}`;
}
async function loadClassroomForInstructor(classroomId, socket) {
    const userId = getSocketUserId(socket);
    if (!userId)
        return null;
    const [row] = await db
        .select()
        .from(classrooms)
        .where(and(eq(classrooms.id, classroomId), eq(classrooms.instructorId, userId), isNull(classrooms.endedAt)))
        .limit(1);
    return row ?? null;
}
async function loadClassroomForSocket(classroomId, socket) {
    const userId = getSocketUserId(socket);
    if (userId) {
        const [row] = await db
            .select()
            .from(classrooms)
            .where(and(eq(classrooms.id, classroomId), eq(classrooms.instructorId, userId), isNull(classrooms.endedAt)))
            .limit(1);
        if (row)
            return row;
    }
    const participantId = getSocketParticipantId(socket);
    if (!participantId || socket.data.classroomId !== classroomId)
        return null;
    const [participant] = await db
        .select({ id: classroomParticipants.id, classroomEndedAt: classrooms.endedAt, classroom: classrooms })
        .from(classroomParticipants)
        .innerJoin(classrooms, eq(classroomParticipants.classroomId, classrooms.id))
        .where(and(eq(classroomParticipants.id, participantId), eq(classroomParticipants.classroomId, classroomId), isNull(classroomParticipants.kickedAt)))
        .limit(1);
    if (!participant || participant.classroomEndedAt)
        return null;
    return participant.classroom;
}
async function loadParticipants(classroomId) {
    return db
        .select({
        id: classroomParticipants.id,
        displayName: classroomParticipants.displayName,
        lastSeenAt: classroomParticipants.lastSeenAt
    })
        .from(classroomParticipants)
        .where(and(eq(classroomParticipants.classroomId, classroomId), isNull(classroomParticipants.kickedAt)))
        .orderBy(desc(classroomParticipants.lastSeenAt));
}
async function loadSnapshot(classroomId, includeParticipants) {
    const [classroom] = await db.select().from(classrooms).where(eq(classrooms.id, classroomId)).limit(1);
    if (!classroom)
        return null;
    const activeSession = classroom.activeSessionId
        ? (await db.select().from(trainerSessions).where(eq(trainerSessions.id, classroom.activeSessionId)).limit(1))[0] ?? null
        : null;
    const [scenario, boardState, participants] = activeSession
        ? await Promise.all([
            db
                .select()
                .from(trainerScenarios)
                .where(eq(trainerScenarios.id, activeSession.scenarioId))
                .limit(1)
                .then((rows) => rows[0] ?? null),
            loadBoardState(activeSession.id),
            includeParticipants ? loadParticipants(classroomId) : Promise.resolve([])
        ])
        : [null, { columns: [], entries: [] }, includeParticipants ? await loadParticipants(classroomId) : []];
    return {
        classroomId,
        activeSession,
        scenario,
        boardEntries: boardState.entries,
        boardColumns: boardState.columns,
        participants,
        calledOnParticipantId: classroom.calledOnParticipantId,
        useSelfPacedScript: classroom.useSelfPacedScript,
        boardLabelMode: classroom.boardLabelMode
    };
}
async function broadcastParticipants(io, classroomId) {
    io.to(classroomRoom(classroomId)).emit('classroom:participants', {
        participants: await loadParticipants(classroomId)
    });
}
export function registerClassroomHandlers(io, socket) {
    socket.on('classroom:join', async (data) => {
        if (!data.classroomId)
            return;
        const classroom = await loadClassroomForSocket(data.classroomId, socket);
        if (!classroom) {
            socket.emit('classroom:error', { message: 'Classroom not found or access denied.' });
            return;
        }
        const participantId = getSocketParticipantId(socket);
        const isInstructor = classroom.instructorId === getSocketUserId(socket);
        if (participantId) {
            const recentCutoff = new Date(Date.now() - 60_000);
            const activeCount = await db
                .select({ value: count() })
                .from(classroomParticipants)
                .where(and(eq(classroomParticipants.classroomId, classroom.id), isNull(classroomParticipants.kickedAt), gt(classroomParticipants.lastSeenAt, recentCutoff)));
            const maxSeats = Math.min(classroom.maxSeats, maxClassroomSeatsForPlan((await db.query.organizations.findFirst({
                where: eq(organizations.id, classroom.organizationId ?? '')
            }))?.planId) || classroom.maxSeats);
            if ((activeCount[0]?.value ?? 0) > maxSeats) {
                socket.emit('classroom:error', { message: 'This classroom is full.' });
                return;
            }
            await db
                .update(classroomParticipants)
                .set({ lastSeenAt: new Date() })
                .where(eq(classroomParticipants.id, participantId));
        }
        socket.join(classroomRoom(classroom.id));
        if (classroom.activeSessionId)
            socket.join(sessionRoom(classroom.activeSessionId));
        const snapshot = await loadSnapshot(classroom.id, isInstructor);
        socket.emit('classroom:snapshot', snapshot);
        if (!isInstructor) {
            await broadcastParticipants(io, classroom.id);
        }
    });
    socket.on('classroom:heartbeat', async (data) => {
        const participantId = getSocketParticipantId(socket);
        if (!participantId || socket.data.classroomId !== data.classroomId)
            return;
        await db
            .update(classroomParticipants)
            .set({ lastSeenAt: new Date() })
            .where(eq(classroomParticipants.id, participantId));
        await broadcastParticipants(io, data.classroomId);
    });
    socket.on('classroom:load-scenario', async (data) => {
        const classroom = await loadClassroomForInstructor(data.classroomId, socket);
        const userId = getSocketUserId(socket);
        if (!classroom || !userId || !data.scenarioId)
            return;
        const now = new Date();
        const [scenario] = await db
            .select()
            .from(trainerScenarios)
            .where(and(eq(trainerScenarios.id, data.scenarioId), or(classroom.organizationId
            ? eq(trainerScenarios.organizationId, classroom.organizationId)
            : eq(trainerScenarios.createdBy, userId), and(eq(trainerScenarios.isLibrary, true), lte(trainerScenarios.publishedAt, now)))))
            .limit(1);
        if (!scenario) {
            socket.emit('classroom:error', { message: 'Scenario not found.' });
            return;
        }
        if (classroom.activeSessionId) {
            await endSession(io, classroom.activeSessionId, {
                outcome: 'ended',
                reason: 'classroom_scenario_changed',
                payload: { classroomId: classroom.id, scenarioId: data.scenarioId }
            });
            io.to(classroomRoom(classroom.id)).socketsLeave(sessionRoom(classroom.activeSessionId));
        }
        const sessionId = crypto.randomUUID();
        await db.insert(trainerSessions).values({
            id: sessionId,
            scenarioId: scenario.id,
            mode: 'classroom',
            instructorId: userId,
            organizationId: classroom.organizationId,
            classroomId: classroom.id,
            hasStarted: false,
            reviewVisible: false
        });
        await db.insert(trainerSessionEvents).values({
            id: crypto.randomUUID(),
            sessionId,
            eventType: 'classroom_scenario_loaded',
            payloadJson: { classroomId: classroom.id, scenarioId: scenario.id }
        });
        await db
            .update(classrooms)
            .set({ activeSessionId: sessionId, calledOnParticipantId: null })
            .where(eq(classrooms.id, classroom.id));
        io.to(classroomRoom(classroom.id)).socketsJoin(sessionRoom(sessionId));
        const boardState = await loadBoardState(sessionId);
        io.to(classroomRoom(classroom.id)).emit('classroom:scenario-loaded', {
            session: {
                id: sessionId,
                scenarioId: scenario.id,
                activeStage: 'incipient',
                activeSide: 'alpha',
                hasStarted: false,
                startedAt: null
            },
            scenario,
            boardEntries: boardState.entries,
            boardColumns: boardState.columns
        });
    });
    socket.on('classroom:start-scenario', async (data) => {
        const classroom = await loadClassroomForInstructor(data.classroomId, socket);
        if (!classroom?.activeSessionId)
            return;
        const now = new Date();
        const [existing] = await db
            .select({
            hasStarted: trainerSessions.hasStarted,
            scenarioId: trainerSessions.scenarioId
        })
            .from(trainerSessions)
            .where(eq(trainerSessions.id, classroom.activeSessionId))
            .limit(1);
        if (!existing || existing.hasStarted)
            return;
        await db
            .update(trainerSessions)
            .set({ hasStarted: true, startedAt: now })
            .where(eq(trainerSessions.id, classroom.activeSessionId));
        await db.insert(trainerSessionEvents).values({
            id: crypto.randomUUID(),
            sessionId: classroom.activeSessionId,
            eventType: 'classroom_scenario_started',
            payloadJson: { classroomId: classroom.id }
        });
        io.to(classroomRoom(classroom.id)).emit('classroom:scenario-started', {
            sessionId: classroom.activeSessionId,
            startedAt: now
        });
        const [scenarioRow] = await db
            .select({ config: trainerScenarios.selfPacedConfigJson })
            .from(trainerScenarios)
            .where(eq(trainerScenarios.id, existing.scenarioId))
            .limit(1);
        if (classroom.useSelfPacedScript && parseSelfPacedConfig(scenarioRow?.config ?? null)) {
            await runTimelineTick(io, classroom.activeSessionId, now);
        }
    });
    socket.on('classroom:save-session', async (data) => {
        const classroom = await loadClassroomForInstructor(data.classroomId, socket);
        if (!classroom?.activeSessionId)
            return;
        await db
            .update(trainerSessions)
            .set({ reviewVisible: true })
            .where(eq(trainerSessions.id, classroom.activeSessionId));
        await db.insert(trainerSessionEvents).values({
            id: crypto.randomUUID(),
            sessionId: classroom.activeSessionId,
            eventType: 'classroom_session_saved',
            payloadJson: { classroomId: classroom.id }
        });
        socket.emit('classroom:session-saved', { sessionId: classroom.activeSessionId });
    });
    socket.on('classroom:end-scenario', async (data) => {
        const classroom = await loadClassroomForInstructor(data.classroomId, socket);
        if (!classroom?.activeSessionId)
            return;
        await endSession(io, classroom.activeSessionId, {
            outcome: 'ended',
            reason: 'classroom_scenario_ended',
            payload: { classroomId: classroom.id }
        });
        io.to(classroomRoom(classroom.id)).socketsLeave(sessionRoom(classroom.activeSessionId));
        await broadcastParticipants(io, classroom.id);
    });
    socket.on('classroom:end', async (data, ack) => {
        const classroom = await loadClassroomForInstructor(data.classroomId, socket);
        if (!classroom) {
            ack?.({ success: false });
            return;
        }
        if (classroom.activeSessionId) {
            await endSession(io, classroom.activeSessionId, {
                outcome: 'ended',
                reason: 'classroom_ended',
                payload: { classroomId: classroom.id }
            });
            io.to(classroomRoom(classroom.id)).socketsLeave(sessionRoom(classroom.activeSessionId));
        }
        await db
            .update(classrooms)
            .set({ endedAt: new Date(), activeSessionId: null, calledOnParticipantId: null })
            .where(eq(classrooms.id, classroom.id));
        io.to(classroomRoom(classroom.id)).emit('classroom:ended');
        ack?.({ success: true });
    });
    socket.on('classroom:call-on', async (data) => {
        const classroom = await loadClassroomForInstructor(data.classroomId, socket);
        if (!classroom || !data.participantId)
            return;
        const [participant] = await db
            .select({ id: classroomParticipants.id })
            .from(classroomParticipants)
            .where(and(eq(classroomParticipants.id, data.participantId), eq(classroomParticipants.classroomId, classroom.id), isNull(classroomParticipants.kickedAt)))
            .limit(1);
        if (!participant)
            return;
        await db
            .update(classrooms)
            .set({ calledOnParticipantId: participant.id })
            .where(eq(classrooms.id, classroom.id));
        io.to(classroomRoom(classroom.id)).emit('classroom:control-changed', {
            calledOnParticipantId: participant.id
        });
    });
    socket.on('classroom:stand-down', async (data) => {
        const classroom = await loadClassroomForInstructor(data.classroomId, socket);
        if (!classroom)
            return;
        await db
            .update(classrooms)
            .set({ calledOnParticipantId: null })
            .where(eq(classrooms.id, classroom.id));
        io.to(classroomRoom(classroom.id)).emit('classroom:control-changed', {
            calledOnParticipantId: null
        });
    });
    socket.on('classroom:kick', async (data) => {
        const classroom = await loadClassroomForInstructor(data.classroomId, socket);
        if (!classroom || !data.participantId)
            return;
        await db
            .update(classroomParticipants)
            .set({ kickedAt: new Date() })
            .where(and(eq(classroomParticipants.id, data.participantId), eq(classroomParticipants.classroomId, classroom.id)));
        if (classroom.calledOnParticipantId === data.participantId) {
            await db
                .update(classrooms)
                .set({ calledOnParticipantId: null })
                .where(eq(classrooms.id, classroom.id));
            io.to(classroomRoom(classroom.id)).emit('classroom:control-changed', {
                calledOnParticipantId: null
            });
        }
        for (const socketId of await io.in(classroomRoom(classroom.id)).allSockets()) {
            const target = io.sockets.sockets.get(socketId);
            if (target?.data.participantId === data.participantId) {
                target.emit('classroom:kicked');
                target.disconnect(true);
            }
        }
        await broadcastParticipants(io, classroom.id);
    });
}
//# sourceMappingURL=classroom-handler.js.map