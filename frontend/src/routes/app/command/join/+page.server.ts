import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { trainerSessionEvents, trainerSessions } from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(303, '/login');
	return {};
};

export const actions: Actions = {
	default: async ({ locals, request }) => {
		if (!locals.user) throw redirect(303, '/login');

		const form = await request.formData();
		const rawCode = String(form.get('code') ?? '');
		const code = rawCode.trim().toUpperCase();

		if (code.length !== 5) {
			return fail(400, { error: 'Please enter a valid 5-character code.' });
		}

		const session = await db.query.trainerSessions.findFirst({
			where: and(
				eq(trainerSessions.joinCode, code),
				eq(trainerSessions.mode, 'instructor_led'),
				isNull(trainerSessions.endedAt)
			),
			columns: {
				id: true,
				instructorId: true,
				studentId: true,
				organizationId: true
			}
		});

		if (!session) {
			return fail(404, { error: 'Session not found or no longer active.' });
		}

		if (session.instructorId === locals.user.id) {
			return fail(400, { error: 'Instructor cannot join as student.' });
		}

		if (session.studentId && session.studentId !== locals.user.id) {
			return fail(409, { error: 'A student has already joined this session.' });
		}

		if (!session.studentId) {
			await db
				.update(trainerSessions)
				.set({ studentId: locals.user.id })
				.where(eq(trainerSessions.id, session.id));

			await db.insert(trainerSessionEvents).values({
				id: crypto.randomUUID(),
				sessionId: session.id,
				eventType: 'student_joined',
				payloadJson: { studentId: locals.user.id }
			});
		}

		throw redirect(303, `/app/command/sessions/${session.id}`);
	}
};
