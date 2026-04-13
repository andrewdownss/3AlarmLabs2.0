import { eq } from 'drizzle-orm';
import type Stripe from 'stripe';
import { db } from '$lib/server/db';
import { organizations } from '$lib/server/db/schema';
import { normalizePlanId, type PlanId } from '$lib/plans';
import { getPlanIdFromSubscription } from '$lib/server/stripe';
import { invalidateLayoutCache } from '$lib/server/cache';

export async function applySubscriptionToOrganization(
	organizationId: string,
	stripeCustomerId: string,
	subscription: Stripe.Subscription
): Promise<void> {
	let planId: PlanId | null = getPlanIdFromSubscription(subscription);
	if (!planId) {
		const metaPlan = subscription.metadata?.planId;
		planId = metaPlan ? normalizePlanId(metaPlan) : 'free';
	}

	const periodEndSec = (subscription as unknown as { current_period_end?: number })
		.current_period_end;
	const stripeCurrentPeriodEnd =
		typeof periodEndSec === 'number' ? new Date(periodEndSec * 1000) : null;

	await db
		.update(organizations)
		.set({
			stripeCustomerId,
			stripeSubscriptionId: subscription.id,
			stripeCurrentPeriodEnd,
			planId
		})
		.where(eq(organizations.id, organizationId));

	const org = await db.query.organizations.findFirst({
		where: eq(organizations.id, organizationId),
		columns: { ownerId: true }
	});
	if (org?.ownerId) invalidateLayoutCache(org.ownerId);
}

export async function clearSubscriptionForOrganization(
	organizationId: string,
	fallbackPlanId: PlanId = 'free'
): Promise<void> {
	await db
		.update(organizations)
		.set({
			stripeSubscriptionId: null,
			stripeCurrentPeriodEnd: null,
			planId: fallbackPlanId
		})
		.where(eq(organizations.id, organizationId));

	const org = await db.query.organizations.findFirst({
		where: eq(organizations.id, organizationId),
		columns: { ownerId: true }
	});
	if (org?.ownerId) invalidateLayoutCache(org.ownerId);
}
