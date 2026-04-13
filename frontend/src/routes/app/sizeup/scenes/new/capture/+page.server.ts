import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { scenes } from '$lib/server/db/schema';
import { fetchStreetViewStatic } from '$lib/server/streetview-static';
import { UTApi } from 'uploadthing/server';

function toNumber(value: FormDataEntryValue | null) {
	const n = Number(value);
	return Number.isFinite(n) ? n : null;
}

function zoomToFov(zoom: number | null) {
	if (zoom === null) return 90;
	const raw = 180 / Math.pow(2, Math.max(0, zoom));
	return Math.max(10, Math.min(120, Math.round(raw)));
}

export const load: PageServerLoad = async ({ url, locals }) => {
	if (!locals.user) throw redirect(303, '/login');
	const sceneId = url.searchParams.get('sceneId');
	if (!sceneId) throw redirect(303, '/app/sizeup/scenes/new');
	const scene = await db.query.scenes.findFirst({
		where: and(eq(scenes.id, sceneId), eq(scenes.userId, locals.user.id)),
		columns: { id: true, title: true }
	});
	if (!scene) throw redirect(303, '/app/sizeup/scenes/new');
	return { scene };
};

export const actions: Actions = {
	default: async ({ request, locals, url }) => {
		if (!locals.user) throw redirect(303, '/login');
		const sceneId = url.searchParams.get('sceneId');
		if (!sceneId) throw redirect(303, '/app/sizeup/scenes/new');
		const form = await request.formData();
		const lat = toNumber(form.get('lat'));
		const lng = toNumber(form.get('lng'));
		const heading = toNumber(form.get('heading'));
		const pitch = toNumber(form.get('pitch'));
		const zoom = toNumber(form.get('zoom'));
		const panoIdRaw = String(form.get('panoId') ?? '').trim();
		if (lat === null || lng === null || heading === null || pitch === null) {
			return fail(400, { formError: 'Please pick a Street View location before continuing.' });
		}
		const fov = zoomToFov(zoom);
		const panoId = panoIdRaw ? panoIdRaw : undefined;
		let baseImageUrl: string | undefined;
		if (panoId) {
			try {
				const buffer = await fetchStreetViewStatic(panoId, heading, pitch, fov, '640x640');
				if (buffer) {
					const file = new File([new Uint8Array(buffer)], `scene-${sceneId}.jpg`, { type: 'image/jpeg' });
					const utapi = new UTApi();
					const uploadResult = await utapi.uploadFiles(file);
					if (uploadResult.data?.ufsUrl) baseImageUrl = uploadResult.data.ufsUrl;
				}
			} catch (err) {
				console.error('Street View capture failed:', err);
			}
		}
		await db.update(scenes).set({
			captureMeta: { lat, lng, heading, pitch, fov, panoId },
			...(baseImageUrl ? { baseImageUrl } : {})
		}).where(and(eq(scenes.id, sceneId), eq(scenes.userId, locals.user.id)));
		throw redirect(303, `/app/sizeup/scenes/${encodeURIComponent(sceneId)}/edit`);
	}
};
