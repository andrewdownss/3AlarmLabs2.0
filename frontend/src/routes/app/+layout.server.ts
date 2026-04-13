import { redirect } from '@sveltejs/kit';
import { eq, count } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { organizationMembers, organizations, scenes } from '$lib/server/db/schema';
import { getPlanConfig, normalizePlanId } from '$lib/plans';
import { get, set } from '$lib/server/cache';
import type { LayoutServerLoad } from './$types';

function layoutCacheKey(userId: string) {
	return `app:layout:${userId}`;
}

const ORG_SETUP_PATHS = new Set(['/app/settings/organization', '/app/join-organization']);

export const load: LayoutServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		const next = url.pathname + url.search;
		throw redirect(303, `/login?next=${encodeURIComponent(next)}`);
	}

	const path = url.pathname;
	const needsOrg = !ORG_SETUP_PATHS.has(path);

	const membershipRow = await db.query.organizationMembers.findFirst({
		where: eq(organizationMembers.userId, locals.user.id)
	});

	if (!membershipRow && needsOrg) {
		throw redirect(303, '/app/settings/organization');
	}

	const cacheKey = layoutCacheKey(locals.user.id);
	const cached = get<Awaited<ReturnType<typeof loadLayoutData>>>(cacheKey);
	if (cached) return cached;

	const result = await loadLayoutData(
		locals.user,
		locals.session,
		membershipRow ? { organizationId: membershipRow.organizationId } : undefined
	);
	set(cacheKey, result);
	return result;
};

async function loadLayoutData(
	user: NonNullable<App.Locals['user']>,
	session: App.Locals['session'],
	membership: { organizationId: string } | undefined
) {
	const org = membership
		? await db.query.organizations.findFirst({
				where: eq(organizations.id, membership.organizationId)
			})
		: null;
	const planConfig = getPlanConfig(normalizePlanId(org?.planId));

	let sceneCount = 0;
	let memberCount = 0;

	if (org) {
		const [sceneResult, memberResult] = await Promise.all([
			db.select({ value: count() }).from(scenes).where(eq(scenes.organizationId, org.id)),
			db.select({ value: count() }).from(organizationMembers).where(eq(organizationMembers.organizationId, org.id))
		]);
		sceneCount = sceneResult[0]?.value ?? 0;
		memberCount = memberResult[0]?.value ?? 1;
	}

	const isActiveOrgOwner = org ? org.ownerId === user.id : false;

	const canManageTeam = isActiveOrgOwner;

	return {
		user,
		session,
		organization: org,
		planConfig,
		sceneCount,
		memberCount,
		isOrgOwner: canManageTeam,
		isActiveOrgOwner
	};
}
