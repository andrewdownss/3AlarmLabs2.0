import { fail, redirect } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';
import { invalidateLayoutCache } from '$lib/server/cache';
import { db } from '$lib/server/db';
import { organizationInvites, organizationMembers } from '$lib/server/db/schema';
import { safeAppPath } from '$lib/server/safe-path';

function maskEmail(email: string) {
	const [localPart, domain] = email.split('@');
	if (!domain) return email;
	const obfuscated =
		localPart.length <= 1 ? `${localPart}*` : `${localPart.slice(0, 2)}…`;
	return `${obfuscated}@${domain}`;
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const token = params.token;

	const invite = await db.query.organizationInvites.findFirst({
		where: eq(organizationInvites.token, token),
		with: {
			organization: {
				columns: { id: true, name: true }
			}
		}
	});

	if (!invite) {
		return { status: 'invalid' as const };
	}

	const expired = invite.expiresAt.getTime() < Date.now();
	const orgName = invite.organization.name;
	const inviteEmailNorm = invite.email.trim().toLowerCase();
	const nextPath = `/invite/${token}`;

	if (expired) {
		return { status: 'expired' as const, orgName };
	}

	if (!locals.user) {
		return {
			status: 'need_auth' as const,
			orgName,
			maskedEmail: maskEmail(invite.email),
			nextPath
		};
	}

	const userEmailNorm = locals.user.email.trim().toLowerCase();
	if (userEmailNorm !== inviteEmailNorm) {
		return {
			status: 'wrong_account' as const,
			orgName,
			expectedEmail: invite.email
		};
	}

	const existingMember = await db.query.organizationMembers.findFirst({
		where: and(
			eq(organizationMembers.organizationId, invite.organizationId),
			eq(organizationMembers.userId, locals.user.id)
		),
		columns: { id: true }
	});

	if (existingMember) {
		return { status: 'already_member' as const, orgName };
	}

	return { status: 'ready' as const, orgName };
};

export const actions: Actions = {
	accept: async ({ params, locals, request }) => {
		if (!locals.user) {
			throw redirect(303, `/login?next=${encodeURIComponent(`/invite/${params.token}`)}`);
		}

		const form = await request.formData();
		const next = safeAppPath(String(form.get('next') ?? ''), '/app/command');

		const token = params.token;
		const invite = await db.query.organizationInvites.findFirst({
			where: eq(organizationInvites.token, token)
		});

		if (!invite) {
			return fail(404, { error: 'This invite is invalid or was removed.' });
		}

		if (invite.expiresAt.getTime() < Date.now()) {
			return fail(410, { error: 'This invite has expired. Ask for a new link.' });
		}

		const userEmailNorm = locals.user.email.trim().toLowerCase();
		const inviteEmailNorm = invite.email.trim().toLowerCase();
		if (userEmailNorm !== inviteEmailNorm) {
			return fail(403, {
				error: `This invite was sent to ${invite.email}. Sign in with that email.`
			});
		}

		const existingMember = await db.query.organizationMembers.findFirst({
			where: and(
				eq(organizationMembers.organizationId, invite.organizationId),
				eq(organizationMembers.userId, locals.user.id)
			),
			columns: { id: true }
		});

		if (!existingMember) {
			const existingMembership = await db.query.organizationMembers.findFirst({
				where: eq(organizationMembers.userId, locals.user.id),
				columns: { organizationId: true }
			});

			if (existingMembership && existingMembership.organizationId !== invite.organizationId) {
				return fail(409, {
					error: 'You are already part of an organization. Leave it before joining another.'
				});
			}

			await db.insert(organizationMembers).values({
				id: crypto.randomUUID(),
				organizationId: invite.organizationId,
				userId: locals.user.id,
				role: 'member'
			});
		}

		await db.delete(organizationInvites).where(eq(organizationInvites.id, invite.id));

		invalidateLayoutCache(locals.user.id);

		throw redirect(303, next);
	}
};
