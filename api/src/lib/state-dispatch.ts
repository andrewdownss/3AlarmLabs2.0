/**
 * Shared "apply scenario state change" code path.
 *
 * Both the live instructor (`trainer:state:dispatch` socket event) and the
 * self-paced timeline engine (timer-fired or assignment-completion) call this
 * so the persisted event log + room broadcast stay identical between modes.
 */

import type { Server } from 'socket.io';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { trainerSessions, trainerSessionEvents } from '../db/schema/trainer.js';
import { redis } from '../config/redis.js';
import type { SelfPacedDispatchPayload } from './self-paced.js';

export const VALID_STAGES: ReadonlySet<string> = new Set([
	'incipient',
	'growth',
	'fully_developed',
	'decay'
]);
export const VALID_SIDES: ReadonlySet<string> = new Set(['alpha', 'bravo', 'charlie', 'delta']);

export type DispatchSource = 'instructor' | 'timeline' | 'completion' | 'system';

export interface ApplyDispatchOptions {
	source: DispatchSource;
	/** Timeline / completion rule id, useful for replay analytics. */
	ruleId?: string;
}

/**
 * Validate and apply a scenario state change. Returns the sanitized payload
 * that was actually broadcast (illegal stage/side values are dropped).
 */
export async function applyStateDispatch(
	io: Server,
	sessionId: string,
	payload: SelfPacedDispatchPayload,
	options: ApplyDispatchOptions
): Promise<SelfPacedDispatchPayload> {
	const sanitized: SelfPacedDispatchPayload = {};
	const dbUpdates: Record<string, string> = {};

	if (payload.stage && VALID_STAGES.has(payload.stage)) {
		sanitized.stage = payload.stage;
		dbUpdates.activeStage = payload.stage;
	}
	if (payload.side && VALID_SIDES.has(payload.side)) {
		sanitized.side = payload.side;
		dbUpdates.activeSide = payload.side;
	}
	if (payload.hazard && payload.hazard.trim()) sanitized.hazard = payload.hazard.trim();
	if (payload.update && payload.update.trim()) sanitized.update = payload.update.trim();

	if (Object.keys(sanitized).length === 0) return sanitized;

	if (Object.keys(dbUpdates).length > 0) {
		await db.update(trainerSessions).set(dbUpdates).where(eq(trainerSessions.id, sessionId));
	}

	const eventType = options.source === 'instructor' ? 'state_dispatched' : 'timeline_event_dispatched';
	await db.insert(trainerSessionEvents).values({
		id: crypto.randomUUID(),
		sessionId,
		eventType,
		payloadJson: { ...sanitized, source: options.source, ruleId: options.ruleId }
	});

	try {
		await redis.set(`session:${sessionId}:state`, JSON.stringify(sanitized), 'EX', 3600);
	} catch (err) {
		console.error('[state-dispatch] redis set failed:', err);
	}

	io.to(`session:${sessionId}`).emit('trainer:state:dispatched', sanitized);
	return sanitized;
}
