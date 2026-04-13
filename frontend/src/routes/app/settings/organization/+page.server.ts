import { fail, redirect } from '@sveltejs/kit';
import { and, eq, isNull } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import {
	organizationMembers,
	organizations,
	scenes,
	trainerScenarios
} from '$lib/server/db/schema';
import { allocateUniqueOrganizationJoinCode } from '$lib/server/join-code';
import { invalidateLayoutCache } from '$lib/server/cache';
import crypto from 'node:crypto';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(303, '/login');

	const existing = await db.query.organizationMembers.findFirst({
		where: eq(organizationMembers.userId, locals.user.id),
		columns: { organizationId: true }
	});

	if (existing) {
		throw redirect(303, '/app/sizeup');
	}

	return {};
};

export const actions: Actions = {
	default: async ({ locals, request }) => {
		const user = locals.user;
		if (!user) throw redirect(303, '/login');

		const existing = await db.query.organizationMembers.findFirst({
			where: eq(organizationMembers.userId, user.id),
			columns: { id: true }
		});
		if (existing) {
			return fail(400, { error: 'You already belong to an organization.' });
		}

		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		if (!name || name.length > 120) {
			return fail(400, { error: 'Enter a valid organization name (1–120 characters).' });
		}

		const orgId = `org_${crypto.randomUUID()}`;
		const joinCode = await allocateUniqueOrganizationJoinCode();

		await db.transaction(async (tx) => {
			await tx.insert(organizations).values({
				id: orgId,
				name,
				ownerId: user.id,
				planId: 'free',
				joinCode
			});

			await tx.insert(organizationMembers).values({
				id: crypto.randomUUID(),
				organizationId: orgId,
				userId: user.id,
				role: 'owner'
			});

			await tx
				.update(scenes)
				.set({ organizationId: orgId })
				.where(and(eq(scenes.userId, user.id), isNull(scenes.organizationId)));

			await tx
				.update(trainerScenarios)
				.set({ organizationId: orgId })
				.where(and(eq(trainerScenarios.createdBy, user.id), isNull(trainerScenarios.organizationId)));
		});

		invalidateLayoutCache(user.id);

		throw redirect(303, '/app/sizeup');
	}
};
