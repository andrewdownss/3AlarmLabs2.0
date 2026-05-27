import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	classroomParticipants,
	classrooms,
	trainerCommandBoardEntries,
	trainerScenarios,
	trainerSessions
} from '$lib/server/db/schema';
import { CLASSROOM_COOKIE_NAME, verifyClassroomCookieValue } from '$lib/server/classroom-cookie';

export const load: PageServerLoad = async ({ cookies, params }) => {
	const code = params.code.toUpperCase();
	const classroom = await db.query.classrooms.findFirst({
		where: and(eq(classrooms.code, code), isNull(classrooms.endedAt)),
		columns: {
			id: true,
			code: true,
			name: true,
			activeSessionId: true,
			calledOnParticipantId: true,
			useSelfPacedScript: true,
			boardLabelMode: true
		}
	});
	if (!classroom) throw redirect(303, `/classroom/${code}`);

	const payload = verifyClassroomCookieValue(cookies.get(CLASSROOM_COOKIE_NAME));
	if (!payload || payload.classroomId !== classroom.id) throw redirect(303, `/classroom/${code}`);

	const participant = await db.query.classroomParticipants.findFirst({
		where: and(
		 eq(classroomParticipants.id, payload.participantId),
		 eq(classroomParticipants.classroomId, classroom.id)
		),
		columns: { id: true, displayName: true, kickedAt: true }
	});
	if (!participant) throw redirect(303, `/classroom/${code}`);

	if (participant.kickedAt) {
		return {
			sessionEndedReason: 'kicked' as const,
			classroom: {
				id: classroom.id,
				code: classroom.code,
				name: classroom.name,
				calledOnParticipantId: null
			},
			participant: { id: participant.id, displayName: participant.displayName },
			activeSession: null,
			scenario: null,
			boardEntries: []
		};
	}

	await db
		.update(classroomParticipants)
		.set({ lastSeenAt: new Date() })
		.where(eq(classroomParticipants.id, participant.id));

	const activeSession = classroom.activeSessionId
		? await db.query.trainerSessions.findFirst({
				where: eq(trainerSessions.id, classroom.activeSessionId),
				columns: {
					id: true,
					scenarioId: true,
					activeStage: true,
					activeSide: true,
					hasStarted: true,
					startedAt: true,
					endedAt: true,
					boardColumnsJson: true
				}
			})
		: null;

	const [scenario, boardEntries] = activeSession
		? await Promise.all([
				db.query.trainerScenarios.findFirst({
					where: eq(trainerScenarios.id, activeSession.scenarioId),
					columns: {
						id: true,
						title: true,
						description: true,
						alarmLevel: true,
						dispatchNotes: true,
						sideAlphaImageUrl: true,
						sideBravoImageUrl: true,
						sideCharlieImageUrl: true,
						sideDeltaImageUrl: true,
						stageMetadataJson: true,
						defaultResources: true
					}
				}),
				db.query.trainerCommandBoardEntries.findMany({
					where: eq(trainerCommandBoardEntries.sessionId, activeSession.id)
				})
			])
		: [null, []];

	return {
		sessionEndedReason: null,
		classroom,
		participant,
		activeSession,
		scenario,
		boardEntries,
		boardColumns: activeSession?.boardColumnsJson ?? []
	};
};
