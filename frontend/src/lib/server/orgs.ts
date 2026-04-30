import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';
import { db } from '$lib/server/db';
import { organizationMembers, organizations } from '$lib/server/db/schema';
import { invalidateLayoutCache } from '$lib/server/cache';

export interface ProvisionedOrganization {
	id: string;
	name: string;
	ownerId: string;
	planId: string;
	isPersonal: boolean;
	stripeCustomerId: string | null;
}

export async function ensurePersonalOrganization(
	user: Pick<NonNullable<App.Locals['user']>, 'id' | 'name'>
): Promise<ProvisionedOrganization> {
	const membership = await db.query.organizationMembers.findFirst({
		where: eq(organizationMembers.userId, user.id),
		with: {
			organization: {
				columns: {
					id: true,
					name: true,
					ownerId: true,
					planId: true,
					isPersonal: true,
					stripeCustomerId: true
				}
			}
		}
	});

	if (membership?.organization) return membership.organization;

	const orgId = `org_${crypto.randomUUID()}`;
	const organizationName = `${user.name || 'Individual'}'s Training`;

	await db.transaction(async (tx) => {
		await tx.insert(organizations).values({
			id: orgId,
			name: organizationName,
			ownerId: user.id,
			planId: 'expired',
			isPersonal: true,
			joinCode: null
		});

		await tx.insert(organizationMembers).values({
			id: crypto.randomUUID(),
			organizationId: orgId,
			userId: user.id,
			role: 'owner'
		});
	});

	invalidateLayoutCache(user.id);

	return {
		id: orgId,
		name: organizationName,
		ownerId: user.id,
		planId: 'expired',
		isPersonal: true,
		stripeCustomerId: null
	};
}
