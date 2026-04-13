import { fail, redirect } from '@sveltejs/kit';
import { and, count, eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { invalidateLayoutCache } from '$lib/server/cache';
import { db } from '$lib/server/db';
import { organizationMembers, organizations } from '$lib/server/db/schema';
import { canInviteUser, getPlanConfig, normalizePlanId } from '$lib/plans';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(303, '/login');
	return {};
};

export const actions: Actions = {
	default: async ({ locals, request }) => {
		if (!locals.user) throw redirect(303, '/login');

		const form = await request.formData();
		const rawCode = String(form.get('code') ?? '');
		const code = rawCode.trim().toUpperCase();

		if (code.length !== 5) {
			return fail(400, { error: 'Please enter a valid 5-character code.' });
		}

		const org = await db.query.organizations.findFirst({
			where: eq(organizations.joinCode, code),
			columns: {
				id: true,
				name: true,
				ownerId: true,
				planId: true
			}
		});

		if (!org) {
			return fail(404, { error: 'No department found with that code.' });
		}

		const existingMembership = await db.query.organizationMembers.findFirst({
			where: eq(organizationMembers.userId, locals.user.id),
			columns: { organizationId: true }
		});
		if (existingMembership && existingMembership.organizationId !== org.id) {
			return fail(409, {
				error: 'You are already part of an organization. Leave it before joining another.'
			});
		}

		const existing = await db.query.organizationMembers.findFirst({
			where: and(
				eq(organizationMembers.organizationId, org.id),
				eq(organizationMembers.userId, locals.user.id)
			),
			columns: { id: true }
		});

		if (existing) {
			throw redirect(303, '/app/command');
		}

		const plan = getPlanConfig(normalizePlanId(org.planId));
		const [memberCountRow] = await db
			.select({ value: count() })
			.from(organizationMembers)
			.where(eq(organizationMembers.organizationId, org.id));
		const memberCount = memberCountRow?.value ?? 0;

		if (!canInviteUser(plan, memberCount)) {
			return fail(403, {
				error: 'That department is full. Ask the owner to upgrade their plan.'
			});
		}

		await db.insert(organizationMembers).values({
			id: crypto.randomUUID(),
			organizationId: org.id,
			userId: locals.user.id,
			role: 'member'
		});

		invalidateLayoutCache(locals.user.id);

		throw redirect(303, '/app/command');
	}
};
