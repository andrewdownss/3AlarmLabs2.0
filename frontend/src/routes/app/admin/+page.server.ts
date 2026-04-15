import { redirect } from '@sveltejs/kit';
import { count, eq, gt } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { organizations, user as userTable } from '$lib/server/db/schema';
import type { PlanId } from '$lib/plans';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(303, '/login');
	if (!locals.user.isAdmin) throw redirect(303, '/app/sizeup');

	const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

	const [userCountResult, orgCountResult, newUserCountResult, orgPlanCountsRaw] = await Promise.all([
		db.select({ value: count() }).from(userTable),
		db.select({ value: count() }).from(organizations),
		db.select({ value: count() }).from(userTable).where(gt(userTable.createdAt, since)),
		db
			.select({ planId: organizations.planId, value: count() })
			.from(organizations)
			.groupBy(organizations.planId)
	]);

	const orgPlanCounts = (orgPlanCountsRaw ?? []).map((row) => ({
		planId: row.planId as PlanId,
		count: row.value
	}));

	return {
		userCount: userCountResult[0]?.value ?? 0,
		newUserCount30d: newUserCountResult[0]?.value ?? 0,
		organizationCount: orgCountResult[0]?.value ?? 0,
		orgPlanCounts
	};
};

