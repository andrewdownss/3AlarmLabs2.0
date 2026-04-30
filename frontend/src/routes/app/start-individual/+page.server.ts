import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { createCheckoutSession } from '$lib/server/stripe';
import { ensurePersonalOrganization } from '$lib/server/orgs';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		throw redirect(303, `/login?next=${encodeURIComponent('/app/start-individual')}`);
	}

	const organization = await ensurePersonalOrganization(locals.user);
	if (!organization.isPersonal) {
		throw redirect(303, '/app/settings/billing');
	}

	let session;
	try {
		session = await createCheckoutSession({
			organizationId: organization.id,
			planId: 'individual',
			billingInterval: 'month',
			customerEmail: locals.user.email,
			stripeCustomerId: organization.stripeCustomerId,
			successUrl: `${url.origin}/app/settings/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
			cancelUrl: `${url.origin}/pricing?checkout=cancel`
		});
	} catch (e) {
		console.error('[start-individual] stripe', e);
		const message =
			e instanceof Error
				? e.message
				: 'Could not create Stripe Checkout. Set STRIPE_SECRET_KEY and STRIPE_PRICE_INDIVIDUAL_MONTHLY in .env (test mode IDs with sk_test_ key).';
		throw error(503, message);
	}

	if (!session.url) throw error(500, 'Checkout session missing URL');
	throw redirect(303, session.url);
};
