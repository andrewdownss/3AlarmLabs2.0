import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { and, eq, desc, isNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	organizationMembers,
	organizations,
	trainerScenarios,
	trainerSessions,
	trainerSessionEvents
} from '$lib/server/db/schema';
import { generateJoinCode } from '$lib/server/join-code';
import { canCreateCommandScenario, canStartCommandMode, getPlanConfig, normalizePlanId } from '$lib/plans';

export const load: PageServerLoad = async ({ locals, depends, parent }) => {
	if (!locals.user) throw redirect(303, '/login');

	depends('command:scenarios');

	const { planConfig } = await parent();

	const membership = await db.query.organizationMembers.findFirst({
		where: eq(organizationMembers.userId, locals.user.id),
		columns: { organizationId: true }
	});
	const organizationId = membership?.organizationId ?? null;

	const scenarios = await db.query.trainerScenarios.findMany({
		where: organizationId
			? eq(trainerScenarios.organizationId, organizationId)
			: and(
					eq(trainerScenarios.createdBy, locals.user.id),
					isNull(trainerScenarios.organizationId)
				),
		orderBy: [desc(trainerScenarios.updatedAt)],
		columns: {
			id: true,
			title: true,
			description: true,
			constructionType: true,
			alarmLevel: true,
			sideAlphaImageUrl: true,
			createdAt: true
		}
	});

	const scenarioCount = scenarios.length;
	return { scenarios, scenarioCount, canCreateScenario: canCreateCommandScenario(planConfig, scenarioCount), planConfig };
};

export const actions: Actions = {
	deleteScenario: async ({ locals, request }) => {
		if (!locals.user) throw redirect(303, '/login');
		const form = await request.formData();
		const scenarioId = String(form.get('scenarioId') ?? '');
		if (!scenarioId) return fail(400, { error: 'Missing scenario ID.' });

		const membership = await db.query.organizationMembers.findFirst({
			where: eq(organizationMembers.userId, locals.user.id),
			columns: { organizationId: true }
		});
		const organizationId = membership?.organizationId ?? null;

		const scenario = await db.query.trainerScenarios.findFirst({
			where: and(
				eq(trainerScenarios.id, scenarioId),
				organizationId
					? eq(trainerScenarios.organizationId, organizationId)
					: and(
							eq(trainerScenarios.createdBy, locals.user.id),
							isNull(trainerScenarios.organizationId)
						)
			),
			columns: { id: true }
		});
		if (!scenario) return fail(404, { error: 'Scenario not found.' });

		await db.delete(trainerScenarios).where(eq(trainerScenarios.id, scenarioId));
		return { deleted: true };
	},
	startSession: async ({ locals, request }) => {
		if (!locals.user) throw redirect(303, '/login');
		const form = await request.formData();
		const scenarioId = String(form.get('scenarioId') ?? '');
		const mode = String(form.get('mode') ?? 'self_practice') as 'self_practice' | 'instructor_led';
		if (!scenarioId) return fail(400, { error: 'Missing scenario ID.' });

		const membership = await db.query.organizationMembers.findFirst({
			where: eq(organizationMembers.userId, locals.user.id),
			columns: { organizationId: true }
		});
		const userOrganizationId = membership?.organizationId ?? null;

		const scenario = await db.query.trainerScenarios.findFirst({
			where: and(
				eq(trainerScenarios.id, scenarioId),
				userOrganizationId
					? eq(trainerScenarios.organizationId, userOrganizationId)
					: and(
							eq(trainerScenarios.createdBy, locals.user.id),
							isNull(trainerScenarios.organizationId)
						)
			),
			columns: { id: true }
		});
		if (!scenario) return fail(404, { error: 'Scenario not found.' });

		const sessionId = crypto.randomUUID();
		let joinCode: string | null = null;
		let organizationId: string | null = null;

		if (mode === 'instructor_led') {
			if (!userOrganizationId) {
				return fail(400, { error: 'Instructor-led sessions require an organization.' });
			}
			const orgRow = await db.query.organizations.findFirst({
				where: eq(organizations.id, userOrganizationId),
				columns: { planId: true }
			});
			const plan = getPlanConfig(normalizePlanId(orgRow?.planId));
			if (!canStartCommandMode(plan, 'instructor_led')) {
				return fail(403, {
					error:
						'Instructor-led sessions are not included on your plan. Upgrade to Team or Instructor to unlock them.'
				});
			}
			organizationId = userOrganizationId;

			for (let attempt = 0; attempt < 5; attempt += 1) {
				const candidate = generateJoinCode();
				const existing = await db.query.trainerSessions.findFirst({
					where: eq(trainerSessions.joinCode, candidate),
					columns: { id: true }
				});
				if (!existing) {
					joinCode = candidate;
					break;
				}
			}

			if (!joinCode) {
				return fail(500, { error: 'Could not generate a unique join code. Please try again.' });
			}
		}

		await db.insert(trainerSessions).values({
			id: sessionId,
			scenarioId,
			mode,
			instructorId: mode === 'instructor_led' ? locals.user.id : null,
			studentId: mode === 'self_practice' ? locals.user.id : null,
			joinCode,
			organizationId
		});

		await db.insert(trainerSessionEvents).values({
			id: crypto.randomUUID(),
			sessionId,
			eventType: 'session_started',
			payloadJson: { mode }
		});

		return { sessionId };
	}
};
