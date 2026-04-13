import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { eq } from 'drizzle-orm';
import { createBillingPortalSession } from '$lib/server/stripe';
import { db } from '$lib/server/db';
import { organizations } from '$lib/server/db/schema';

export const POST: RequestHandler = async ({ request, locals, url }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	let body: { organizationId?: string };
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON');
	}

	const organizationId = String(body.organizationId ?? '');
	if (!organizationId) throw error(400, 'organizationId required');

	const org = await db.query.organizations.findFirst({
		where: eq(organizations.id, organizationId),
		columns: { ownerId: true, stripeCustomerId: true }
	});
	if (!org || org.ownerId !== locals.user.id) throw error(403, 'Forbidden');
	if (!org.stripeCustomerId) throw error(400, 'No Stripe customer on file');

	const origin = url.origin;
	const session = await createBillingPortalSession({
		customerId: org.stripeCustomerId,
		returnUrl: `${origin}/app/settings/billing`
	});

	return json({ url: session.url });
};
