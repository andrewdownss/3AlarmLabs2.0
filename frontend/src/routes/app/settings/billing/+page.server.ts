import { redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import { organizations } from '$lib/server/db/schema';
import { getPlanConfig, normalizePlanId } from '$lib/plans';
import { reconcileCheckoutSession } from '$lib/server/stripe-checkout-reconcile';

export const load: PageServerLoad = async ({ parent, url, locals }) => {
	const data = await parent();
	if (!data.user) throw redirect(303, '/login');

	const checkoutStatus = url.searchParams.get('checkout');
	const sessionId = url.searchParams.get('session_id');

	let organization = data.organization;
	let planConfig = data.planConfig;
	let checkoutSync: 'none' | 'applied' | 'skipped' | 'failed' = 'none';
	let checkoutSyncReason: string | undefined;

	if (
		checkoutStatus === 'success' &&
		sessionId &&
		data.organization &&
		data.isActiveOrgOwner &&
		locals.user
	) {
		try {
			const r = await reconcileCheckoutSession({
				stripeCheckoutSessionId: sessionId,
				organizationId: data.organization.id,
				ownerUserId: locals.user.id
			});
			if (r.synced) {
				checkoutSync = 'applied';
				const org = await db.query.organizations.findFirst({
					where: eq(organizations.id, data.organization.id)
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
			console.error('[billing] checkout reconcile', err);
			checkoutSync = 'failed';
			checkoutSyncReason = 'exception';
		}
	}

	return {
		...data,
		organization,
		planConfig,
		checkoutStatus,
		checkoutSync,
		checkoutSyncReason
	};
};
