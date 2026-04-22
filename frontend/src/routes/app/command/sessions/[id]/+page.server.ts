import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { trainerSessions, trainerScenarios, trainerCommandBoardEntries } from '$lib/server/db/schema';
import { isValidSelfPacedConfig } from '$lib/self-paced';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) throw redirect(303, '/login');

	const session = await db.query.trainerSessions.findFirst({
		where: eq(trainerSessions.id, params.id)
	});
	if (!session) throw redirect(303, '/app/command');
	const isParticipant =
		session.studentId === locals.user.id || session.instructorId === locals.user.id;
	if (!isParticipant) throw redirect(303, '/app/command');

	const [scenario, boardEntries] = await Promise.all([
		db.query.trainerScenarios.findFirst({
			where: eq(trainerScenarios.id, session.scenarioId)
		}),
		db.query.trainerCommandBoardEntries.findMany({
			where: eq(trainerCommandBoardEntries.sessionId, params.id)
		})
	]);
	if (!scenario) throw redirect(303, '/app/command');

	const isSelfPaced = isValidSelfPacedConfig(scenario.selfPacedConfigJson);

	return { session, scenario, boardEntries, isSelfPaced };
};
