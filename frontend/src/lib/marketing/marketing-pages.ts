import { seoLinks } from '$lib/landing/landing-content';
import { getMarketingContent } from './marketing-loader';

const BRAND_NAME = '3 Alarm Labs';

export interface MarketingPageMeta {
	slug: string; // no leading slash
	displayName: string;
	title: string;
	metaDescription: string;
	heroEyebrow: string;
	heroTitle: string;
	heroDescription: string;
	bodyHtml: string; // rendered from Markdown, may be '' if no .md file exists
	/** Optional; from frontmatter `keywords` array */
	keywords: string[];
}

function toTitleCase(input: string): string {
	return input
		.split(/\s+/g)
		.filter(Boolean)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');
}

export function marketingDisplayNameFromSlug(slug: string): string {
	const base = slug.replace(/-/g, ' ').trim();
	return toTitleCase(base);
}

type TemplateVars = {
	displayName: string;
	brand: string;
};

function interpolateTemplate(template: string, vars: TemplateVars): string {
	return template.replace(/\{(\w+)\}/g, (_, key: string) => {
		if (key === 'displayName') return vars.displayName;
		if (key === 'brand') return vars.brand;
		return '';
	});
}

function flattenSeoLinksToPaths(): string[] {
	const all = [
		...seoLinks.core,
		...seoLinks.useCases,
		...seoLinks.features,
		...seoLinks.comparison
	];

	// We store hrefs as absolute paths (leading `/`) in landing-content.
	return all.map((l) => l.href).filter((href) => href.startsWith('/'));
}

const marketingPaths = flattenSeoLinksToPaths();
const marketingPathSet = new Set(marketingPaths);

/**
 * Public marketing paths (leading `/`) rendered by the `/[slug]` route.
 * Kept in sync with the landing footer link lists.
 */
export const MARKETING_PATHS = marketingPaths;

export function isMarketingPath(path: string): boolean {
	return marketingPathSet.has(path);
}

/**
 * Resolves SEO + hero meta and rendered body HTML for a marketing slug.
 *
 * Per-page copy is authored in `$lib/marketing/content/<slug>.md` with frontmatter
 * (title, description, heroEyebrow, heroTitle, heroDescription). Missing fields fall
 * back to sensible defaults so a page never renders blank.
 */
export function getMarketingPageMeta(slug: string): MarketingPageMeta | null {
	const normalizedSlug = slug.replace(/^\//, '').trim();
	if (!normalizedSlug) return null;

	const path = `/${normalizedSlug}`;
	if (!marketingPathSet.has(path)) return null;

	const displayName = marketingDisplayNameFromSlug(normalizedSlug);
	const vars: TemplateVars = { displayName, brand: BRAND_NAME };

	const content = getMarketingContent(normalizedSlug);
	const fm = content?.frontmatter ?? {};

	const title = fm.title ?? interpolateTemplate('{displayName} — {brand}', vars);
	const metaDescription =
		fm.description ??
		`Practice ${displayName.toLowerCase()} on your own time with self-paced command scenarios, radio-based reps, and replay review built for firefighters preparing to lead.`;

	const heroEyebrow =
		fm.heroEyebrow ?? 'Self-paced command training for firefighters preparing to lead';
	const heroTitle = fm.heroTitle ?? interpolateTemplate('Practice {displayName} on your own time.', vars);
	const heroDescription = fm.heroDescription ?? metaDescription;

	const keywords = Array.isArray(fm.keywords) ? fm.keywords.filter((k): k is string => typeof k === 'string') : [];

	return {
		slug: normalizedSlug,
		displayName,
		title,
		metaDescription,
		heroEyebrow,
		heroTitle,
		heroDescription,
		bodyHtml: content?.bodyHtml ?? '',
		keywords
	};
}
