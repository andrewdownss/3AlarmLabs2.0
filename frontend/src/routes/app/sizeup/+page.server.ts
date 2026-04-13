import { fail, redirect } from '@sveltejs/kit';
import { eq, and, desc, count } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { scenes, folders, organizationMembers } from '$lib/server/db/schema';
import { invalidateLayoutCache } from '$lib/server/cache';
import { canCreateScene, getPlanConfig, normalizePlanId } from '$lib/plans';
import type { PageServerLoad, Actions } from './$types';
import crypto from 'node:crypto';

export const load: PageServerLoad = async ({ locals, url, parent }) => {
	if (!locals.user) throw redirect(303, '/login');

	const layoutData = await parent();
	const org = layoutData.organization ?? null;
	const planConfig = layoutData.planConfig;

	const orgId = org?.id;

	const activeFolderId = url.searchParams.get('folder') ?? null;

	const sceneListColumns = {
		id: scenes.id,
		userId: scenes.userId,
		organizationId: scenes.organizationId,
		folderId: scenes.folderId,
		title: scenes.title,
		baseImageUrl: scenes.baseImageUrl,
		captureMeta: scenes.captureMeta,
		updatedAt: scenes.updatedAt
	};

	const [sceneRows, folderRows, sceneCountResult] = await Promise.all([
		orgId
			? db
					.select(sceneListColumns)
					.from(scenes)
					.where(
						activeFolderId
							? and(eq(scenes.organizationId, orgId), eq(scenes.folderId, activeFolderId))
							: eq(scenes.organizationId, orgId)
					)
					.orderBy(desc(scenes.updatedAt))
			: db
					.select(sceneListColumns)
					.from(scenes)
					.where(eq(scenes.userId, locals.user.id))
					.orderBy(desc(scenes.updatedAt)),
		orgId
			? db
					.select({ id: folders.id, name: folders.name, organizationId: folders.organizationId })
					.from(folders)
					.where(eq(folders.organizationId, orgId))
			: Promise.resolve([]),
		orgId
			? db.select({ value: count() }).from(scenes).where(eq(scenes.organizationId, orgId))
			: db.select({ value: count() }).from(scenes).where(eq(scenes.userId, locals.user.id))
	]);

	const sceneCount = sceneCountResult[0]?.value ?? 0;

	return {
		scenes: sceneRows,
		folders: folderRows,
		activeFolderId,
		sceneCount,
		planConfig,
		canCreateScene: canCreateScene(planConfig, sceneCount)
	};
};

export const actions: Actions = {
	deleteScene: async ({ request, locals }) => {
		if (!locals.user) throw redirect(303, '/login');
		const membership = await db.query.organizationMembers.findFirst({
			where: eq(organizationMembers.userId, locals.user.id),
			columns: { organizationId: true }
		});
		const orgId = membership?.organizationId ?? null;

		const form = await request.formData();
		const sceneId = String(form.get('sceneId') ?? '');
		if (!sceneId) return fail(400, { error: 'Missing scene ID' });

		const scene = await db.query.scenes.findFirst({
			where: orgId
				? and(eq(scenes.id, sceneId), eq(scenes.organizationId, orgId))
				: and(eq(scenes.id, sceneId), eq(scenes.userId, locals.user.id))
		});
		if (!scene) return fail(404, { error: 'Scene not found' });

		await db.delete(scenes).where(eq(scenes.id, sceneId));
		invalidateLayoutCache(locals.user.id);

		return { success: true };
	},

	createFolder: async ({ request, locals }) => {
		if (!locals.user) throw redirect(303, '/login');

		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		if (!name) return fail(400, { error: 'Folder name is required' });

		const membership = await db.query.organizationMembers.findFirst({
			where: eq(organizationMembers.userId, locals.user.id),
			with: { organization: true }
		});
		if (!membership?.organization) return fail(400, { error: 'No organization found' });
		const planConfig = getPlanConfig(normalizePlanId(membership.organization.planId));
		if (!planConfig.canUseFolders) return fail(403, { error: 'Your plan does not support folders' });

		await db.insert(folders).values({
			id: `fld_${crypto.randomUUID()}`,
			organizationId: membership.organization.id,
			name
		});

		return { success: true };
	},

	renameFolder: async ({ request, locals }) => {
		if (!locals.user) throw redirect(303, '/login');

		const form = await request.formData();
		const folderId = String(form.get('folderId') ?? '');
		const name = String(form.get('name') ?? '').trim();
		if (!folderId || !name) return fail(400, { error: 'Folder ID and name are required' });

		await db.update(folders).set({ name }).where(eq(folders.id, folderId));
		return { success: true };
	},

	deleteFolder: async ({ request, locals }) => {
		if (!locals.user) throw redirect(303, '/login');

		const form = await request.formData();
		const folderId = String(form.get('folderId') ?? '');
		if (!folderId) return fail(400, { error: 'Folder ID is required' });

		await db.update(scenes).set({ folderId: null }).where(eq(scenes.folderId, folderId));
		await db.delete(folders).where(eq(folders.id, folderId));

		throw redirect(303, '/app/sizeup');
	},

	moveSceneToFolder: async ({ request, locals }) => {
		if (!locals.user) throw redirect(303, '/login');
		const membership = await db.query.organizationMembers.findFirst({
			where: eq(organizationMembers.userId, locals.user.id),
			columns: { organizationId: true }
		});
		const orgId = membership?.organizationId ?? null;

		const form = await request.formData();
		const sceneId = String(form.get('sceneId') ?? '');
		const folderId = form.get('folderId') ? String(form.get('folderId')) : null;
		if (!sceneId) return fail(400, { error: 'Scene ID is required' });

		await db
			.update(scenes)
			.set({ folderId })
			.where(
				orgId
					? and(eq(scenes.id, sceneId), eq(scenes.organizationId, orgId))
					: and(eq(scenes.id, sceneId), eq(scenes.userId, locals.user.id))
			);

		return { success: true };
	}
};
