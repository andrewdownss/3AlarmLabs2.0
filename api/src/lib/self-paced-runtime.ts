/**
 * Self-paced timeline runtime — pure-ish helpers that operate on a session
 * snapshot + scenario config. Stateful side effects (DB writes, broadcasts)
 * happen here so callers (HTTP routes, the background poller, the socket
 * handler) all share one code path.
 */

import type { Server } from 'socket.io';
import { and, asc, eq, isNull, lte } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
	trainerCommandBoardEntries,
	trainerScenarios,
	trainerScheduledEvents,
	trainerSessionEvents,
	trainerSessions
} from '../db/schema/trainer.js';
import {
	matchesAssignment,
	parseSelfPacedConfig,
	simulationElapsedMs,
	type AssignmentCompletionRule,
	type ExpectedAction,
	type SelfPacedConfig,
	type SimulationOutcome,
	type SimulationTimingFields
} from './self-paced.js';
import { applyStateDispatch } from './state-dispatch.js';

export interface RuntimeSession extends SimulationTimingFields {
	id: string;
	scenarioId: string;
	endedAt: Date | null;
	simulationOutcome: SimulationOutcome;
}

async function loadSession(sessionId: string): Promise<RuntimeSession | null> {
	const [row] = await db
		.select({
			id: trainerSessions.id,
			scenarioId: trainerSessions.scenarioId,
			hasStarted: trainerSessions.hasStarted,
			startedAt: trainerSessions.startedAt,
			pausedAt: trainerSessions.pausedAt,
			accumulatedPauseMs: trainerSessions.accumulatedPauseMs,
			endedAt: trainerSessions.endedAt,
			simulationOutcome: trainerSessions.simulationOutcome
		})
		.from(trainerSessions)
		.where(eq(trainerSessions.id, sessionId))
		.limit(1);
	return row ?? null;
}

async function loadConfig(scenarioId: string): Promise<SelfPacedConfig | null> {
	const [row] = await db
		.select({ config: trainerScenarios.selfPacedConfigJson })
		.from(trainerScenarios)
		.where(eq(trainerScenarios.id, scenarioId))
		.limit(1);
	return parseSelfPacedConfig(row?.config ?? null);
}

async function loadDispatchedTimelineIds(sessionId: string): Promise<Set<string>> {
	const rows = await db
		.select({ payloadJson: trainerSessionEvents.payloadJson })
		.from(trainerSessionEvents)
		.where(
			and(
				eq(trainerSessionEvents.sessionId, sessionId),
				eq(trainerSessionEvents.eventType, 'timeline_event_dispatched')
			)
		);
	const out = new Set<string>();
	for (const r of rows) {
		const id = (r.payloadJson as { ruleId?: unknown } | null)?.ruleId;
		if (typeof id === 'string') out.add(id);
	}
	return out;
}

async function loadCompletedExpectedIds(sessionId: string): Promise<Set<string>> {
	const rows = await db
		.select({ payloadJson: trainerSessionEvents.payloadJson, eventType: trainerSessionEvents.eventType })
		.from(trainerSessionEvents)
		.where(eq(trainerSessionEvents.sessionId, sessionId));
	const out = new Set<string>();
	for (const r of rows) {
		if (r.eventType === 'expected_action_completed' || r.eventType === 'expected_action_delayed') {
			const id = (r.payloadJson as { actionId?: unknown } | null)?.actionId;
			if (typeof id === 'string') out.add(id);
		}
	}
	return out;
}

async function loadScheduledRuleIds(sessionId: string): Promise<Set<string>> {
	const rows = await db
		.select({ ruleId: trainerScheduledEvents.ruleId })
		.from(trainerScheduledEvents)
		.where(
			and(
				eq(trainerScheduledEvents.sessionId, sessionId),
				eq(trainerScheduledEvents.kind, 'assignment_completion')
			)
		);
	const out = new Set<string>();
	for (const r of rows) if (r.ruleId) out.add(r.ruleId);
	return out;
}

/**
 * Runs every scripted check that depends on simulation time:
 * - timeline events whose offset has passed
 * - assignment-completion fires whose `fireAt` has passed
 * - missed expected-action deadlines
 * - time-limit timeout
 *
 * Idempotent — safe to call from a tick endpoint or background poller.
 */
export async function runTimelineTick(io: Server, sessionId: string, now: Date = new Date()): Promise<void> {
	const session = await loadSession(sessionId);
	if (!session || session.endedAt || !session.hasStarted || session.pausedAt) return;

	const config = await loadConfig(session.scenarioId);
	if (!config) return;

	const elapsedMs = simulationElapsedMs(session, now);
	const elapsedSec = Math.floor(elapsedMs / 1000);

	await dispatchDueTimelineEvents(io, session, config, elapsedSec);
	await fireDueScheduledEvents(io, session, now);
	await flagMissedExpectedActions(sessionId, config, elapsedSec);

	if (
		config.endConditions.onTimeExpired &&
		typeof config.timeLimitSeconds === 'number' &&
		elapsedSec >= config.timeLimitSeconds
	) {
		await endSession(io, sessionId, { outcome: 'timeout', reason: 'time_limit_reached' });
	} else if (
		config.endConditions.onTimelineComplete &&
		config.timeline.length > 0 &&
		elapsedSec >=
			config.timeline.reduce((max, t) => Math.max(max, t.offsetSeconds), 0) &&
		(await dispatchedAllTimelineIds(sessionId, config))
	) {
		await endSession(io, sessionId, { outcome: 'completed', reason: 'timeline_complete' });
	}
}

async function dispatchedAllTimelineIds(sessionId: string, config: SelfPacedConfig): Promise<boolean> {
	const dispatched = await loadDispatchedTimelineIds(sessionId);
	return config.timeline.every((t) => dispatched.has(t.id));
}

async function dispatchDueTimelineEvents(
	io: Server,
	session: RuntimeSession,
	config: SelfPacedConfig,
	elapsedSec: number
): Promise<void> {
	if (config.timeline.length === 0) return;
	const dispatched = await loadDispatchedTimelineIds(session.id);
	const due = config.timeline
		.filter((t) => !dispatched.has(t.id) && t.offsetSeconds <= elapsedSec)
		.sort((a, b) => a.offsetSeconds - b.offsetSeconds);

	for (const event of due) {
		await applyStateDispatch(io, session.id, event.dispatch, {
			source: 'timeline',
			ruleId: event.id
		});
	}
}

async function fireDueScheduledEvents(io: Server, session: RuntimeSession, now: Date): Promise<void> {
	const due = await db
		.select()
		.from(trainerScheduledEvents)
		.where(
			and(
				eq(trainerScheduledEvents.sessionId, session.id),
				isNull(trainerScheduledEvents.firedAt),
				lte(trainerScheduledEvents.fireAt, now)
			)
		)
		.orderBy(asc(trainerScheduledEvents.fireAt));

	for (const row of due) {
		await db
			.update(trainerScheduledEvents)
			.set({ firedAt: new Date() })
			.where(eq(trainerScheduledEvents.id, row.id));

		if (row.kind === 'assignment_completion') {
			const dispatch = (row.payloadJson as { dispatch?: unknown } | null)?.dispatch;
			if (dispatch && typeof dispatch === 'object') {
				await applyStateDispatch(io, session.id, dispatch as Record<string, never>, {
					source: 'completion',
					ruleId: row.ruleId ?? undefined
				});
			}
		} else if (row.kind === 'force_end') {
			await endSession(io, session.id, { outcome: 'failed', reason: 'force_end' });
		}
	}
}

async function flagMissedExpectedActions(
	sessionId: string,
	config: SelfPacedConfig,
	elapsedSec: number
): Promise<void> {
	if (config.expectedActions.length === 0) return;
	const completed = await loadCompletedExpectedIds(sessionId);
	const flagged = await loadFlaggedMissedIds(sessionId);

	for (const action of config.expectedActions) {
		if (completed.has(action.id) || flagged.has(action.id)) continue;
		if (typeof action.deadlineSeconds !== 'number') continue;
		if (elapsedSec < action.deadlineSeconds) continue;

		await db.insert(trainerSessionEvents).values({
			id: crypto.randomUUID(),
			sessionId,
			eventType: 'expected_action_missed',
			payloadJson: {
				actionId: action.id,
				label: action.label,
				deadlineSeconds: action.deadlineSeconds,
				atSeconds: elapsedSec
			}
		});
	}
}

async function loadFlaggedMissedIds(sessionId: string): Promise<Set<string>> {
	const rows = await db
		.select({ payloadJson: trainerSessionEvents.payloadJson })
		.from(trainerSessionEvents)
		.where(
			and(
				eq(trainerSessionEvents.sessionId, sessionId),
				eq(trainerSessionEvents.eventType, 'expected_action_missed')
			)
		);
	const out = new Set<string>();
	for (const r of rows) {
		const id = (r.payloadJson as { actionId?: unknown } | null)?.actionId;
		if (typeof id === 'string') out.add(id);
	}
	return out;
}

/**
 * Hook called whenever a board entry changes (radio assignment, manual fix,
 * etc). Evaluates expected actions and schedules any newly-triggered
 * assignment-completion follow-ups.
 */
export async function evaluateAfterBoardChange(io: Server, sessionId: string): Promise<void> {
	const session = await loadSession(sessionId);
	if (!session || session.endedAt) return;
	const config = await loadConfig(session.scenarioId);
	if (!config) return;

	const board = await db
		.select({
			unitName: trainerCommandBoardEntries.unitName,
			assignment: trainerCommandBoardEntries.assignment
		})
		.from(trainerCommandBoardEntries)
		.where(eq(trainerCommandBoardEntries.sessionId, sessionId));

	const elapsedMs = simulationElapsedMs(session);
	const elapsedSec = Math.floor(elapsedMs / 1000);

	await markExpectedActionsFromBoard(sessionId, config.expectedActions, board, elapsedSec);
	await scheduleAssignmentCompletions(sessionId, config.assignmentCompletions, board, new Date());

	void io;
}

async function markExpectedActionsFromBoard(
	sessionId: string,
	actions: ExpectedAction[],
	board: Array<{ unitName: string; assignment: string | null }>,
	elapsedSec: number
): Promise<void> {
	if (actions.length === 0 || board.length === 0) return;
	const completed = await loadCompletedExpectedIds(sessionId);

	for (const action of actions) {
		if (completed.has(action.id)) continue;
		const hit = board.find((b) => matchesAssignment(action.match, b));
		if (!hit) continue;

		const isLate =
			typeof action.deadlineSeconds === 'number' && elapsedSec > action.deadlineSeconds;

		await db.insert(trainerSessionEvents).values({
			id: crypto.randomUUID(),
			sessionId,
			eventType: isLate ? 'expected_action_delayed' : 'expected_action_completed',
			payloadJson: {
				actionId: action.id,
				label: action.label,
				atSeconds: elapsedSec,
				deadlineSeconds: action.deadlineSeconds ?? null,
				match: { unitName: hit.unitName, assignment: hit.assignment }
			}
		});
	}
}

async function scheduleAssignmentCompletions(
	sessionId: string,
	rules: AssignmentCompletionRule[],
	board: Array<{ unitName: string; assignment: string | null }>,
	now: Date
): Promise<void> {
	if (rules.length === 0 || board.length === 0) return;
	const alreadyScheduled = await loadScheduledRuleIds(sessionId);

	for (const rule of rules) {
		if (alreadyScheduled.has(rule.id)) continue;
		const hit = board.find((b) => matchesAssignment(rule.trigger, b));
		if (!hit) continue;

		const fireAt = new Date(now.getTime() + rule.delaySeconds * 1000);
		await db.insert(trainerScheduledEvents).values({
			id: crypto.randomUUID(),
			sessionId,
			kind: 'assignment_completion',
			ruleId: rule.id,
			fireAt,
			payloadJson: { dispatch: rule.dispatch, trigger: hit }
		});
	}
}

export interface EndSessionOptions {
	outcome: SimulationOutcome;
	reason: string;
	payload?: Record<string, unknown>;
}

/**
 * Idempotent finalize. Safe to call from manual end, timeout, failure,
 * or "force_end" scheduled events.
 */
export async function endSession(io: Server, sessionId: string, opts: EndSessionOptions): Promise<void> {
	const [row] = await db
		.select({ endedAt: trainerSessions.endedAt })
		.from(trainerSessions)
		.where(eq(trainerSessions.id, sessionId))
		.limit(1);
	if (!row || row.endedAt) return;

	const endedAt = new Date();
	await db
		.update(trainerSessions)
		.set({ endedAt, simulationOutcome: opts.outcome, endReason: opts.reason })
		.where(eq(trainerSessions.id, sessionId));

	const eventType =
		opts.outcome === 'failed' ? 'session_failed'
		: opts.outcome === 'completed' ? 'session_completed'
		: opts.outcome === 'timeout' ? 'session_failed'
		: 'session_ended';

	await db.insert(trainerSessionEvents).values({
		id: crypto.randomUUID(),
		sessionId,
		eventType,
		payloadJson: { outcome: opts.outcome, reason: opts.reason, ...(opts.payload ?? {}) }
	});

	io.to(`session:${sessionId}`).emit('trainer:session:ended', {
		outcome: opts.outcome,
		reason: opts.reason
	});
}
