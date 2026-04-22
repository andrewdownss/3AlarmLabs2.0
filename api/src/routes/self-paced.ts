import { Router } from 'express';
import { z } from 'zod';
import { and, eq, isNull, lte, sql } from 'drizzle-orm';
import type { Server } from 'socket.io';
import { db } from '../db/index.js';
import {
	trainerScenarios,
	trainerScheduledEvents,
	trainerSessionEvents,
	trainerSessions,
	trainerRadioMessages,
	trainerCommandBoardEntries
} from '../db/schema/trainer.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { getSessionForUser } from '../middleware/authz.js';
import { parseSelfPacedConfig, simulationElapsedMs } from '../lib/self-paced.js';
import {
	endSession,
	evaluateAfterBoardChange,
	runTimelineTick
} from '../lib/self-paced-runtime.js';

export function createSelfPacedRouter(io: Server) {
	const router = Router();

	router.post('/:id/start', async (req: AuthenticatedRequest, res) => {
		const id = String(req.params.id);
		const session = await getSessionForUser(id, req.userId!);
		if (!session) { res.status(404).json({ error: 'Not found' }); return; }
		if (session.endedAt) { res.status(409).json({ error: 'Session already ended' }); return; }

		const startedAt = new Date();
		if (!session.hasStarted) {
			await db
				.update(trainerSessions)
				.set({ hasStarted: true, startedAt, accumulatedPauseMs: 0, pausedAt: null })
				.where(eq(trainerSessions.id, id));
			await db.insert(trainerSessionEvents).values({
				id: crypto.randomUUID(),
				sessionId: id,
				eventType: 'simulation_started',
				payloadJson: { startedAt: startedAt.toISOString() }
			});
			io.to(`session:${id}`).emit('trainer:session:started', { startedAt: startedAt.toISOString() });
		}

		// Trigger an immediate tick so any 0-second timeline events fire.
		await runTimelineTick(io, id);

		res.json({ success: true, startedAt: (session.hasStarted ? session.startedAt : startedAt).toISOString() });
	});

	router.post('/:id/pause', async (req: AuthenticatedRequest, res) => {
		const id = String(req.params.id);
		const session = await getSessionForUser(id, req.userId!);
		if (!session) { res.status(404).json({ error: 'Not found' }); return; }
		if (!session.hasStarted || session.endedAt) {
			res.status(409).json({ error: 'Session not active' }); return;
		}
		if (session.pausedAt) { res.json({ success: true, alreadyPaused: true }); return; }

		const pausedAt = new Date();
		await db.update(trainerSessions).set({ pausedAt }).where(eq(trainerSessions.id, id));
		await db.insert(trainerSessionEvents).values({
			id: crypto.randomUUID(),
			sessionId: id,
			eventType: 'session_paused',
			payloadJson: { pausedAt: pausedAt.toISOString() }
		});
		io.to(`session:${id}`).emit('trainer:session:paused', { pausedAt: pausedAt.toISOString() });
		res.json({ success: true });
	});

	router.post('/:id/resume', async (req: AuthenticatedRequest, res) => {
		const id = String(req.params.id);
		const session = await getSessionForUser(id, req.userId!);
		if (!session) { res.status(404).json({ error: 'Not found' }); return; }
		if (!session.hasStarted || session.endedAt) {
			res.status(409).json({ error: 'Session not active' }); return;
		}
		if (!session.pausedAt) { res.json({ success: true, alreadyRunning: true }); return; }

		const now = new Date();
		const delta = Math.max(0, now.getTime() - session.pausedAt.getTime());

		// Push out scheduled assignment-completion fires by the pause duration so
		// the authored delay still feels right after a long pause.
		await db
			.update(trainerScheduledEvents)
			.set({ fireAt: sql`${trainerScheduledEvents.fireAt} + (${delta} || ' milliseconds')::interval` })
			.where(
				and(
					eq(trainerScheduledEvents.sessionId, id),
					isNull(trainerScheduledEvents.firedAt)
				)
			);

		await db
			.update(trainerSessions)
			.set({
				pausedAt: null,
				accumulatedPauseMs: sql`${trainerSessions.accumulatedPauseMs} + ${delta}`
			})
			.where(eq(trainerSessions.id, id));
		await db.insert(trainerSessionEvents).values({
			id: crypto.randomUUID(),
			sessionId: id,
			eventType: 'session_resumed',
			payloadJson: { resumedAt: now.toISOString(), pausedMs: delta }
		});
		io.to(`session:${id}`).emit('trainer:session:resumed', { resumedAt: now.toISOString() });
		res.json({ success: true });
	});

	router.post('/:id/tick', async (req: AuthenticatedRequest, res) => {
		const id = String(req.params.id);
		const session = await getSessionForUser(id, req.userId!);
		if (!session) { res.status(404).json({ error: 'Not found' }); return; }
		if (!session.hasStarted || session.endedAt) {
			res.json({ skipped: true, reason: session.endedAt ? 'ended' : 'not_started' });
			return;
		}
		await runTimelineTick(io, id);
		const elapsedMs = simulationElapsedMs(
			{
				hasStarted: session.hasStarted,
				startedAt: session.startedAt,
				pausedAt: session.pausedAt,
				accumulatedPauseMs: session.accumulatedPauseMs ?? 0
			}
		);
		res.json({ elapsedMs, paused: Boolean(session.pausedAt) });
	});

	const endBodySchema = z.object({
		outcome: z.enum(['completed', 'failed', 'timeout']).default('completed'),
		reason: z.string().min(1).max(200).default('ended_by_user')
	});

	router.post('/:id/end', async (req: AuthenticatedRequest, res) => {
		const id = String(req.params.id);
		const session = await getSessionForUser(id, req.userId!);
		if (!session) { res.status(404).json({ error: 'Not found' }); return; }
		const parsed = endBodySchema.safeParse(req.body ?? {});
		if (!parsed.success) { res.status(400).json({ error: parsed.error }); return; }
		await endSession(io, id, parsed.data);
		res.json({ success: true });
	});

	const correctBodySchema = z.object({
		unitName: z.string().trim().min(1),
		division: z.string().trim().min(1).optional(),
		assignment: z.string().max(400).optional(),
		status: z.string().trim().min(1).optional(),
		radioMessageId: z.string().min(1).optional()
	});

	router.post('/:id/board/correct', async (req: AuthenticatedRequest, res) => {
		const id = String(req.params.id);
		const session = await getSessionForUser(id, req.userId!);
		if (!session) { res.status(404).json({ error: 'Not found' }); return; }
		const parsed = correctBodySchema.safeParse(req.body ?? {});
		if (!parsed.success) { res.status(400).json({ error: parsed.error }); return; }

		const data = parsed.data;
		const existing = await db
			.select()
			.from(trainerCommandBoardEntries)
			.where(and(
				eq(trainerCommandBoardEntries.sessionId, id),
				eq(trainerCommandBoardEntries.unitName, data.unitName)
			))
			.limit(1);

		const division = data.division ?? existing[0]?.division ?? 'Unassigned';
		const assignment = data.assignment ?? existing[0]?.assignment ?? '';
		const status = data.status ?? existing[0]?.status ?? 'Assigned';

		let entryId: string;
		if (existing.length > 0) {
			entryId = existing[0].id;
			await db.update(trainerCommandBoardEntries)
				.set({ division, assignment, status, location: division, lastUpdatedAt: new Date() })
				.where(eq(trainerCommandBoardEntries.id, entryId));
		} else {
			entryId = crypto.randomUUID();
			await db.insert(trainerCommandBoardEntries).values({
				id: entryId,
				sessionId: id,
				division,
				unitName: data.unitName,
				assignment,
				location: division,
				status
			});
		}

		await db.insert(trainerSessionEvents).values({
			id: crypto.randomUUID(),
			sessionId: id,
			eventType: 'command_board_corrected',
			payloadJson: {
				entryId,
				unitName: data.unitName,
				division,
				assignment,
				status,
				correctedBy: req.userId,
				radioMessageId: data.radioMessageId ?? null
			}
		});

		if (data.radioMessageId) {
			await db
				.update(trainerRadioMessages)
				.set({
					instructorCorrectionJson: {
						correctedBy: 'student',
						correctedByUserId: req.userId,
						entry: { unitName: data.unitName, division, assignment, status }
					}
				})
				.where(
					and(
						eq(trainerRadioMessages.id, data.radioMessageId),
						eq(trainerRadioMessages.sessionId, id)
					)
				);
		}

		io.to(`session:${id}`).emit('trainer:board:updated', {
			entry: { id: entryId, division, unitName: data.unitName, assignment, status }
		});

		await evaluateAfterBoardChange(io, id);
		res.json({ success: true, entry: { id: entryId, division, unitName: data.unitName, assignment, status } });
	});

	router.get('/:id/state', async (req: AuthenticatedRequest, res) => {
		const id = String(req.params.id);
		const session = await getSessionForUser(id, req.userId!);
		if (!session) { res.status(404).json({ error: 'Not found' }); return; }
		const [scenarioRow] = await db
			.select({ config: trainerScenarios.selfPacedConfigJson })
			.from(trainerScenarios)
			.where(eq(trainerScenarios.id, session.scenarioId))
			.limit(1);
		const config = parseSelfPacedConfig(scenarioRow?.config ?? null);
		const elapsedMs = simulationElapsedMs(
			{
				hasStarted: session.hasStarted,
				startedAt: session.startedAt,
				pausedAt: session.pausedAt,
				accumulatedPauseMs: session.accumulatedPauseMs ?? 0
			}
		);
		res.json({
			hasStarted: session.hasStarted,
			pausedAt: session.pausedAt,
			elapsedMs,
			endedAt: session.endedAt,
			config
		});
	});

	return router;
}

/**
 * Background poller that ticks every active self-paced session and fires
 * any due assignment-completion follow-ups. Single-process, single-node;
 * for multi-replica deployments wrap with a Postgres advisory lock.
 */
export function startSelfPacedPoller(io: Server, intervalMs = 2000): NodeJS.Timeout {
	const tick = async () => {
		try {
			const now = new Date();
			const dueScheduled = await db
				.selectDistinct({ sessionId: trainerScheduledEvents.sessionId })
				.from(trainerScheduledEvents)
				.where(
					and(
						isNull(trainerScheduledEvents.firedAt),
						lte(trainerScheduledEvents.fireAt, now)
					)
				);

			const activeRows = await db
				.select({ id: trainerSessions.id })
				.from(trainerSessions)
				.where(
					and(eq(trainerSessions.hasStarted, true), isNull(trainerSessions.endedAt))
				);

			const sessionIds = new Set<string>([
				...dueScheduled.map((r) => r.sessionId),
				...activeRows.map((r) => r.id)
			]);

			for (const sessionId of sessionIds) {
				try {
					await runTimelineTick(io, sessionId, now);
				} catch (err) {
					console.error(`[self-paced] tick failed for ${sessionId}:`, err);
				}
			}
		} catch (err) {
			console.error('[self-paced] poller error:', err);
		}
	};
	void tick();
	return setInterval(tick, intervalMs);
}
