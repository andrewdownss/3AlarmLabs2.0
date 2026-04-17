import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { organizationMembers, scenes } from '$lib/server/db/schema';
import { fetchStreetViewStatic } from '$lib/server/streetview-static';
import { getUtApi } from '$lib/server/utapi';

function buildSceneAccessWhere(sceneId: string, userId: string, organizationId: string | null) {
	return organizationId
		? and(eq(scenes.id, sceneId), eq(scenes.organizationId, organizationId))
		: and(eq(scenes.id, sceneId), eq(scenes.userId, userId));
}

export const load: PageServerLoad = async ({ locals, params, parent }) => {
	if (!locals.user) throw redirect(303, '/login');
	const layoutData = await parent();
	const orgId = layoutData.organization?.id ?? null;
	const scene = await db.query.scenes.findFirst({
		where: buildSceneAccessWhere(params.id, locals.user.id, orgId)
	});
	if (!scene) throw redirect(303, '/app/sizeup');
	return { scene, needsHiRes: !scene.baseImageUrl && !!scene.captureMeta?.panoId };
};

function parseOverlaysJson(raw: string) {
	if (!raw) return null;
	try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed : null; }
	catch { return null; }
}

export const actions: Actions = {
	save: async ({ locals, params, request }) => {
		if (!locals.user) throw redirect(303, '/login');
		const membership = await db.query.organizationMembers.findFirst({
			where: eq(organizationMembers.userId, locals.user.id),
			columns: { organizationId: true }
		});
		const orgId = membership?.organizationId ?? null;
		const scene = await db.query.scenes.findFirst({
			where: buildSceneAccessWhere(params.id, locals.user.id, orgId)
		});
		if (!scene) return fail(404, { formError: 'Scene not found.' });
		const form = await request.formData();
		const overlaysJson = parseOverlaysJson(String(form.get('overlaysJson') ?? ''));
		if (!overlaysJson) return fail(400, { formError: 'Invalid overlay data.' });
		await db
			.update(scenes)
			.set({ overlaysJson })
			.where(buildSceneAccessWhere(params.id, locals.user.id, orgId));
		return { success: true };
	},
	generateHiRes: async ({ locals, params }) => {
		if (!locals.user) throw redirect(303, '/login');
		const membership = await db.query.organizationMembers.findFirst({
			where: eq(organizationMembers.userId, locals.user.id),
			columns: { organizationId: true }
		});
		const orgId = membership?.organizationId ?? null;
		const scene = await db.query.scenes.findFirst({
			where: buildSceneAccessWhere(params.id, locals.user.id, orgId)
		});
		if (!scene) return fail(404, { formError: 'Scene not found.' });
		const meta = scene.captureMeta;
		if (!meta?.panoId) return fail(400, { formError: 'No panorama ID.' });
		try {
			const buffer = await fetchStreetViewStatic(meta.panoId, meta.heading, meta.pitch, meta.fov, '640x640');
			if (!buffer) return fail(500, { formError: 'Failed to fetch Street View image.' });
			const file = new File([new Uint8Array(buffer)], `scene-${params.id}.jpg`, { type: 'image/jpeg' });
			const utapi = getUtApi();
			const uploadResult = await utapi.uploadFiles(file);
			if (!uploadResult.data?.ufsUrl) return fail(500, { formError: 'Image upload failed.' });
			await db
				.update(scenes)
				.set({ baseImageUrl: uploadResult.data.ufsUrl })
				.where(buildSceneAccessWhere(params.id, locals.user.id, orgId));
			return { hiResGenerated: true, baseImageUrl: uploadResult.data.ufsUrl };
		} catch (err) {
			console.error('Hi-res generation failed:', err);
			return fail(500, { formError: 'Failed to generate high-res image.' });
		}
	}
};
