import { fail, redirect } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { invalidateLayoutCache, invalidateUserCache } from '$lib/server/cache';
import { db } from '$lib/server/db';
import { organizationMembers, organizations, user as userTable } from '$lib/server/db/schema';
import crypto from 'node:crypto';

function requireAdmin(locals: App.Locals) {
	if (!locals.user) throw redirect(303, '/login');
	if (!locals.user.isAdmin) throw redirect(303, '/app/sizeup');
	return locals.user;
}

export const load: PageServerLoad = async ({ locals }) => {
	requireAdmin(locals);

	const [users, orgs] = await Promise.all([
		db.query.user.findMany({
			columns: {
				id: true,
				name: true,
				email: true,
				isAdmin: true,
				createdAt: true
			},
			with: {
				organizationMemberships: {
					columns: { organizationId: true, role: true },
					with: { organization: { columns: { id: true, name: true, planId: true, ownerId: true } } }
				}
			},
			orderBy: [asc(userTable.createdAt)]
		}),
		db.query.organizations.findMany({
			columns: { id: true, name: true, planId: true, ownerId: true },
			orderBy: [asc(organizations.name)]
		})
	]);

	return { users, organizations: orgs };
};

export const actions: Actions = {
	moveUser: async ({ locals, request }) => {
		const admin = requireAdmin(locals);

		const form = await request.formData();
		const userId = String(form.get('userId') ?? '').trim();
		const organizationId = String(form.get('organizationId') ?? '').trim();

		if (!userId) return fail(400, { error: 'userId required' });
		if (!organizationId) return fail(400, { error: 'organizationId required' });

		const [userRow, targetOrg] = await Promise.all([
			db.query.user.findFirst({ where: eq(userTable.id, userId), columns: { id: true } }),
			db.query.organizations.findFirst({
				where: eq(organizations.id, organizationId),
				columns: { id: true }
			})
		]);
		if (!userRow) return fail(404, { error: 'User not found' });
		if (!targetOrg) return fail(404, { error: 'Organization not found' });

		const ownedOrg = await db.query.organizations.findFirst({
			where: eq(organizations.ownerId, userId),
			columns: { id: true, name: true }
		});
		if (ownedOrg) {
			return fail(400, {
				error: `That user owns "${ownedOrg.name}". Transfer ownership before moving them to another organization.`
			});
		}

		const membership = await db.query.organizationMembers.findFirst({
			where: eq(organizationMembers.userId, userId),
			columns: { id: true, organizationId: true }
		});

		if (membership?.organizationId === organizationId) {
			return { success: true as const };
		}

		await db.transaction(async (tx) => {
			if (membership) {
				await tx
					.update(organizationMembers)
					.set({ organizationId, role: 'member' })
					.where(eq(organizationMembers.id, membership.id));
			} else {
				await tx.insert(organizationMembers).values({
					id: crypto.randomUUID(),
					organizationId,
					userId,
					role: 'member'
				});
			}
		});

		invalidateLayoutCache(userId);
		if (userId === admin.id) invalidateLayoutCache(admin.id);

		return { success: true as const };
	},

	deleteUser: async ({ locals, request }) => {
		const admin = requireAdmin(locals);

		const form = await request.formData();
		const userId = String(form.get('userId') ?? '').trim();
		if (!userId) return fail(400, { error: 'userId required' });

		if (userId === admin.id) return fail(400, { error: 'You cannot delete your own account.' });

		const ownedOrg = await db.query.organizations.findFirst({
			where: eq(organizations.ownerId, userId),
			columns: { id: true, name: true }
		});
		if (ownedOrg) {
			return fail(400, {
				error: `That user owns "${ownedOrg.name}". Transfer ownership or delete the organization first.`
			});
		}

		await db.delete(userTable).where(eq(userTable.id, userId));
		invalidateLayoutCache(userId);
		invalidateUserCache(userId);

		return { success: true as const };
	}
};

