import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { and, desc, eq, lte } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { trainerScenarios } from '$lib/server/db/schema';
import {
	canEditLibrary,
	canManageLibraryCatalog,
	canViewLibrary
} from '$lib/server/library-access';

type LibraryStatus = 'published' | 'scheduled' | 'draft';

function libraryStatus(publishedAt: Date | null, now: Date): LibraryStatus {
	if (!publishedAt) return 'draft';
	return publishedAt <= now ? 'published' : 'scheduled';
}

export const load: PageServerLoad = async ({ locals, parent }) => {
	if (!locals.user) throw redirect(303, '/login');

	const { planConfig } = await parent();
	if (!canViewLibrary(locals.user, planConfig)) throw redirect(303, '/app/settings/billing');

	const now = new Date();
	const canManage = canManageLibraryCatalog(locals.user);
	const scenarios = await db.query.trainerScenarios.findMany({
		where: canManage
			? eq(trainerScenarios.isLibrary, true)
			: and(eq(trainerScenarios.isLibrary, true), lte(trainerScenarios.publishedAt, now)),
		orderBy: [desc(trainerScenarios.publishedAt), desc(trainerScenarios.updatedAt)],
		columns: {
			id: true,
			title: true,
			description: true,
			constructionType: true,
			alarmLevel: true,
			sideAlphaImageUrl: true,
			createdAt: true,
			updatedAt: true,
			publishedAt: true,
			isLibrary: true
		}
	});

	const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
	return {
		user: locals.user,
		canManageLibrary: canManage,
		scenarios: scenarios.map((scenario) => ({
			...scenario,
			status: libraryStatus(scenario.publishedAt, now),
			isNewThisWeek: Boolean(scenario.publishedAt && scenario.publishedAt > weekAgo)
		}))
	};
};

export const actions: Actions = {
	createLibraryScenario: async ({ locals }) => {
		if (!locals.user) throw redirect(303, '/login');
		if (!canEditLibrary(locals.user))
			return fail(403, { error: 'You do not have permission to create library scenarios.' });

		const id = crypto.randomUUID();
		await db.insert(trainerScenarios).values({
			id,
			title: 'Untitled 3AlarmLabs Simulation',
			description: null,
			organizationId: null,
			createdBy: locals.user.id,
			isLibrary: true,
			publishedAt: null
		});

		throw redirect(303, `/app/command/scenarios/${id}`);
	},
	deleteLibraryScenario: async ({ locals, request }) => {
		if (!locals.user) throw redirect(303, '/login');
		if (!canEditLibrary(locals.user))
			return fail(403, { error: 'You do not have permission to delete library scenarios.' });

		const form = await request.formData();
		const scenarioId = String(form.get('scenarioId') ?? '');
		if (!scenarioId) return fail(400, { error: 'Missing scenario ID.' });

		const deleted = await db
			.delete(trainerScenarios)
			.where(and(eq(trainerScenarios.id, scenarioId), eq(trainerScenarios.isLibrary, true)))
			.returning({ id: trainerScenarios.id });

		if (deleted.length === 0) return fail(404, { error: 'Library scenario not found.' });
		return { deleted: true };
	}
};
