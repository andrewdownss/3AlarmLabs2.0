import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { organizationMembers, scenes } from '$lib/server/db/schema';
import { fetchStreetViewStatic } from '$lib/server/streetview-static';
import { UTApi } from 'uploadthing/server';
import { getPlanConfig, normalizePlanId } from '$lib/plans';

function buildSceneAccessWhere(sceneId: string, userId: string, organizationId: string | null) {
	return organizationId
		? and(eq(scenes.id, sceneId), eq(scenes.organizationId, organizationId))
		: and(eq(scenes.id, sceneId), eq(scenes.userId, userId));
}

export const load: PageServerLoad = async ({ locals, params, parent }) => {
	if (!locals.user) throw redirect(303, '/login');
	const layoutData = await parent();
	const orgId = layoutData.organization?.id ?? null;
	const planConfig = layoutData.planConfig;
	const scene = await db.query.scenes.findFirst({
		where: buildSceneAccessWhere(params.id, locals.user.id, orgId)
	});
	if (!scene) throw redirect(303, '/app/sizeup');
	if (!scene.baseImageUrl && scene.captureMeta?.panoId) {
		try {
			const buffer = await fetchStreetViewStatic(scene.captureMeta.panoId, scene.captureMeta.heading, scene.captureMeta.pitch, scene.captureMeta.fov, '640x640');
			if (buffer) {
				const file = new File([new Uint8Array(buffer)], `scene-${params.id}.jpg`, { type: 'image/jpeg' });
				const utapi = new UTApi();
				const uploadResult = await utapi.uploadFiles(file);
				if (uploadResult.data?.ufsUrl) {
					await db.update(scenes).set({ baseImageUrl: uploadResult.data.ufsUrl }).where(eq(scenes.id, params.id));
					scene.baseImageUrl = uploadResult.data.ufsUrl;
				}
			}
		} catch (err) { console.error('Image generation failed:', err); }
	}
	return { scene, planConfig };
};

export const actions: Actions = {
	generateShareLink: async ({ locals, request, url }) => {
		if (!locals.user) throw redirect(303, '/login');
		const form = await request.formData();
		const sceneId = String(form.get('sceneId') ?? '');
		const membership = await db.query.organizationMembers.findFirst({
			where: eq(organizationMembers.userId, locals.user.id),
			with: { organization: true }
		});
		const orgId = membership?.organizationId ?? null;
		const planConfig = getPlanConfig(normalizePlanId(membership?.organization?.planId));
		if (!planConfig.canShareLink) return fail(403, { error: 'Sharing requires Department plan.' });
		const scene = await db.query.scenes.findFirst({
			where: buildSceneAccessWhere(sceneId, locals.user.id, orgId),
			columns: { id: true, shareToken: true }
		});
		if (!scene) return fail(404, { error: 'Scene not found.' });
		let token = scene.shareToken;
		if (!token) { token = crypto.randomUUID(); await db.update(scenes).set({ shareToken: token }).where(eq(scenes.id, sceneId)); }
		return { shareUrl: `${url.origin}/share/${token}` };
	}
};
