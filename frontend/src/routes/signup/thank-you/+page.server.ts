import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { safeAppPath } from '$lib/server/safe-path';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		throw redirect(303, '/signup');
	}

	const next = safeAppPath(url.searchParams.get('next'));
	const conversionId = url.searchParams.get('cid')?.trim() ?? '';

	return {
		next,
		conversionId
	};
};
