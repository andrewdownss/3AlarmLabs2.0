import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { organizationMembers, trainerScenarios } from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(303, '/login');
	return {};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.user) throw redirect(303, '/login');
		const form = await request.formData();
		const title = String(form.get('title') ?? '').trim();
		if (!title) return fail(400, { formError: 'Title is required.' });

		const id = crypto.randomUUID();
		const membership = await db.query.organizationMembers.findFirst({
			where: eq(organizationMembers.userId, locals.user.id),
			columns: { organizationId: true }
		});

		await db.insert(trainerScenarios).values({
			id,
			title,
			description: String(form.get('description') ?? '').trim() || null,
			organizationId: membership?.organizationId ?? null,
			createdBy: locals.user.id,
			constructionType: String(form.get('constructionType') ?? '').trim() || null,
			address: String(form.get('address') ?? '').trim() || null,
			occupancyType: String(form.get('occupancyType') ?? '').trim() || null,
			alarmLevel: String(form.get('alarmLevel') ?? '').trim() || null
		});

		throw redirect(303, `/app/command/scenarios/${id}`);
	}
};
