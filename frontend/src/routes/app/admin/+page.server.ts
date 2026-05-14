import { fail, redirect } from '@sveltejs/kit';
import { and, count, desc, eq, gt } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { organizations, trainerScenarios, user as userTable } from '$lib/server/db/schema';
import type { PlanId } from '$lib/plans';

function requireAdmin(locals: App.Locals) {
	if (!locals.user) throw redirect(303, '/login');
	if (!locals.user.isAdmin) throw redirect(303, '/app/sizeup');
	return locals.user;
}

export const load: PageServerLoad = async ({ locals }) => {
	requireAdmin(locals);

	const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

	const [
		userCountResult,
		orgCountResult,
		newUserCountResult,
		orgPlanCountsRaw,
		libraryScenarios,
		userSimulations
	] = await Promise.all([
		db.select({ value: count() }).from(userTable),
		db.select({ value: count() }).from(organizations),
		db.select({ value: count() }).from(userTable).where(gt(userTable.createdAt, since)),
		db
			.select({ planId: organizations.planId, value: count() })
			.from(organizations)
			.groupBy(organizations.planId),
		db.query.trainerScenarios.findMany({
			where: eq(trainerScenarios.isLibrary, true),
			orderBy: [desc(trainerScenarios.isDemoScenario), desc(trainerScenarios.updatedAt)],
			columns: {
				id: true,
				title: true,
				publishedAt: true,
				isDemoScenario: true
			}
		}),
		db.query.trainerScenarios.findMany({
			where: eq(trainerScenarios.isLibrary, false),
			orderBy: [desc(trainerScenarios.updatedAt)],
			limit: 100,
			columns: {
				id: true,
				title: true,
				description: true,
				constructionType: true,
				alarmLevel: true,
				createdAt: true,
				updatedAt: true
			},
			with: {
				creator: {
					columns: { id: true, name: true, email: true }
				},
				organization: {
					columns: { id: true, name: true, planId: true }
				}
			}
		})
	]);

	const orgPlanCounts = (orgPlanCountsRaw ?? []).map((row) => ({
		planId: row.planId as PlanId,
		count: row.value
	}));

	return {
		userCount: userCountResult[0]?.value ?? 0,
		newUserCount30d: newUserCountResult[0]?.value ?? 0,
		organizationCount: orgCountResult[0]?.value ?? 0,
		orgPlanCounts,
		libraryScenarios,
		demoScenario: libraryScenarios.find((scenario) => scenario.isDemoScenario) ?? null,
		userSimulations
	};
};

export const actions: Actions = {
	setDemoScenario: async ({ locals, request }) => {
		requireAdmin(locals);

		const form = await request.formData();
		const scenarioId = String(form.get('scenarioId') ?? '').trim();
		if (!scenarioId) return fail(400, { error: 'Choose a library simulation.' });

		const scenario = await db.query.trainerScenarios.findFirst({
			where: and(eq(trainerScenarios.id, scenarioId), eq(trainerScenarios.isLibrary, true)),
			columns: { id: true }
		});
		if (!scenario) return fail(404, { error: 'Library simulation not found.' });

		await db.transaction(async (tx) => {
			await tx
				.update(trainerScenarios)
				.set({ isDemoScenario: false })
				.where(eq(trainerScenarios.isDemoScenario, true));
			await tx
				.update(trainerScenarios)
				.set({ isDemoScenario: true })
				.where(and(eq(trainerScenarios.id, scenarioId), eq(trainerScenarios.isLibrary, true)));
		});

		return { success: true };
	}
};
