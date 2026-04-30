import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { desc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	organizationMembers,
	trainerCommandBoardEntries,
	trainerRadioMessages,
	trainerScenarios,
	trainerSessionEvents,
	trainerSessions,
	user as userTable
} from '$lib/server/db/schema';

/** Most recent slice (chronological after reverse) to cap SSR payload on long sessions */
const REVIEW_EVENT_LIMIT = 2000;
const REVIEW_RADIO_LIMIT = 800;

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) throw redirect(303, '/login');

	const session = await db.query.trainerSessions.findFirst({
		where: eq(trainerSessions.id, params.id)
	});
	if (!session) throw redirect(303, '/app/command');

	const isParticipant =
		session.studentId === locals.user.id || session.instructorId === locals.user.id;
	const membership = await db.query.organizationMembers.findFirst({
		where: eq(organizationMembers.userId, locals.user.id),
		columns: { organizationId: true },
		with: { organization: { columns: { ownerId: true, isPersonal: true } } }
	});
	const ownedOrganizationId =
		membership?.organization?.ownerId === locals.user.id && !membership.organization.isPersonal
			? membership.organizationId
			: null;
	const isOwnerReview =
		Boolean(ownedOrganizationId) &&
		session.organizationId !== null &&
		session.organizationId === ownedOrganizationId;
	if (!isParticipant && !isOwnerReview) throw redirect(303, '/app/command/reviews');

	const [scenario, eventsDesc, radioDesc, boardEntries] = await Promise.all([
		db.query.trainerScenarios.findFirst({
			where: eq(trainerScenarios.id, session.scenarioId)
		}),
		db.query.trainerSessionEvents.findMany({
			where: eq(trainerSessionEvents.sessionId, params.id),
			orderBy: [desc(trainerSessionEvents.timestamp)],
			limit: REVIEW_EVENT_LIMIT + 1
		}),
		db.query.trainerRadioMessages.findMany({
			where: eq(trainerRadioMessages.sessionId, params.id),
			orderBy: [desc(trainerRadioMessages.createdAt)],
			limit: REVIEW_RADIO_LIMIT + 1
		}),
		db.query.trainerCommandBoardEntries.findMany({
			where: eq(trainerCommandBoardEntries.sessionId, params.id)
		})
	]);
	if (!scenario) throw redirect(303, '/app/command');

	const viewedAs = !isParticipant && isOwnerReview ? 'org_owner' : 'self';
	const student =
		viewedAs === 'org_owner' && session.studentId
			? await db.query.user.findFirst({
					where: eq(userTable.id, session.studentId),
					columns: { id: true, name: true, email: true }
				})
			: null;

	const eventsTruncated = eventsDesc.length > REVIEW_EVENT_LIMIT;
	const radioTruncated = radioDesc.length > REVIEW_RADIO_LIMIT;
	const events = [
		...(eventsTruncated ? eventsDesc.slice(0, REVIEW_EVENT_LIMIT) : eventsDesc)
	].reverse();
	const radioMessages = [
		...(radioTruncated ? radioDesc.slice(0, REVIEW_RADIO_LIMIT) : radioDesc)
	].reverse();

	return {
		session,
		scenario,
		viewedAs,
		student,
		events,
		radioMessages,
		boardEntries,
		reviewCaps: {
			eventsTruncated,
			radioTruncated,
			eventLimit: REVIEW_EVENT_LIMIT,
			radioLimit: REVIEW_RADIO_LIMIT
		}
	};
};
