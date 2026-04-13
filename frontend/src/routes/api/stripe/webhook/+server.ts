import { error, text } from '@sveltejs/kit';
import type Stripe from 'stripe';
import type { RequestHandler } from './$types';
import { constructWebhookEvent, getStripe } from '$lib/server/stripe';
import {
	applySubscriptionToOrganization,
	clearSubscriptionForOrganization
} from '$lib/server/stripe-org-sync';

export const POST: RequestHandler = async ({ request }) => {
	const signature = request.headers.get('stripe-signature');
	if (!signature) throw error(400, 'Missing stripe-signature');

	const rawBody = await request.text();

	let event: Stripe.Event;
	try {
		event = constructWebhookEvent(rawBody, signature);
	} catch (err) {
		console.error('[stripe webhook] signature failed', err);
		throw error(400, 'Invalid signature');
	}

	const stripe = getStripe();

	try {
		switch (event.type) {
			case 'checkout.session.completed': {
				const session = event.data.object as Stripe.Checkout.Session;
				if (session.mode !== 'subscription') break;
				const orgId = session.metadata?.organizationId;
				const customerId = typeof session.customer === 'string' ? session.customer : null;
				const subRef = session.subscription;
				const subId = typeof subRef === 'string' ? subRef : subRef?.id;
				if (!orgId || !customerId || !subId) {
					console.warn('[stripe webhook] checkout.session.completed missing fields', {
						orgId,
						customerId,
						subId
					});
					break;
				}
				const subscription = await stripe.subscriptions.retrieve(subId);
				await applySubscriptionToOrganization(orgId, customerId, subscription);
				break;
			}
			case 'customer.subscription.updated': {
				const subscription = event.data.object as Stripe.Subscription;
				const orgId = subscription.metadata?.organizationId;
				const cust = subscription.customer;
				const customerId = typeof cust === 'string' ? cust : cust?.id;
				if (!orgId || !customerId) break;
				await applySubscriptionToOrganization(orgId, customerId, subscription);
				break;
			}
			case 'customer.subscription.deleted': {
				const subscription = event.data.object as Stripe.Subscription;
				const orgId = subscription.metadata?.organizationId;
				if (!orgId) break;
				await clearSubscriptionForOrganization(orgId, 'free');
				break;
			}
			default:
				break;
		}
	} catch (err) {
		console.error('[stripe webhook] handler error', event.type, err);
		throw error(500, 'Webhook handler failed');
	}

	return text('', { status: 200 });
};
