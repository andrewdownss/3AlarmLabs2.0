import { Router } from 'express';
import { asc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
	organizations,
	trainerScenarios,
	trainerSessions,
	trainerSessionEvents
} from '../db/schema/trainer.js';
import { planAllowsInstructorLed } from '../lib/plan-policy.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { getSessionForUser } from '../middleware/authz.js';
import type { Server } from 'socket.io';

export function createSessionsRouter(io: Server) {
	const router = Router();

	router.post('/', async (req: AuthenticatedRequest, res) => {
		const { scenarioId, mode } = req.body;
		if (!scenarioId) {
			res.status(400).json({ error: 'scenarioId required' });
			return;
		}

		const m = mode === 'instructor_led' ? 'instructor_led' : 'self_practice';

		const [scenarioRow] = await db
			.select({
				id: trainerScenarios.id,
				organizationId: trainerScenarios.organizationId
			})
			.from(trainerScenarios)
			.where(eq(trainerScenarios.id, scenarioId))
			.limit(1);

		if (!scenarioRow) {
			res.status(404).json({ error: 'Scenario not found' });
			return;
		}

		let organizationId: string | null = null;
		if (m === 'instructor_led') {
			if (!scenarioRow.organizationId) {
				res.status(403).json({
					error: 'Instructor-led sessions require an organization-scoped scenario.'
				});
				return;
			}
			const [orgRow] = await db
				.select({ planId: organizations.planId })
				.from(organizations)
				.where(eq(organizations.id, scenarioRow.organizationId))
				.limit(1);
			if (!planAllowsInstructorLed(orgRow?.planId)) {
				res.status(403).json({ error: 'Your plan does not include instructor-led sessions.' });
				return;
			}
			organizationId = scenarioRow.organizationId;
		}

		const sessionId = crypto.randomUUID();
		await db.insert(trainerSessions).values({
			id: sessionId,
			scenarioId,
			mode: m,
			instructorId: m === 'instructor_led' ? req.userId! : null,
			studentId: req.userId!,
			organizationId
		});

		await db.insert(trainerSessionEvents).values({
			id: crypto.randomUUID(),
			sessionId,
			eventType: 'session_started',
			payloadJson: { mode: m }
		});

		res.json({ sessionId });
	});

	router.post('/:id/end', async (req: AuthenticatedRequest, res) => {
		const id = String(req.params.id);
		const session = await getSessionForUser(id, req.userId!);
		if (!session) { res.status(404).json({ error: 'Not found' }); return; }

		await db.update(trainerSessions).set({ endedAt: new Date() }).where(eq(trainerSessions.id, id));

		await db.insert(trainerSessionEvents).values({
			id: crypto.randomUUID(),
			sessionId: id,
			eventType: 'session_ended',
			payloadJson: {}
		});

		io.to(`session:${id}`).emit('trainer:session:ended');
		res.json({ success: true });
	});

	router.get('/:id', async (req: AuthenticatedRequest, res) => {
		const id = String(req.params.id);
		const session = await getSessionForUser(id, req.userId!);
		if (!session) { res.status(404).json({ error: 'Not found' }); return; }
		res.json(session);
	});

	router.get('/:id/events', async (req: AuthenticatedRequest, res) => {
		const id = String(req.params.id);
		const session = await getSessionForUser(id, req.userId!);
		if (!session) { res.status(404).json({ error: 'Not found' }); return; }

		const events = await db
			.select()
			.from(trainerSessionEvents)
			.where(eq(trainerSessionEvents.sessionId, id))
			.orderBy(asc(trainerSessionEvents.timestamp));
		res.json(events);
	});

	return router;
}
