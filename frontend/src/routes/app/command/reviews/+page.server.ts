import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { and, desc, eq, inArray, ne, or } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { organizationMembers, trainerSessions, user as userTable } from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(303, '/login');
	const userId = locals.user.id;

	const membership = await db.query.organizationMembers.findFirst({
		where: eq(organizationMembers.userId, userId),
		columns: { organizationId: true },
		with: { organization: { columns: { id: true, ownerId: true, isPersonal: true } } }
	});
	const ownedOrganizationId =
		membership?.organization?.ownerId === userId && !membership.organization.isPersonal
			? membership.organizationId
			: null;

	const sessions = await db.query.trainerSessions.findMany({
		where: ownedOrganizationId
			? and(
					or(ne(trainerSessions.mode, 'classroom'), eq(trainerSessions.reviewVisible, true)),
					or(
						eq(trainerSessions.studentId, userId),
						eq(trainerSessions.instructorId, userId),
						eq(trainerSessions.organizationId, ownedOrganizationId)
					)
				)
			: and(
					or(ne(trainerSessions.mode, 'classroom'), eq(trainerSessions.reviewVisible, true)),
					or(eq(trainerSessions.studentId, userId), eq(trainerSessions.instructorId, userId))
				),
		orderBy: [desc(trainerSessions.startedAt)],
		columns: {
			id: true,
			mode: true,
			startedAt: true,
			endedAt: true,
			organizationId: true,
			studentId: true,
			instructorId: true,
			simulationOutcome: true,
			endReason: true
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

	const crewStudentIds = [
		...new Set(
			sessions
				.filter(
					(session) =>
						ownedOrganizationId &&
						session.organizationId === ownedOrganizationId &&
						session.studentId &&
						session.studentId !== userId
				)
				.map((session) => session.studentId as string)
		)
	];
	const students =
		crewStudentIds.length > 0
			? await db.query.user.findMany({
					where: inArray(userTable.id, crewStudentIds),
					columns: { id: true, name: true, email: true }
				})
			: [];
	const studentById = new Map(students.map((student) => [student.id, student]));

	return {
		sessions: sessions.map((session) => {
			const viewedAs =
				ownedOrganizationId &&
				session.organizationId === ownedOrganizationId &&
				session.studentId !== userId &&
				session.instructorId !== userId
					? 'org_owner'
					: 'self';
			const student = session.studentId ? studentById.get(session.studentId) : undefined;
			return {
				...session,
				viewedAs,
				studentName: student?.name ?? null,
				studentEmail: student?.email ?? null
			};
		}),
		userId,
		canViewCrewRuns: Boolean(ownedOrganizationId)
	};
};
