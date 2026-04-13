import Stripe from 'stripe';
import { env } from '$env/dynamic/private';
import { PLANS, type BillingInterval, type PlanId } from '$lib/plans';

function getStripe() {
	const key = env.STRIPE_SECRET_KEY;
	if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
	return new Stripe(key);
}

export { getStripe };

function readEnvStripePrice(planId: PlanId, interval: BillingInterval): string | undefined {
	const suffix = interval === 'month' ? 'MONTHLY' : 'ANNUAL';
	const key = `STRIPE_PRICE_${planId.toUpperCase()}_${suffix}`;
	const raw = (env as Record<string, string | undefined>)[key];
	return raw?.trim() || undefined;
}

export function getStripePriceIdForPlan(planId: PlanId, interval: BillingInterval): string | null {
	const plan = PLANS[planId];
	if (!plan.canSelfServeCheckout) return null;
	const id = readEnvStripePrice(planId, interval);
	return id ?? null;
}

export async function createCheckoutSession(opts: {
	organizationId: string;
	planId: PlanId;
	billingInterval: BillingInterval;
	customerEmail: string;
	stripeCustomerId?: string | null;
	successUrl: string;
	cancelUrl: string;
}): Promise<Stripe.Checkout.Session> {
	const stripe = getStripe();
	const priceId = getStripePriceIdForPlan(opts.planId, opts.billingInterval);
	if (!priceId) throw new Error(`No Stripe price configured for plan: ${opts.planId} (${opts.billingInterval})`);

	const params: Stripe.Checkout.SessionCreateParams = {
		mode: 'subscription',
		line_items: [{ price: priceId, quantity: 1 }],
		success_url: opts.successUrl,
		cancel_url: opts.cancelUrl,
		metadata: { organizationId: opts.organizationId, planId: opts.planId },
		subscription_data: {
			metadata: { organizationId: opts.organizationId, planId: opts.planId }
		}
	};

	if (opts.stripeCustomerId) {
		params.customer = opts.stripeCustomerId;
	} else {
		params.customer_email = opts.customerEmail;
	}

	return stripe.checkout.sessions.create(params);
}

export async function createBillingPortalSession(opts: {
	customerId: string;
	returnUrl: string;
}): Promise<Stripe.BillingPortal.Session> {
	const stripe = getStripe();
	return stripe.billingPortal.sessions.create({
		customer: opts.customerId,
		return_url: opts.returnUrl
	});
}

export function constructWebhookEvent(body: string, signature: string): Stripe.Event {
	const stripe = getStripe();
	const secret = env.STRIPE_WEBHOOK_SECRET;
	if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is not set');
	return stripe.webhooks.constructEvent(body, signature, secret);
}

export function mapPriceIdToPlan(priceId: string): PlanId | null {
	for (const plan of Object.values(PLANS)) {
		if (!plan.canSelfServeCheckout) continue;
		for (const interval of ['month', 'year'] as const) {
			const pid = readEnvStripePrice(plan.id, interval);
			if (pid === priceId) return plan.id;
		}
	}
	return null;
}

export function getPlanIdFromSubscription(subscription: Stripe.Subscription): PlanId | null {
	const item = subscription.items.data[0];
	const priceId = item?.price?.id;
	if (!priceId) return null;
	return mapPriceIdToPlan(priceId);
}
