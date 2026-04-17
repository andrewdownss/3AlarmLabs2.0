import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { and, count, eq, isNull } from 'drizzle-orm';
import { organizationMembers, organizations, trainerScenarios } from '$lib/server/db/schema';
import { canCreateCommandScenario, getPlanConfig, normalizePlanId } from '$lib/plans';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(303, '/login');
	return {};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.user) throw redirect(303, '/login');
		const form = await request.formData();
		const title = String(form.get('title') ?? '').trim();
		if (!title) return fail(400, { formError: 'Title is required.' });

		const id = crypto.randomUUID();
		const membership = await db.query.organizationMembers.findFirst({
			where: eq(organizationMembers.userId, locals.user.id),
			columns: { organizationId: true }
		});
		const organizationId = membership?.organizationId ?? null;

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
					? eq(trainerScenarios.organizationId, organizationId)
					: and(eq(trainerScenarios.createdBy, locals.user.id), isNull(trainerScenarios.organizationId))
			);
		const scenarioCount = scenarioCountResult[0]?.value ?? 0;
		if (!canCreateCommandScenario(planConfig, scenarioCount)) {
			return fail(403, { formError: `You've reached the active scenario limit for the ${planConfig.name} plan.` });
		}

		await db.insert(trainerScenarios).values({
			id,
			title,
			description: String(form.get('description') ?? '').trim() || null,
			organizationId,
			createdBy: locals.user.id,
			constructionType: String(form.get('constructionType') ?? '').trim() || null,
			address: String(form.get('address') ?? '').trim() || null,
			occupancyType: String(form.get('occupancyType') ?? '').trim() || null,
			alarmLevel: String(form.get('alarmLevel') ?? '').trim() || null
		});

		throw redirect(303, `/app/command/scenarios/${id}`);
	}
};
