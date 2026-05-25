import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { and, count, eq, desc, isNull, lte, or } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	organizationMembers,
	organizations,
	trainerScenarios,
	trainerSessions,
	trainerSessionEvents
} from '$lib/server/db/schema';
import { generateJoinCode } from '$lib/server/join-code';
import {
	canCreateCommandScenario,
	canStartCommandMode,
	getPlanConfig,
	normalizePlanId
} from '$lib/plans';
import { canEditLibrary } from '$lib/server/library-access';
import { cloneSelfPacedConfig, duplicateScenarioTitle } from '$lib/server/scenario-clone';

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
			? and(
					eq(trainerScenarios.organizationId, organizationId),
					eq(trainerScenarios.isLibrary, false)
				)
			: and(
					eq(trainerScenarios.createdBy, locals.user.id),
					isNull(trainerScenarios.organizationId),
					eq(trainerScenarios.isLibrary, false)
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

	const now = new Date();
	const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
	const libraryRows = await db.query.trainerScenarios.findMany({
			where: and(eq(trainerScenarios.isLibrary, true), lte(trainerScenarios.publishedAt, now)),
			columns: { id: true, publishedAt: true }
		});
	const publishedDates = libraryRows
		.map((row) => row.publishedAt)
		.filter((date): date is Date => Boolean(date));
	const latestPublishedAt =
		publishedDates.length > 0
			? new Date(Math.max(...publishedDates.map((date) => date.getTime())))
			: null;
	const librarySummary = {
		totalCount: libraryRows.length,
		newThisWeekCount: publishedDates.filter((date) => date >= weekAgo).length,
		latestPublishedAt
	};

	const scenarioCount = scenarios.length;
	return {
		scenarios,
		librarySummary,
		scenarioCount,
		canCreateScenario: canCreateCommandScenario(planConfig, scenarioCount),
		planConfig
	};
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
			columns: { id: true, isLibrary: true }
		});
		if (!scenario) return fail(404, { error: 'Scenario not found.' });
		if (scenario.isLibrary && !canEditLibrary(locals.user)) {
			return fail(403, { error: 'Library scenarios can only be managed by admins or library editors.' });
		}

		await db.delete(trainerScenarios).where(eq(trainerScenarios.id, scenarioId));
		return { deleted: true };
	},
	duplicateScenario: async ({ locals, request }) => {
		if (!locals.user) throw redirect(303, '/login');
		const form = await request.formData();
		const scenarioId = String(form.get('scenarioId') ?? '');
		if (!scenarioId) return fail(400, { error: 'Missing scenario ID.' });

		const membership = await db.query.organizationMembers.findFirst({
			where: eq(organizationMembers.userId, locals.user.id),
			columns: { organizationId: true }
		});
		const organizationId = membership?.organizationId ?? null;

		const source = await db.query.trainerScenarios.findFirst({
			where: and(
				eq(trainerScenarios.id, scenarioId),
				organizationId
					? eq(trainerScenarios.organizationId, organizationId)
					: and(
							eq(trainerScenarios.createdBy, locals.user.id),
							isNull(trainerScenarios.organizationId)
						)
			)
		});
		if (!source) return fail(404, { error: 'Scenario not found.' });
		if (source.isLibrary && !canEditLibrary(locals.user)) {
			return fail(403, { error: 'Library scenarios can only be duplicated by admins or library editors.' });
		}

		const orgRow = organizationId
			? await db.query.organizations.findFirst({
					where: eq(organizations.id, organizationId),
					columns: { planId: true }
				})
			: null;
		const planConfig = getPlanConfig(normalizePlanId(orgRow?.planId));

		const scenarioCountResult = await db
			.select({ value: count() })
			.from(trainerScenarios)
			.where(
				organizationId
					? and(
							eq(trainerScenarios.organizationId, organizationId),
							eq(trainerScenarios.isLibrary, false)
						)
					: and(
							eq(trainerScenarios.createdBy, locals.user.id),
							isNull(trainerScenarios.organizationId),
							eq(trainerScenarios.isLibrary, false)
						)
			);
		const scenarioCount = scenarioCountResult[0]?.value ?? 0;
		if (!canCreateCommandScenario(planConfig, scenarioCount)) {
			return fail(403, {
				error: `You've reached the active scenario limit for the ${planConfig.name} plan.`
			});
		}

		const newId = crypto.randomUUID();
		await db.insert(trainerScenarios).values({
			id: newId,
			title: duplicateScenarioTitle(source.title),
			description: source.description,
			organizationId: source.organizationId,
			createdBy: locals.user.id,
			constructionType: source.constructionType,
			address: source.address,
			occupancyType: source.occupancyType,
			alarmLevel: source.alarmLevel,
			sideAlphaImageUrl: source.sideAlphaImageUrl,
			sideBravoImageUrl: source.sideBravoImageUrl,
			sideCharlieImageUrl: source.sideCharlieImageUrl,
			sideDeltaImageUrl: source.sideDeltaImageUrl,
			dispatchNotes: source.dispatchNotes,
			selfPacedConfigJson: cloneSelfPacedConfig(source.selfPacedConfigJson),
			stageMetadataJson: structuredClone(source.stageMetadataJson ?? {}),
			defaultResources: structuredClone(source.defaultResources ?? []),
			isLibrary: false,
			isDemoScenario: false,
			publishedAt: null
		});

		return { scenarioId: newId };
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

		const now = new Date();
		const scenario = await db.query.trainerScenarios.findFirst({
			where: and(
				eq(trainerScenarios.id, scenarioId),
				or(
					userOrganizationId
						? eq(trainerScenarios.organizationId, userOrganizationId)
						: and(
								eq(trainerScenarios.createdBy, locals.user.id),
								isNull(trainerScenarios.organizationId),
								eq(trainerScenarios.isLibrary, false)
							),
					and(eq(trainerScenarios.isLibrary, true), lte(trainerScenarios.publishedAt, now))
				)
			),
			columns: { id: true, isLibrary: true }
		});
		if (!scenario) return fail(404, { error: 'Scenario not found.' });
		if (scenario.isLibrary && mode !== 'self_practice') {
			return fail(403, { error: 'Library scenarios are available for self practice only.' });
		}

		const sessionId = crypto.randomUUID();
		let joinCode: string | null = null;
		let organizationId: string | null = userOrganizationId;

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
