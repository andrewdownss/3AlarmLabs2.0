import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { organizations } from '$lib/server/db/schema';
import { getStripe } from '$lib/server/stripe';
import { applySubscriptionToOrganization } from '$lib/server/stripe-org-sync';

/**
 * Applies subscription → org when the user lands after checkout with `{CHECKOUT_SESSION_ID}`
 * (typically `/thank-you` or Billing with success query params).
 * Duplicates webhook work so local/dev works without Stripe CLI forwarding; production still relies on webhooks.
 */
export async function reconcileCheckoutSession(params: {
	stripeCheckoutSessionId: string;
	organizationId: string;
	ownerUserId: string;
}): Promise<{ synced: boolean; reason?: string }> {
	const stripe = getStripe();
	let stripeSession;
	try {
		stripeSession = await stripe.checkout.sessions.retrieve(params.stripeCheckoutSessionId);
	} catch {
		return { synced: false, reason: 'session_not_found' };
	}

	if (stripeSession.mode !== 'subscription')
		return { synced: false, reason: 'wrong_mode' };
	if (stripeSession.status !== 'complete')
		return { synced: false, reason: 'not_complete' };

	if (stripeSession.metadata?.organizationId !== params.organizationId)
		return { synced: false, reason: 'org_mismatch' };

	const org = await db.query.organizations.findFirst({
		where: eq(organizations.id, params.organizationId),
		columns: { ownerId: true }
	});
	if (!org || org.ownerId !== params.ownerUserId)
		return { synced: false, reason: 'forbidden' };

	const customerId =
		typeof stripeSession.customer === 'string'
			? stripeSession.customer
			: stripeSession.customer?.id;
	const subRef = stripeSession.subscription;
	const subId = typeof subRef === 'string' ? subRef : subRef?.id;
	if (!customerId || !subId) return { synced: false, reason: 'missing_subscription' };

	const subscription = await stripe.subscriptions.retrieve(subId);
	await applySubscriptionToOrganization(params.organizationId, customerId, subscription, {
		planIdFromCheckoutFlow: stripeSession.metadata?.planId
	});

	return { synced: true };
}
