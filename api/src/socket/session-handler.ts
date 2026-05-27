import type { Server, Socket } from 'socket.io';
import { db } from '../db/index.js';
import {
	classrooms,
	trainerSessions,
	trainerSessionEvents,
	trainerCommandBoardEntries
} from '../db/schema/trainer.js';
import { eq, and } from 'drizzle-orm';
import { getSessionForUser } from '../middleware/authz.js';
import { applyStateDispatch } from '../lib/state-dispatch.js';
import { evaluateAfterBoardChange } from '../lib/self-paced-runtime.js';
import {
	broadcastBoardState,
	loadBoardState,
	movePersistedBoardEntry,
	persistBoardState
} from '../lib/board-persistence.js';
import {
	applyTaskAssignment,
	clearBoardColumn,
	renameBoardColumn,
	setColumnSupervisor
} from '../services/board-engine.js';

function getSocketUserId(socket: Socket): string | undefined {
	return (socket as Socket & { userId?: string }).userId;
}

function getSocketParticipantId(socket: Socket): string | undefined {
	return socket.data.participantId;
}

interface SessionAccess {
	session: NonNullable<Awaited<ReturnType<typeof loadSessionRow>>>;
	isInstructor: boolean;
	isCalledOnParticipant: boolean;
}

async function loadSessionRow(sessionId: string) {
	const [row] = await db.select().from(trainerSessions).where(eq(trainerSessions.id, sessionId)).limit(1);
	return row ?? null;
}

async function getSessionAccessForSocket(socket: Socket, sessionId: string): Promise<SessionAccess | null> {
	const userId = getSocketUserId(socket);
	const participantId = getSocketParticipantId(socket);
	const session = await loadSessionRow(sessionId);
	if (!session) return null;

	if (session.mode !== 'classroom') {
		if (!userId) return null;
		const participantSession = await getSessionForUser(sessionId, userId);
		if (!participantSession) return null;
		return {
			session,
			isInstructor: participantSession.instructorId === userId,
			isCalledOnParticipant: false
		};
	}

	if (!session.classroomId) return null;
	const [classroom] = await db
		.select()
		.from(classrooms)
		.where(eq(classrooms.id, session.classroomId))
		.limit(1);
	if (!classroom || classroom.endedAt) return null;

	const isInstructor = Boolean(userId && classroom.instructorId === userId);
	const isCalledOnParticipant = Boolean(
		participantId &&
			socket.data.classroomId === classroom.id &&
			classroom.calledOnParticipantId === participantId
	);

	if (!isInstructor && !isCalledOnParticipant) return null;
	return { session, isInstructor, isCalledOnParticipant };
}

interface FinalizeOptions {
	requireInstructorLed?: boolean;
	payload?: Record<string, unknown>;
}

async function finalizeTrainerSession(io: Server, sessionId: string, options: FinalizeOptions = {}) {
	const [row] = await db.select().from(trainerSessions).where(eq(trainerSessions.id, sessionId)).limit(1);
	if (!row || row.endedAt) return;
	if (options.requireInstructorLed && row.mode !== 'instructor_led') return;

	await db.update(trainerSessions).set({ endedAt: new Date() }).where(eq(trainerSessions.id, sessionId));
	await db.insert(trainerSessionEvents).values({
		id: crypto.randomUUID(),
		sessionId,
		eventType: 'session_ended',
		payloadJson: options.payload ?? {}
	});

	io.to(`session:${sessionId}`).emit('trainer:session:ended');
}

function trackTrainerSession(socket: Socket, sessionId: string) {
	const data = socket.data as { trainerSessionIds?: Set<string> };
	if (!data.trainerSessionIds) data.trainerSessionIds = new Set();
	data.trainerSessionIds.add(sessionId);
}

function untrackTrainerSession(socket: Socket, sessionId: string) {
	const ids = (socket.data as { trainerSessionIds?: Set<string> }).trainerSessionIds;
	ids?.delete(sessionId);
}

export function registerSessionHandlers(io: Server, socket: Socket) {
	socket.on('trainer:session:join', async (data: { sessionId: string; role: string }) => {
		const userId = getSocketUserId(socket);
		if (!userId) { socket.emit('error', { message: 'Not authenticated' }); return; }

		const session = await getSessionForUser(data.sessionId, userId);
		if (!session) { socket.emit('error', { message: 'Session not found or access denied' }); return; }

		socket.join(`session:${data.sessionId}`);
		trackTrainerSession(socket, data.sessionId);
		console.log(`[socket] User ${userId} joined session ${data.sessionId}`);

		const role = session.instructorId === userId ? 'instructor' : 'student';
		const boardState = await loadBoardState(data.sessionId);
		socket.emit('trainer:board:snapshot', {
			boardColumns: boardState.columns,
			boardEntries: boardState.entries
		});

		if (role === 'student') {
			socket.to(`session:${data.sessionId}`).emit('trainer:student:joined', { userId });
		} else if (role === 'instructor') {
			if (session.studentId) {
				socket.emit('trainer:student:joined', { userId: session.studentId });
			}
			if (session.hasStarted) {
				socket.emit('trainer:session:started', { startedAt: session.startedAt.toISOString() });
			}
		}
	});

	socket.on('trainer:session:leave', async (data: { sessionId: string }) => {
		if (!data.sessionId) return;
		const userId = getSocketUserId(socket);
		if (!userId) return;
		const session = await getSessionForUser(data.sessionId, userId);
		if (!session) return;

		await finalizeTrainerSession(io, data.sessionId, {
			requireInstructorLed: true,
			payload: { reason: 'participant_left' }
		});
		socket.leave(`session:${data.sessionId}`);
		untrackTrainerSession(socket, data.sessionId);
	});

	socket.on('trainer:state:dispatch', async (data: any) => {
		const { sessionId, ...stateUpdate } = data;
		if (!sessionId) return;
		const access = await getSessionAccessForSocket(socket, sessionId);
		if (!access) return;
		if (access.session.mode === 'classroom' && !access.isInstructor) return;

		await applyStateDispatch(io, sessionId, stateUpdate, { source: 'instructor' });
	});

	socket.on('trainer:session:start', async (data: { sessionId: string }) => {
		if (!data.sessionId) return;
		const access = await getSessionAccessForSocket(socket, data.sessionId);
		if (!access) return;
		if (access.session.mode === 'classroom' && !access.isInstructor) return;

		const startedAt = new Date();
		await db.update(trainerSessions).set({ hasStarted: true, startedAt }).where(eq(trainerSessions.id, data.sessionId));
		await db.insert(trainerSessionEvents).values({
			id: crypto.randomUUID(), sessionId: data.sessionId,
			eventType: 'simulation_started', payloadJson: {}
		});
		io.to(`session:${data.sessionId}`).emit('trainer:session:started', { startedAt: startedAt.toISOString() });
	});

	socket.on('trainer:board:assign', async (data: {
		sessionId: string;
		division: string;
		unitName: string;
		assignment?: string;
		status?: string;
	}) => {
		if (!data.sessionId || !data.unitName || !data.division) return;
		const access = await getSessionAccessForSocket(socket, data.sessionId);
		if (!access) return;

		const state = await loadBoardState(data.sessionId);
		const next = applyTaskAssignment(state.columns, state.entries, {
			unitName: data.unitName,
			assignment: data.assignment ?? '',
			boardColumn: data.division,
			status: data.status ?? 'Assigned'
		});
		await persistBoardState(data.sessionId, next.columns, next.entries);
		broadcastBoardState(io, data.sessionId, next.columns, next.entries);

		await evaluateAfterBoardChange(io, data.sessionId);
	});

	socket.on('trainer:board:correct', async (data: {
		sessionId: string;
		unitName: string;
		division?: string;
		assignment?: string;
		status?: string;
		radioMessageId?: string;
	}) => {
		if (!data.sessionId || !data.unitName) return;
		const access = await getSessionAccessForSocket(socket, data.sessionId);
		if (!access) return;
		const actorId = getSocketUserId(socket) ?? getSocketParticipantId(socket) ?? 'unknown';

		const state = await loadBoardState(data.sessionId);
		const existing = state.entries.find((entry) => entry.unitName.toLowerCase() === data.unitName.toLowerCase());
		const division = data.division?.trim() || existing?.division || 'Working Assignments';
		const assignment = data.assignment ?? existing?.assignment ?? '';
		const status = data.status?.trim() || existing?.status || 'Assigned';
		const next = applyTaskAssignment(state.columns, state.entries, {
			unitName: data.unitName,
			assignment,
			boardColumn: division,
			status
		});
		await persistBoardState(data.sessionId, next.columns, next.entries);
		const entryId = next.entries.find((entry) => entry.unitName.toLowerCase() === data.unitName.toLowerCase())?.id ?? crypto.randomUUID();

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

		broadcastBoardState(io, data.sessionId, next.columns, next.entries);

		await evaluateAfterBoardChange(io, data.sessionId);
	});

	socket.on('trainer:board:remove', async (data: { sessionId: string; unitName: string }) => {
		if (!data.sessionId || !data.unitName) return;
		const access = await getSessionAccessForSocket(socket, data.sessionId);
		if (!access) return;
		await db.delete(trainerCommandBoardEntries)
			.where(and(
				eq(trainerCommandBoardEntries.sessionId, data.sessionId),
				eq(trainerCommandBoardEntries.unitName, data.unitName)
			));
		io.to(`session:${data.sessionId}`).emit('trainer:board:removed', { unitName: data.unitName });
		const state = await loadBoardState(data.sessionId);
		broadcastBoardState(io, data.sessionId, state.columns, state.entries);
		await evaluateAfterBoardChange(io, data.sessionId);
	});

	socket.on('trainer:board:update-status', async (data: { sessionId: string; unitName: string; status: string }) => {
		if (!data.sessionId || !data.unitName || !data.status) return;
		const access = await getSessionAccessForSocket(socket, data.sessionId);
		if (!access) return;
		await db.update(trainerCommandBoardEntries)
			.set({ status: data.status, lastUpdatedAt: new Date() })
			.where(and(
				eq(trainerCommandBoardEntries.sessionId, data.sessionId),
				eq(trainerCommandBoardEntries.unitName, data.unitName)
			));
		io.to(`session:${data.sessionId}`).emit('trainer:board:status-changed', {
			unitName: data.unitName,
			status: data.status
		});
		const state = await loadBoardState(data.sessionId);
		broadcastBoardState(io, data.sessionId, state.columns, state.entries);
		await evaluateAfterBoardChange(io, data.sessionId);
	});

	socket.on('board:set-column-supervisor', async (data: { sessionId: string; slotIndex: number; unitName: string; kind: 'division' | 'group'; label?: string }) => {
		const access = await getSessionAccessForSocket(socket, data.sessionId);
		if (!access?.isInstructor) return;
		const state = await loadBoardState(data.sessionId);
		const columns = setColumnSupervisor(state.columns, data.slotIndex, data.unitName, data.kind, data.label);
		await persistBoardState(data.sessionId, columns, state.entries);
		broadcastBoardState(io, data.sessionId, columns, state.entries);
	});

	socket.on('board:rename-column', async (data: { sessionId: string; slotIndex: number; label: string; kind: 'division' | 'group' }) => {
		const access = await getSessionAccessForSocket(socket, data.sessionId);
		if (!access?.isInstructor) return;
		const state = await loadBoardState(data.sessionId);
		const columns = renameBoardColumn(state.columns, data.slotIndex, data.label, data.kind);
		const slot = columns.find((column) => column.slotIndex === data.slotIndex);
		const entries = state.entries.map((entry) =>
			entry.slotIndex === data.slotIndex && slot ? { ...entry, division: slot.label } : entry
		);
		await persistBoardState(data.sessionId, columns, entries);
		broadcastBoardState(io, data.sessionId, columns, entries);
	});

	socket.on('board:clear-column', async (data: { sessionId: string; slotIndex: number }) => {
		const access = await getSessionAccessForSocket(socket, data.sessionId);
		if (!access?.isInstructor) return;
		const state = await loadBoardState(data.sessionId);
		const next = clearBoardColumn(state.columns, state.entries, data.slotIndex);
		await persistBoardState(data.sessionId, next.columns, next.entries);
		broadcastBoardState(io, data.sessionId, next.columns, next.entries);
		await evaluateAfterBoardChange(io, data.sessionId);
	});

	socket.on('board:move-entry', async (data: { sessionId: string; entryId: string; targetSlotIndex: number }) => {
		const access = await getSessionAccessForSocket(socket, data.sessionId);
		if (!access) return;
		await movePersistedBoardEntry(io, data.sessionId, data.entryId, data.targetSlotIndex);
		await evaluateAfterBoardChange(io, data.sessionId);
	});

	socket.on('trainer:session:end', async (data: { sessionId: string }) => {
		if (!data.sessionId) return;
		const access = await getSessionAccessForSocket(socket, data.sessionId);
		if (!access) return;
		if (access.session.mode === 'classroom' && !access.isInstructor) return;

		await finalizeTrainerSession(io, data.sessionId, { payload: { reason: 'ended_by_user' } });
		untrackTrainerSession(socket, data.sessionId);
		socket.leave(`session:${data.sessionId}`);
	});

	socket.on('disconnect', async () => {
		const ids = (socket.data as { trainerSessionIds?: Set<string> }).trainerSessionIds;
		if (!ids?.size) return;
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
