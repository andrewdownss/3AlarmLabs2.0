import { fail, redirect } from '@sveltejs/kit';
import { eq, count } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { organizationMembers, scenes } from '$lib/server/db/schema';
import { canCreateScene, getPlanConfig, normalizePlanId } from '$lib/plans';
import { invalidateLayoutCache } from '$lib/server/cache';
import type { PageServerLoad, Actions } from './$types';
import crypto from 'node:crypto';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(303, '/login');
	return {};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.user) throw redirect(303, '/login');

		const form = await request.formData();
		const title = String(form.get('title') ?? '').trim();
		if (!title) return fail(400, { error: 'Title is required', title: '' });

		const membership = await db.query.organizationMembers.findFirst({
			where: eq(organizationMembers.userId, locals.user.id),
			with: { organization: true }
		});

		const org = membership?.organization ?? null;
		const planConfig = getPlanConfig(normalizePlanId(org?.planId));

		const orgId = org?.id;
		const sceneCountResult = orgId
			? await db.select({ value: count() }).from(scenes).where(eq(scenes.organizationId, orgId))
			: await db
					.select({ value: count() })
					.from(scenes)
					.where(eq(scenes.userId, locals.user.id));

		const currentCount = sceneCountResult[0]?.value ?? 0;

		if (!canCreateScene(planConfig, currentCount)) {
			return fail(403, {
				error: `You've reached the ${planConfig.maxScenes}-scene limit on the ${planConfig.name} plan. Upgrade to create more.`,
				title
			});
		}

		const sceneId = `scene_${crypto.randomUUID()}`;

		await db.insert(scenes).values({
			id: sceneId,
			userId: locals.user.id,
			organizationId: orgId ?? null,
			title
		});

		invalidateLayoutCache(locals.user.id);

		throw redirect(303, `/app/sizeup/scenes/new/capture?sceneId=${sceneId}`);
	}
};
