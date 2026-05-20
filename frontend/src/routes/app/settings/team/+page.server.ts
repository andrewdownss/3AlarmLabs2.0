import { fail, redirect } from '@sveltejs/kit';
import { and, desc, eq, gt, count } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { invalidateLayoutCache } from '$lib/server/cache';
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
import { isOrgMemberRole, type OrgMemberRole } from '$lib/org-roles';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) throw redirect(303, '/login');

	let ownedOrg = await db.query.organizations.findFirst({
		where: eq(organizations.ownerId, locals.user.id)
	});

	if (!ownedOrg) {
		return { isOwner: false as const, currentUserId: locals.user.id };
	}

	if (ownedOrg.isPersonal) {
		const plan = getPlanConfig(normalizePlanId(ownedOrg.planId));
		return {
			isOwner: true as const,
			isPersonal: true as const,
			currentUserId: locals.user.id,
			organization: ownedOrg,
			plan,
			members: [],
			pendingInvites: [],
			memberCount: 1,
			canInvite: false
		};
	}

	if (!ownedOrg.joinCode) {
		const joinCode = await allocateUniqueOrganizationJoinCode();
		await db.update(organizations).set({ joinCode }).where(eq(organizations.id, ownedOrg.id));
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
		currentUserId: locals.user.id,
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
		if (ownedOrg.isPersonal) {
			return fail(403, { error: 'Personal accounts do not use department join codes.' });
		}

		const joinCode = await allocateUniqueOrganizationJoinCode();
		await db.update(organizations).set({ joinCode }).where(eq(organizations.id, ownedOrg.id));

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
		if (ownedOrg.isPersonal) {
			return fail(403, {
				error:
					'Personal accounts cannot invite members. Upgrade to a Firehouse plan to add your crew.'
			});
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
		const rawEmail = String(form.get('email') ?? '')
			.trim()
			.toLowerCase();
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
	},

	updateMemberRole: async ({ locals, request }) => {
		if (!locals.user) throw redirect(303, '/login');

		const ownedOrg = await db.query.organizations.findFirst({
			where: eq(organizations.ownerId, locals.user.id)
		});
		if (!ownedOrg) {
			return fail(403, { error: 'Only organization owners can change member roles.' });
		}
		if (ownedOrg.isPersonal) {
			return fail(403, { error: 'Personal accounts cannot manage member roles.' });
		}

		const form = await request.formData();
		const memberId = String(form.get('memberId') ?? '').trim();
		const roleRaw = String(form.get('role') ?? '').trim();

		if (!memberId) {
			return fail(400, { error: 'Member not found.' });
		}
		if (!isOrgMemberRole(roleRaw)) {
			return fail(400, { error: 'Invalid role.' });
		}
		const role: OrgMemberRole = roleRaw;

		const memberRow = await db.query.organizationMembers.findFirst({
			where: and(
				eq(organizationMembers.id, memberId),
				eq(organizationMembers.organizationId, ownedOrg.id)
			),
			columns: { id: true, userId: true, role: true }
		});

		if (!memberRow) {
			return fail(404, { error: 'Member not found in your organization.' });
		}
		if (memberRow.role === role) {
			return { roleUpdated: true as const };
		}

		const isCanonicalOwner = memberRow.userId === ownedOrg.ownerId;

		if (isCanonicalOwner && role !== 'owner') {
			return fail(400, {
				error: 'Transfer ownership to another member before changing your role.'
			});
		}

		if (role === 'owner') {
			if (memberRow.userId === ownedOrg.ownerId) {
				return { roleUpdated: true as const };
			}

			const previousOwnerId = ownedOrg.ownerId;

			await db.transaction(async (tx) => {
				await tx
					.update(organizations)
					.set({ ownerId: memberRow.userId })
					.where(eq(organizations.id, ownedOrg.id));

				await tx
					.update(organizationMembers)
					.set({ role: 'owner' })
					.where(eq(organizationMembers.id, memberRow.id));

				const previousOwnerMember = await tx.query.organizationMembers.findFirst({
					where: and(
						eq(organizationMembers.organizationId, ownedOrg.id),
						eq(organizationMembers.userId, previousOwnerId)
					),
					columns: { id: true }
				});

				if (previousOwnerMember) {
					await tx
						.update(organizationMembers)
						.set({ role: 'instructor' })
						.where(eq(organizationMembers.id, previousOwnerMember.id));
				}
			});

			invalidateLayoutCache(previousOwnerId);
			invalidateLayoutCache(memberRow.userId);

			return { roleUpdated: true as const, ownershipTransferred: true as const };
		}

		await db
			.update(organizationMembers)
			.set({ role })
			.where(eq(organizationMembers.id, memberRow.id));

		invalidateLayoutCache(memberRow.userId);

		return { roleUpdated: true as const };
	}
};
