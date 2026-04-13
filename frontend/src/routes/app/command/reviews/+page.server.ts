import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { desc, eq, or } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { trainerSessions } from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(303, '/login');

	const sessions = await db.query.trainerSessions.findMany({
		where: or(
			eq(trainerSessions.studentId, locals.user.id),
			eq(trainerSessions.instructorId, locals.user.id)
		),
		orderBy: [desc(trainerSessions.startedAt)],
		columns: {
			id: true,
			mode: true,
			startedAt: true,
			endedAt: true,
			studentId: true,
			instructorId: true
		},
		with: {
			scenario: {
				columns: {
					id: true,
					title: true,
					sideAlphaImageUrl: true
				}
			}
		}
	});

	return { sessions, userId: locals.user.id };
};
