import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { organizationMembers, trainerScenarios } from '$lib/server/db/schema';
import { getUtApi } from '$lib/server/utapi';
import { isValidSelfPacedConfig, type SelfPacedConfig } from '$lib/self-paced';

async function resolveOrgId(userId: string): Promise<string | null> {
	const membership = await db.query.organizationMembers.findFirst({
		where: eq(organizationMembers.userId, userId),
		columns: { organizationId: true }
	});
	return membership?.organizationId ?? null;
}

function scenarioAccessFilter(
	userId: string,
	organizationId: string | null,
	scenarioId: string,
	isAdmin = false
) {
	if (isAdmin) return eq(trainerScenarios.id, scenarioId);
	if (organizationId) {
		return and(
			eq(trainerScenarios.id, scenarioId),
			eq(trainerScenarios.organizationId, organizationId)
		);
	}

	return and(
		eq(trainerScenarios.id, scenarioId),
		eq(trainerScenarios.createdBy, userId),
		isNull(trainerScenarios.organizationId)
	);
}

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) throw redirect(303, '/login');
	const organizationId = await resolveOrgId(locals.user.id);
	const scenario = await db.query.trainerScenarios.findFirst({
		where: scenarioAccessFilter(locals.user.id, organizationId, params.id, locals.user.isAdmin)
	});
	if (!scenario) throw redirect(303, '/app/command');
	return { scenario, user: locals.user };
};

export const actions: Actions = {
	update: async ({ locals, params, request }) => {
		if (!locals.user) throw redirect(303, '/login');
		const organizationId = await resolveOrgId(locals.user.id);
		const existingScenario = await db.query.trainerScenarios.findFirst({
			where: scenarioAccessFilter(locals.user.id, organizationId, params.id, locals.user.isAdmin),
			columns: { isLibrary: true }
		});
		if (!existingScenario) return fail(404, { formError: 'Scenario not found.' });
		if (existingScenario.isLibrary && !locals.user.isAdmin) {
			return fail(403, { formError: 'Only admins can edit library scenarios.' });
		}
		const form = await request.formData();
		const title = String(form.get('title') ?? '').trim();
		if (!title) return fail(400, { formError: 'Title is required.' });

		const stageMetadataRaw = String(form.get('stageMetadataJson') ?? '').trim();
		let stageMetadataJson: Record<string, unknown> | undefined;
		if (stageMetadataRaw) {
			try {
				stageMetadataJson = JSON.parse(stageMetadataRaw);
			} catch {
				/* keep existing */
			}
		}

		await db
			.update(trainerScenarios)
			.set({
				title,
				description: String(form.get('description') ?? '').trim() || null,
				constructionType: String(form.get('constructionType') ?? '').trim() || null,
				alarmLevel: String(form.get('alarmLevel') ?? '').trim() || null,
				address: String(form.get('address') ?? '').trim() || null,
				occupancyType: String(form.get('occupancyType') ?? '').trim() || null,
				dispatchNotes: String(form.get('dispatchNotes') ?? '').trim() || null,
				...(stageMetadataJson !== undefined ? { stageMetadataJson } : {})
			})
			.where(scenarioAccessFilter(locals.user.id, organizationId, params.id, locals.user.isAdmin));

		return { success: true };
	},
	updateSelfPacedConfig: async ({ locals, params, request }) => {
		if (!locals.user) throw redirect(303, '/login');
		const organizationId = await resolveOrgId(locals.user.id);
		const existingScenario = await db.query.trainerScenarios.findFirst({
			where: scenarioAccessFilter(locals.user.id, organizationId, params.id, locals.user.isAdmin),
			columns: { isLibrary: true }
		});
		if (!existingScenario) return fail(404, { selfPacedError: 'Scenario not found.' });
		if (existingScenario.isLibrary && !locals.user.isAdmin) {
			return fail(403, { selfPacedError: 'Only admins can edit library scenarios.' });
		}
		const form = await request.formData();
		const raw = String(form.get('selfPacedConfigJson') ?? '').trim();

		let configValue: SelfPacedConfig | null;
		if (!raw) {
			configValue = null;
		} else {
			let parsed: unknown;
			try {
				parsed = JSON.parse(raw);
			} catch {
				return fail(400, { selfPacedError: 'Invalid JSON.' });
			}
			if (!isValidSelfPacedConfig(parsed)) {
				return fail(400, {
					selfPacedError:
						'Config is missing required fields (timeline, expectedActions, assignmentCompletions, endConditions).'
				});
			}
			configValue = parsed;
		}

		await db
			.update(trainerScenarios)
			.set({ selfPacedConfigJson: configValue })
			.where(scenarioAccessFilter(locals.user.id, organizationId, params.id, locals.user.isAdmin));

		return { selfPacedSaved: true };
	},
	uploadSideImage: async ({ locals, params, request }) => {
		if (!locals.user) throw redirect(303, '/login');
		const organizationId = await resolveOrgId(locals.user.id);
		const existingScenario = await db.query.trainerScenarios.findFirst({
			where: scenarioAccessFilter(locals.user.id, organizationId, params.id, locals.user.isAdmin),
			columns: { isLibrary: true }
		});
		if (!existingScenario) return fail(404, { error: 'Scenario not found.' });
		if (existingScenario.isLibrary && !locals.user.isAdmin) {
			return fail(403, { error: 'Only admins can edit library scenarios.' });
		}
		const form = await request.formData();
		const side = String(form.get('side') ?? '');
		const file = form.get('file') as File;

		const validSides = [
			'sideAlphaImageUrl',
			'sideBravoImageUrl',
			'sideCharlieImageUrl',
			'sideDeltaImageUrl'
		];
		if (!validSides.includes(side)) return fail(400, { error: 'Invalid side.' });
		if (!file || file.size === 0) return fail(400, { error: 'No file provided.' });

		const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
		if (file.size > MAX_UPLOAD_BYTES) {
			return fail(413, {
				error: `Image is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 10 MB — try resizing or exporting at a lower quality.`
			});
		}

		const utapi = getUtApi();
		const uploadResult = await utapi.uploadFiles(file);
		if (uploadResult.error) {
			console.error('[uploadSideImage]', uploadResult.error);
			return fail(500, { error: 'Upload failed.', detail: String(uploadResult.error) });
		}
		if (!uploadResult.data?.ufsUrl) return fail(500, { error: 'Upload failed.' });

		await db
			.update(trainerScenarios)
			.set({
				[side]: uploadResult.data.ufsUrl
			})
			.where(scenarioAccessFilter(locals.user.id, organizationId, params.id, locals.user.isAdmin));

		return { success: true };
	},
	addResource: async ({ locals, params, request }) => {
		if (!locals.user) throw redirect(303, '/login');
		const organizationId = await resolveOrgId(locals.user.id);
		const form = await request.formData();
		const unitName = String(form.get('unitName') ?? '').trim();
		if (!unitName) return fail(400, { error: 'Unit name required.' });

		const scenario = await db.query.trainerScenarios.findFirst({
			where: scenarioAccessFilter(locals.user.id, organizationId, params.id, locals.user.isAdmin),
			columns: { defaultResources: true, isLibrary: true }
		});
		if (!scenario) return fail(404);
		if (scenario.isLibrary && !locals.user.isAdmin) {
			return fail(403, { error: 'Only admins can edit library scenarios.' });
		}

		const existingResources = scenario.defaultResources ?? [];
		const resources = existingResources.some((resource) => resource.unitName === unitName)
			? existingResources
			: [...existingResources, { unitName, status: 'available' }];
		await db
			.update(trainerScenarios)
			.set({ defaultResources: resources })
			.where(scenarioAccessFilter(locals.user.id, organizationId, params.id, locals.user.isAdmin));
		return { success: true };
	},
	removeResource: async ({ locals, params, request }) => {
		if (!locals.user) throw redirect(303, '/login');
		const organizationId = await resolveOrgId(locals.user.id);
		const form = await request.formData();
		const unitName = String(form.get('unitName') ?? '');

		const scenario = await db.query.trainerScenarios.findFirst({
			where: scenarioAccessFilter(locals.user.id, organizationId, params.id, locals.user.isAdmin),
			columns: { defaultResources: true, isLibrary: true }
		});
		if (!scenario) return fail(404);
		if (scenario.isLibrary && !locals.user.isAdmin) {
			return fail(403, { error: 'Only admins can edit library scenarios.' });
		}

		const resources = (scenario.defaultResources ?? []).filter((r) => r.unitName !== unitName);
		await db
			.update(trainerScenarios)
			.set({ defaultResources: resources })
			.where(scenarioAccessFilter(locals.user.id, organizationId, params.id, locals.user.isAdmin));
		return { success: true };
	},
	publishToLibrary: async ({ locals, params, request }) => {
		if (!locals.user) throw redirect(303, '/login');
		if (!locals.user.isAdmin)
			return fail(403, { error: 'Only admins can publish library scenarios.' });

		const form = await request.formData();
		const isLibrary = form.get('isLibrary') === 'on';
		const rawPublishedAt = String(form.get('publishedAt') ?? '').trim();
		const publishedAt = isLibrary ? (rawPublishedAt ? new Date(rawPublishedAt) : new Date()) : null;

		if (publishedAt && Number.isNaN(publishedAt.getTime())) {
			return fail(400, { error: 'Enter a valid publish date.' });
		}

		await db
			.update(trainerScenarios)
			.set({
				isLibrary,
				publishedAt,
				...(isLibrary ? { organizationId: null } : {})
			})
			.where(eq(trainerScenarios.id, params.id));

		return { published: true };
	}
};
