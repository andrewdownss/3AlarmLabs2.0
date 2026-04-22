import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { trainerSessions } from '../db/schema/trainer.js';
import type { SimulationOutcome } from '../lib/self-paced.js';

export interface SessionRow {
	id: string;
	scenarioId: string;
	mode: 'instructor_led' | 'self_practice';
	joinCode: string | null;
	organizationId: string | null;
	instructorId: string | null;
	studentId: string | null;
	activeStage: string;
	activeSide: string;
	hasStarted: boolean;
	startedAt: Date;
	endedAt: Date | null;
	pausedAt: Date | null;
	accumulatedPauseMs: number;
	simulationOutcome: SimulationOutcome;
	endReason: string | null;
}

function isParticipant(session: SessionRow, userId: string): boolean {
	return session.instructorId === userId || session.studentId === userId;
}

/**
 * Load a session and verify the given user is a participant (instructor or student).
 * Returns the session row if authorised, or null if not found / not allowed.
 */
export async function getSessionForUser(sessionId: string, userId: string): Promise<SessionRow | null> {
	const [row] = await db.select().from(trainerSessions)
		.where(eq(trainerSessions.id, sessionId))
		.limit(1);
	if (!row) return null;
	if (!isParticipant(row as SessionRow, userId)) return null;
	return row as SessionRow;
}
