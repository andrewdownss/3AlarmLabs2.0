import { fail, redirect } from '@sveltejs/kit';
import { and, desc, eq, gt, count } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import {
	organizationInvites,
	organizationMembers,
	organizations,
	user as userTable
} from '$lib/server/db/schema';
import { sendInviteEmail } from '$lib/server/email';
import { allocateUniqueOrganizationJoinCode } from '$lib/server/join-code';
import { canInviteUser, getPlanConfig, normalizePlanId } from '$lib/plans';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(303, '/login');

	let ownedOrg = await db.query.organizations.findFirst({
		where: eq(organizations.ownerId, locals.user.id)
	});

	if (!ownedOrg) {
		return { isOwner: false as const };
	}

	if (!ownedOrg.joinCode) {
		const joinCode = await allocateUniqueOrganizationJoinCode();
		await db
			.update(organizations)
			.set({ joinCode })
			.where(eq(organizations.id, ownedOrg.id));
		ownedOrg = { ...ownedOrg, joinCode };
	}

	const plan = getPlanConfig(normalizePlanId(ownedOrg.planId));

	const [members, pendingInvites, memberCountResult] = await Promise.all([
		db.query.organizationMembers.findMany({
			where: eq(organizationMembers.organizationId, ownedOrg.id),
			orderBy: [desc(organizationMembers.joinedAt)],
			with: {
				user: {
					columns: { id: true, name: true, email: true }
				}
			}
		}),
		db.query.organizationInvites.findMany({
			where: and(
				eq(organizationInvites.organizationId, ownedOrg.id),
				gt(organizationInvites.expiresAt, new Date())
			),
			orderBy: [desc(organizationInvites.createdAt)]
		}),
		db
			.select({ value: count() })
			.from(organizationMembers)
			.where(eq(organizationMembers.organizationId, ownedOrg.id))
	]);

	const memberCount = memberCountResult[0]?.value ?? 0;

	return {
		isOwner: true as const,
		organization: ownedOrg,
		plan,
		members,
		pendingInvites,
		memberCount,
		canInvite: canInviteUser(plan, memberCount)
	};
};

export const actions: Actions = {
	regenerateOrgJoinCode: async ({ locals }) => {
		if (!locals.user) throw redirect(303, '/login');

		const ownedOrg = await db.query.organizations.findFirst({
			where: eq(organizations.ownerId, locals.user.id)
		});
		if (!ownedOrg) {
			return fail(403, { error: 'Only organization owners can change the department code.' });
		}

		const joinCode = await allocateUniqueOrganizationJoinCode();
		await db
			.update(organizations)
			.set({ joinCode })
			.where(eq(organizations.id, ownedOrg.id));

		return { regeneratedJoinCode: joinCode as string };
	},

	invite: async ({ locals, request, url }) => {
		if (!locals.user) throw redirect(303, '/login');

		const ownedOrg = await db.query.organizations.findFirst({
			where: eq(organizations.ownerId, locals.user.id)
		});
		if (!ownedOrg) {
			return fail(403, { error: 'Only organization owners can send invites.' });
		}

		const plan = getPlanConfig(normalizePlanId(ownedOrg.planId));

		const [memberCountRow] = await db
			.select({ value: count() })
			.from(organizationMembers)
			.where(eq(organizationMembers.organizationId, ownedOrg.id));
		const memberCount = memberCountRow?.value ?? 0;

		if (!canInviteUser(plan, memberCount)) {
			return fail(400, {
				error: `Your ${plan.name} plan allows up to ${plan.maxUsers} member(s). Upgrade to add more people.`
			});
		}

		const form = await request.formData();
		const rawEmail = String(form.get('email') ?? '').trim().toLowerCase();
		if (!rawEmail || !rawEmail.includes('@')) {
			return fail(400, { error: 'Enter a valid email address.' });
		}

		const userRow = await db.query.user.findFirst({
			where: eq(userTable.email, rawEmail),
			columns: { id: true }
		});
		if (userRow) {
			const alreadyInOrg = await db.query.organizationMembers.findFirst({
				where: and(
					eq(organizationMembers.organizationId, ownedOrg.id),
					eq(organizationMembers.userId, userRow.id)
				),
				columns: { id: true }
			});
			if (alreadyInOrg) {
				return fail(400, { error: 'That person is already in your organization.' });
			}
		}

		await db
			.delete(organizationInvites)
			.where(
				and(
					eq(organizationInvites.organizationId, ownedOrg.id),
					eq(organizationInvites.email, rawEmail)
				)
			);

		const inviteId = crypto.randomUUID();
		const token = crypto.randomUUID();
		const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

		await db.insert(organizationInvites).values({
			id: inviteId,
			organizationId: ownedOrg.id,
			email: rawEmail,
			token,
			expiresAt
		});

		const inviteUrl = `${url.origin}/invite/${token}`;

		try {
			await sendInviteEmail(rawEmail, inviteUrl, ownedOrg.name);
		} catch {
			return fail(500, {
				error: 'Invite was created but the email could not be sent. Copy the link below.',
				inviteUrl
			});
		}

		return { success: true as const, inviteUrl };
	}
};
