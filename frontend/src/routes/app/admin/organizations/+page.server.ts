import { fail, redirect } from '@sveltejs/kit';
import { asc, count, eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { PLAN_IDS, normalizePlanId, type PlanId } from '$lib/plans';
import { invalidateLayoutCache } from '$lib/server/cache';
import { db } from '$lib/server/db';
import { organizationMembers, organizations } from '$lib/server/db/schema';

function requireAdmin(locals: App.Locals) {
	if (!locals.user) throw redirect(303, '/login');
	if (!locals.user.isAdmin) throw redirect(303, '/app/sizeup');
	return locals.user;
}

export const load: PageServerLoad = async ({ locals }) => {
	requireAdmin(locals);

	const [orgRows, memberCounts] = await Promise.all([
		db.query.organizations.findMany({
			columns: {
				id: true,
				name: true,
				planId: true,
				stripeCustomerId: true,
				stripeSubscriptionId: true,
				stripeCurrentPeriodEnd: true,
				createdAt: true,
				ownerId: true
			},
			with: {
				owner: {
					columns: { id: true, name: true, email: true }
				}
			},
			orderBy: [asc(organizations.createdAt)]
		}),
		db.select({ organizationId: organizationMembers.organizationId, value: count() }).from(organizationMembers).groupBy(
			organizationMembers.organizationId
		)
	]);

	const memberCountByOrgId = new Map(memberCounts.map((row) => [row.organizationId, row.value]));

	return {
		planIds: PLAN_IDS,
		organizations: orgRows.map((o) => ({
			...o,
			planId: normalizePlanId(o.planId) as PlanId,
			memberCount: memberCountByOrgId.get(o.id) ?? 0
		}))
	};
};

export const actions: Actions = {
	changePlan: async ({ locals, request }) => {
		requireAdmin(locals);

		const form = await request.formData();
		const organizationId = String(form.get('organizationId') ?? '').trim();
		const rawPlanId = String(form.get('planId') ?? '').trim();

		if (!organizationId) return fail(400, { error: 'organizationId required' });
		if (!rawPlanId) return fail(400, { error: 'planId required' });

		if (!PLAN_IDS.includes(rawPlanId as (typeof PLAN_IDS)[number])) {
			return fail(400, { error: 'Invalid planId' });
		}

		const org = await db.query.organizations.findFirst({
			where: eq(organizations.id, organizationId),
			columns: { id: true }
		});
		if (!org) return fail(404, { error: 'Organization not found' });

		await db.update(organizations).set({ planId: rawPlanId as PlanId }).where(eq(organizations.id, organizationId));

		const members = await db
			.select({ userId: organizationMembers.userId })
			.from(organizationMembers)
			.where(eq(organizationMembers.organizationId, organizationId));
		for (const m of members) invalidateLayoutCache(m.userId);

		return { success: true as const };
	},

	deleteOrganization: async ({ locals, request }) => {
		requireAdmin(locals);

		const form = await request.formData();
		const organizationId = String(form.get('organizationId') ?? '').trim();
		if (!organizationId) return fail(400, { error: 'organizationId required' });

		const [org, members] = await Promise.all([
			db.query.organizations.findFirst({
				where: eq(organizations.id, organizationId),
				columns: { id: true, ownerId: true }
			}),
			db
				.select({ userId: organizationMembers.userId })
				.from(organizationMembers)
				.where(eq(organizationMembers.organizationId, organizationId))
		]);

		if (!org) return fail(404, { error: 'Organization not found' });

		await db.delete(organizations).where(eq(organizations.id, organizationId));

		for (const m of members) invalidateLayoutCache(m.userId);
		invalidateLayoutCache(org.ownerId);

		return { success: true as const };
	}
};

