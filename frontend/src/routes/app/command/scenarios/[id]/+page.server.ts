import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { organizationMembers, trainerScenarios } from '$lib/server/db/schema';
import { getUtApi } from '$lib/server/utapi';
import { isValidSelfPacedConfig, type SelfPacedConfig } from '$lib/self-paced';
import { canEditLibrary, canOpenScenarioById } from '$lib/server/library-access';

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
	openAnyScenario = false
) {
	if (openAnyScenario) return eq(trainerScenarios.id, scenarioId);
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

function canAccessScenario(user: NonNullable<App.Locals['user']>) {
	return canOpenScenarioById(user);
}

function canEditLibraryScenario(user: NonNullable<App.Locals['user']>) {
	return canEditLibrary(user);
}

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) throw redirect(303, '/login');
	const organizationId = await resolveOrgId(locals.user.id);
	const scenario = await db.query.trainerScenarios.findFirst({
		where: scenarioAccessFilter(
			locals.user.id,
			organizationId,
			params.id,
			canAccessScenario(locals.user)
		)
	});
	if (!scenario) throw redirect(303, '/app/command');
	return {
		scenario,
		user: locals.user,
		canEditLibrary: canEditLibraryScenario(locals.user)
	};
};

export const actions: Actions = {
	update: async ({ locals, params, request }) => {
		if (!locals.user) throw redirect(303, '/login');
		const organizationId = await resolveOrgId(locals.user.id);
		const existingScenario = await db.query.trainerScenarios.findFirst({
			where: scenarioAccessFilter(
				locals.user.id,
				organizationId,
				params.id,
				canAccessScenario(locals.user)
			),
			columns: { isLibrary: true }
		});
		if (!existingScenario) return fail(404, { formError: 'Scenario not found.' });
		if (existingScenario.isLibrary && !canEditLibraryScenario(locals.user)) {
			return fail(403, { formError: 'You do not have permission to edit library scenarios.' });
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
			.where(
				scenarioAccessFilter(
					locals.user.id,
					organizationId,
					params.id,
					canAccessScenario(locals.user)
				)
			);

		return { success: true };
	},
	updateSelfPacedConfig: async ({ locals, params, request }) => {
		if (!locals.user) throw redirect(303, '/login');
		const organizationId = await resolveOrgId(locals.user.id);
		const existingScenario = await db.query.trainerScenarios.findFirst({
			where: scenarioAccessFilter(
				locals.user.id,
				organizationId,
				params.id,
				canAccessScenario(locals.user)
			),
			columns: { isLibrary: true }
		});
		if (!existingScenario) return fail(404, { selfPacedError: 'Scenario not found.' });
		if (existingScenario.isLibrary && !canEditLibraryScenario(locals.user)) {
			return fail(403, { selfPacedError: 'You do not have permission to edit library scenarios.' });
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
			.where(
				scenarioAccessFilter(
					locals.user.id,
					organizationId,
					params.id,
					canAccessScenario(locals.user)
				)
			);

		return { selfPacedSaved: true };
	},
	uploadSideImage: async ({ locals, params, request }) => {
		if (!locals.user) throw redirect(303, '/login');
		const organizationId = await resolveOrgId(locals.user.id);
		const existingScenario = await db.query.trainerScenarios.findFirst({
			where: scenarioAccessFilter(
				locals.user.id,
				organizationId,
				params.id,
				canAccessScenario(locals.user)
			),
			columns: { isLibrary: true }
		});
		if (!existingScenario) return fail(404, { error: 'Scenario not found.' });
		if (existingScenario.isLibrary && !canEditLibraryScenario(locals.user)) {
			return fail(403, { error: 'You do not have permission to edit library scenarios.' });
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
			.where(
				scenarioAccessFilter(
					locals.user.id,
					organizationId,
					params.id,
					canAccessScenario(locals.user)
				)
			);

		return { success: true };
	},
	addResource: async ({ locals, params, request }) => {
		if (!locals.user) throw redirect(303, '/login');
		const organizationId = await resolveOrgId(locals.user.id);
		const form = await request.formData();
		const unitName = String(form.get('unitName') ?? '').trim();
		if (!unitName) return fail(400, { error: 'Unit name required.' });

		const scenario = await db.query.trainerScenarios.findFirst({
			where: scenarioAccessFilter(
				locals.user.id,
				organizationId,
				params.id,
				canAccessScenario(locals.user)
			),
			columns: { defaultResources: true, isLibrary: true }
		});
		if (!scenario) return fail(404);
		if (scenario.isLibrary && !canEditLibraryScenario(locals.user)) {
			return fail(403, { error: 'You do not have permission to edit library scenarios.' });
		}

		const existingResources = scenario.defaultResources ?? [];
		const resources = existingResources.some((resource) => resource.unitName === unitName)
			? existingResources
			: [...existingResources, { unitName, status: 'available' }];
		await db
			.update(trainerScenarios)
			.set({ defaultResources: resources })
			.where(
				scenarioAccessFilter(
					locals.user.id,
					organizationId,
					params.id,
					canAccessScenario(locals.user)
				)
			);
		return { success: true };
	},
	removeResource: async ({ locals, params, request }) => {
		if (!locals.user) throw redirect(303, '/login');
		const organizationId = await resolveOrgId(locals.user.id);
		const form = await request.formData();
		const unitName = String(form.get('unitName') ?? '');

		const scenario = await db.query.trainerScenarios.findFirst({
			where: scenarioAccessFilter(
				locals.user.id,
				organizationId,
				params.id,
				canAccessScenario(locals.user)
			),
			columns: { defaultResources: true, isLibrary: true }
		});
		if (!scenario) return fail(404);
		if (scenario.isLibrary && !canEditLibraryScenario(locals.user)) {
			return fail(403, { error: 'You do not have permission to edit library scenarios.' });
		}

		const resources = (scenario.defaultResources ?? []).filter((r) => r.unitName !== unitName);
		await db
			.update(trainerScenarios)
			.set({ defaultResources: resources })
			.where(
				scenarioAccessFilter(
					locals.user.id,
					organizationId,
					params.id,
					canAccessScenario(locals.user)
				)
			);
		return { success: true };
	},
	publishToLibrary: async ({ locals, params, request }) => {
		if (!locals.user) throw redirect(303, '/login');
		if (!canEditLibraryScenario(locals.user)) {
			return fail(403, { error: 'You do not have permission to manage library publishing.' });
		}

		const existing = await db.query.trainerScenarios.findFirst({
			where: eq(trainerScenarios.id, params.id),
			columns: { isLibrary: true }
		});
		if (!existing) return fail(404, { error: 'Scenario not found.' });

		const form = await request.formData();
		const isLibrary = form.get('isLibrary') === 'on';
		if (isLibrary !== existing.isLibrary && !locals.user.isAdmin) {
			return fail(403, { error: 'Only admins can add or remove scenarios from the library catalog.' });
		}

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
