import type { PageServerLoad } from './$types';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { trainerScenarios } from '$lib/server/db/schema';

export const load: PageServerLoad = async () => {
	const demoScenario = await db.query.trainerScenarios.findFirst({
		where: and(eq(trainerScenarios.isLibrary, true), eq(trainerScenarios.isDemoScenario, true)),
		columns: {
			id: true,
			title: true,
			description: true,
			constructionType: true,
			alarmLevel: true,
			sideAlphaImageUrl: true,
			sideBravoImageUrl: true,
			sideCharlieImageUrl: true,
			sideDeltaImageUrl: true,
			dispatchNotes: true,
			selfPacedConfigJson: true,
			defaultResources: true
		}
	});

	return { demoScenario };
};
