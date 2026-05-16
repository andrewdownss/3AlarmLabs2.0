import { redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { organizationMembers, organizations } from '$lib/server/db/schema';
import { getPlanConfig, normalizePlanId } from '$lib/plans';
import { reconcileCheckoutSession } from '$lib/server/stripe-checkout-reconcile';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		const next = `${url.pathname}${url.search}`;
		throw redirect(303, `/login?next=${encodeURIComponent(next)}`);
	}

	const membershipRow = await db.query.organizationMembers.findFirst({
		where: eq(organizationMembers.userId, locals.user.id)
	});

	let organization =
		membershipRow &&
		(await db.query.organizations.findFirst({
			where: eq(organizations.id, membershipRow.organizationId)
		}));

	let planConfig = getPlanConfig(normalizePlanId(organization?.planId));
	const isActiveOrgOwner = organization ? organization.ownerId === locals.user.id : false;

	const checkoutStatus = url.searchParams.get('checkout');
	const sessionId = url.searchParams.get('session_id');

	let checkoutSync: 'none' | 'applied' | 'skipped' | 'failed' = 'none';
	let checkoutSyncReason: string | undefined;

	if (
		checkoutStatus === 'success' &&
		sessionId &&
		organization &&
		isActiveOrgOwner &&
		locals.user
	) {
		try {
			const r = await reconcileCheckoutSession({
				stripeCheckoutSessionId: sessionId,
				organizationId: organization.id,
				ownerUserId: locals.user.id
			});
			if (r.synced) {
				checkoutSync = 'applied';
				const org = await db.query.organizations.findFirst({
					where: eq(organizations.id, organization.id)
				});
				if (org) {
					organization = org;
					planConfig = getPlanConfig(normalizePlanId(org.planId));
				}
			} else {
				checkoutSync = r.reason === 'org_mismatch' || r.reason === 'forbidden' ? 'failed' : 'skipped';
				checkoutSyncReason = r.reason;
			}
		} catch (err) {
			console.error('[thank-you] checkout reconcile', err);
			checkoutSync = 'failed';
			checkoutSyncReason = 'exception';
		}
	}

	return {
		user: locals.user,
		organization,
		planConfig,
		isActiveOrgOwner,
		checkoutStatus,
		sessionId,
		checkoutSync,
		checkoutSyncReason,
		isPostCheckout: checkoutStatus === 'success' && Boolean(sessionId)
	};
};
