import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { PLANS } from '$lib/plans';
import { getMarketingPageMeta } from '$lib/marketing/marketing-pages';
import { toCanonicalUrl } from '$lib/seo';

export const load: PageServerLoad = async ({ params, url }) => {
	const slug = String(params.slug ?? '');
	const pageMeta = getMarketingPageMeta(slug);
	if (!pageMeta) throw error(404);

	const monthlyPrice = PLANS.individual.monthlyPrice ?? 14.99;

	return {
		canonicalUrl: toCanonicalUrl(url.pathname),
		monthlyPrice,
		title: pageMeta.title,
		description: pageMeta.metaDescription,
		heroEyebrow: pageMeta.heroEyebrow,
		heroTitle: pageMeta.heroTitle,
		heroDescription: pageMeta.heroDescription,
		bodyHtml: pageMeta.bodyHtml,
		keywords: pageMeta.keywords
	};
};
