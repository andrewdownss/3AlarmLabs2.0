import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, url }) => {
	const data = await parent();
	if (!data.user) throw redirect(303, '/login');

	const checkoutStatus = url.searchParams.get('checkout');

	return {
		organization: data.organization,
		planConfig: data.planConfig,
		isOrgOwner: data.isActiveOrgOwner,
		checkoutStatus
	};
};
