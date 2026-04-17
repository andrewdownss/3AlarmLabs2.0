import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { eq } from 'drizzle-orm';
import { createCheckoutSession } from '$lib/server/stripe';
import { db } from '$lib/server/db';
import { organizations } from '$lib/server/db/schema';
import { PLANS, type BillingInterval, normalizePlanId } from '$lib/plans';

export const POST: RequestHandler = async ({ request, locals, url }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	let body: { organizationId?: string; planId?: string; billingInterval?: string };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	const organizationId = String(body.organizationId ?? '');
	const planId = normalizePlanId(body.planId);
	const billingInterval: BillingInterval =
		body.billingInterval === 'year' ? 'year' : 'month';

	if (!organizationId) throw error(400, 'organizationId required');

	const plan = PLANS[planId];
	if (!plan.canSelfServeCheckout) throw error(400, 'Plan not available for self-serve checkout');
	if (!plan.checkoutIntervals.includes(billingInterval)) throw error(400, 'Billing interval not available for this plan');

	const org = await db.query.organizations.findFirst({
		where: eq(organizations.id, organizationId),
		columns: { id: true, ownerId: true, stripeCustomerId: true }
	});
	if (!org || org.ownerId !== locals.user.id) throw error(403, 'Forbidden');

	const origin = url.origin;
	const session = await createCheckoutSession({
		organizationId: org.id,
		planId,
		billingInterval,
		customerEmail: locals.user.email,
		stripeCustomerId: org.stripeCustomerId,
		successUrl: `${origin}/app/settings/billing?checkout=success`,
		cancelUrl: `${origin}/app/settings/billing?checkout=cancel`
	});

	if (!session.url) throw error(500, 'Checkout session missing URL');
	return json({ url: session.url });
};
