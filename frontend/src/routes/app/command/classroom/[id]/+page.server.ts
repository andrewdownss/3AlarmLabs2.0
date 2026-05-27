import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { and, desc, eq, isNull, lte, or } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	classroomParticipants,
	classrooms,
	trainerCommandBoardEntries,
	trainerScenarios,
	trainerSessionEvents,
	trainerSessions
} from '$lib/server/db/schema';
import { canHostClassroom } from '$lib/plans';
import { generateJoinCode } from '$lib/server/join-code';

async function loadClassroom(id: string, userId: string) {
	return db.query.classrooms.findFirst({
		where: and(eq(classrooms.id, id), eq(classrooms.instructorId, userId), isNull(classrooms.endedAt))
	});
}

async function generateUniqueClassroomCode(): Promise<string | null> {
	for (let attempt = 0; attempt < 8; attempt += 1) {
		const code = generateJoinCode();
		const existing = await db.query.classrooms.findFirst({
			where: eq(classrooms.code, code),
			columns: { id: true }
		});
		if (!existing) return code;
	}
	return null;
}

export const load: PageServerLoad = async ({ locals, params, parent }) => {
	if (!locals.user) throw redirect(303, '/login');
	const { planConfig, organization } = await parent();
	if (!canHostClassroom(planConfig)) throw redirect(303, '/app/command/classroom');

	const classroom = await loadClassroom(params.id, locals.user.id);
	if (!classroom) throw redirect(303, '/app/command/classroom');

	const participants = await db.query.classroomParticipants.findMany({
		where: and(eq(classroomParticipants.classroomId, classroom.id), isNull(classroomParticipants.kickedAt)),
		orderBy: [desc(classroomParticipants.lastSeenAt)]
	});

	const activeSession = classroom.activeSessionId
		? await db.query.trainerSessions.findFirst({
				where: eq(trainerSessions.id, classroom.activeSessionId)
			})
		: null;
	const [activeScenario, boardEntries] = activeSession
		? await Promise.all([
				db.query.trainerScenarios.findFirst({
					where: eq(trainerScenarios.id, activeSession.scenarioId)
				}),
				db.query.trainerCommandBoardEntries.findMany({
					where: eq(trainerCommandBoardEntries.sessionId, activeSession.id)
				})
			])
		: [null, []];

	const now = new Date();
	const scenarios = organization
		? await db.query.trainerScenarios.findMany({
				where: or(
					and(
						eq(trainerScenarios.organizationId, organization.id),
						eq(trainerScenarios.isLibrary, false)
					),
					and(eq(trainerScenarios.isLibrary, true), lte(trainerScenarios.publishedAt, now))
				),
				orderBy: [desc(trainerScenarios.updatedAt)],
				columns: {
					id: true,
					title: true,
					description: true,
					alarmLevel: true,
					sideAlphaImageUrl: true,
					selfPacedConfigJson: true,
					isLibrary: true
				}
			})
		: [];

	return {
		classroom,
		participants,
		activeSession,
		activeScenario,
		boardEntries,
		boardColumns: activeSession?.boardColumnsJson ?? [],
		scenarios,
		joinUrl: `/classroom/join?code=${classroom.code}`
	};
};

export const actions: Actions = {
	updateOptions: async ({ locals, params, request }) => {
		if (!locals.user) throw redirect(303, '/login');
		const classroom = await loadClassroom(params.id, locals.user.id);
		if (!classroom) return fail(404, { error: 'Classroom not found.' });

		const form = await request.formData();
		const useSelfPacedScript = form.get('useSelfPacedScript') === 'on';
		const rawBoardLabelMode = String(form.get('boardLabelMode') ?? 'division_group');
		const boardLabelMode =
			rawBoardLabelMode === 'student_defined' ? 'student_defined' : 'division_group';

		await db
			.update(classrooms)
			.set({ useSelfPacedScript, boardLabelMode })
			.where(eq(classrooms.id, classroom.id));

		return { optionsSaved: true };
	},
	end: async ({ locals, params }) => {
		if (!locals.user) throw redirect(303, '/login');
		const classroom = await loadClassroom(params.id, locals.user.id);
		if (!classroom) return fail(404, { error: 'Classroom not found.' });

		const now = new Date();
		if (classroom.activeSessionId) {
			await db
				.update(trainerSessions)
				.set({ endedAt: now, simulationOutcome: 'ended', endReason: 'classroom_ended' })
				.where(eq(trainerSessions.id, classroom.activeSessionId));
			await db.insert(trainerSessionEvents).values({
				id: crypto.randomUUID(),
				sessionId: classroom.activeSessionId,
				eventType: 'session_ended',
				payloadJson: { outcome: 'ended', reason: 'classroom_ended', classroomId: classroom.id }
			});
		}
		await db
			.update(classrooms)
			.set({ endedAt: now, activeSessionId: null, calledOnParticipantId: null })
			.where(eq(classrooms.id, classroom.id));
		throw redirect(303, '/app/command/classroom');
	},
	regenerateCode: async ({ locals, params }) => {
		if (!locals.user) throw redirect(303, '/login');
		const classroom = await loadClassroom(params.id, locals.user.id);
		if (!classroom) return fail(404, { error: 'Classroom not found.' });
		const code = await generateUniqueClassroomCode();
		if (!code) return fail(500, { error: 'Could not generate a new code.' });
		await db.update(classrooms).set({ code }).where(eq(classrooms.id, classroom.id));
		return { code };
	}
};
