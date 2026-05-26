import { Router } from 'express';
import { and, count, eq, gt, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
	classroomParticipants,
	classrooms,
	organizationMembers,
	organizations,
	trainerSessions
} from '../db/schema/trainer.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { classroomCookieMaxAge, CLASSROOM_COOKIE_NAME, createClassroomCookieValue } from '../lib/classroom-cookie.js';
import { maxClassroomSeatsForPlan, planAllowsClassroom } from '../lib/plan-policy.js';

function generateCode() {
	const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
	return Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
}

async function generateUniqueCode() {
	for (let attempt = 0; attempt < 8; attempt += 1) {
		const code = generateCode();
		const [existing] = await db.select({ id: classrooms.id }).from(classrooms).where(eq(classrooms.code, code)).limit(1);
		if (!existing) return code;
	}
	return null;
}

function sanitizeDisplayName(raw: string) {
	return raw.replace(/[^\p{L}\p{N}\s.'-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 24);
}

const joinAttempts = new Map<string, { count: number; resetAt: number }>();

function isJoinRateLimited(key: string, now = Date.now()) {
	const current = joinAttempts.get(key);
	if (!current || current.resetAt <= now) {
		joinAttempts.set(key, { count: 1, resetAt: now + 60_000 });
		return false;
	}
	current.count += 1;
	return current.count > 10;
}

export function createClassroomRouter() {
	const router = Router();

	router.post('/', async (req: AuthenticatedRequest, res) => {
		const [membership] = await db
			.select({ organizationId: organizationMembers.organizationId })
			.from(organizationMembers)
			.where(eq(organizationMembers.userId, req.userId!))
			.limit(1);
		if (!membership) {
			res.status(400).json({ error: 'Classrooms require an organization.' });
			return;
		}
		const [org] = await db
			.select({ planId: organizations.planId })
			.from(organizations)
			.where(eq(organizations.id, membership.organizationId))
			.limit(1);
		if (!planAllowsClassroom(org?.planId)) {
			res.status(403).json({ error: 'Your plan does not include classroom mode.' });
			return;
		}

		const code = await generateUniqueCode();
		if (!code) {
			res.status(500).json({ error: 'Could not generate classroom code.' });
			return;
		}
		const id = crypto.randomUUID();
		await db.insert(classrooms).values({
			id,
			organizationId: membership.organizationId,
			instructorId: req.userId!,
			name: String(req.body?.name ?? 'Training Classroom').trim().slice(0, 80) || 'Training Classroom',
			code,
			maxSeats: maxClassroomSeatsForPlan(org?.planId)
		});
		res.json({ id, code });
	});

	router.post('/:id/end', async (req: AuthenticatedRequest, res) => {
		const classroomId = String(req.params.id);
		const [classroom] = await db
			.select()
			.from(classrooms)
			.where(and(eq(classrooms.id, classroomId), eq(classrooms.instructorId, req.userId!), isNull(classrooms.endedAt)))
			.limit(1);
		if (!classroom) {
			res.status(404).json({ error: 'Classroom not found.' });
			return;
		}
		const now = new Date();
		if (classroom.activeSessionId) {
			await db
				.update(trainerSessions)
				.set({ endedAt: now, endReason: 'classroom_ended' })
				.where(eq(trainerSessions.id, classroom.activeSessionId));
		}
		await db.update(classrooms).set({ endedAt: now, activeSessionId: null, calledOnParticipantId: null }).where(eq(classrooms.id, classroom.id));
		res.json({ success: true });
	});

	return router;
}

export function createPublicClassroomRouter() {
	const router = Router();

	router.post('/:code/join', async (req, res) => {
		const code = String(req.params.code ?? '').toUpperCase();
		if (isJoinRateLimited(`${code}:${req.ip}`)) {
			res.status(429).json({ error: 'Too many join attempts. Please wait a minute and try again.' });
			return;
		}
		const [classroom] = await db
			.select()
			.from(classrooms)
			.where(and(eq(classrooms.code, code), isNull(classrooms.endedAt)))
			.limit(1);
		if (!classroom) {
			res.status(404).json({ error: 'Classroom not found.' });
			return;
		}
		const name = sanitizeDisplayName(String(req.body?.displayName ?? ''));
		if (name.length < 2) {
			res.status(400).json({ error: 'Enter a display name between 2 and 24 characters.' });
			return;
		}
		const recentCutoff = new Date(Date.now() - 60_000);
		const [{ value }] = await db
			.select({ value: count() })
			.from(classroomParticipants)
			.where(and(eq(classroomParticipants.classroomId, classroom.id), isNull(classroomParticipants.kickedAt), gt(classroomParticipants.lastSeenAt, recentCutoff)));
		if (value >= classroom.maxSeats) {
			res.status(403).json({ error: 'Classroom is full.' });
			return;
		}
		const participantId = crypto.randomUUID();
		await db.insert(classroomParticipants).values({
			id: participantId,
			classroomId: classroom.id,
			displayName: name,
			lastSeenAt: new Date()
		});
		const cookieValue = createClassroomCookieValue({ classroomId: classroom.id, participantId, displayName: name });
		if (!cookieValue) {
			res.status(500).json({ error: 'Classroom session signing is not configured.' });
			return;
		}
		res.cookie(CLASSROOM_COOKIE_NAME, cookieValue, {
			httpOnly: true,
			sameSite: 'lax',
			secure: process.env.NODE_ENV === 'production',
			maxAge: classroomCookieMaxAge() * 1000
		});
		res.json({ participantId, displayName: name });
	});

	return router;
}
