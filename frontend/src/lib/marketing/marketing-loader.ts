import matter from 'gray-matter';
import { marked } from 'marked';

export interface MarketingFrontmatter {
	title?: string;
	description?: string;
	heroEyebrow?: string;
	heroTitle?: string;
	heroDescription?: string;
	keywords?: string[];
}

export interface MarketingContent {
	frontmatter: MarketingFrontmatter;
	bodyHtml: string;
}

const rawModules = import.meta.glob('./content/*.md', {
	eager: true,
	query: '?raw',
	import: 'default'
}) as Record<string, string>;

const contentBySlug = new Map<string, MarketingContent>();

for (const [path, raw] of Object.entries(rawModules)) {
	const slugMatch = path.match(/\/([^/]+)\.md$/);
	if (!slugMatch) continue;
	const slug = slugMatch[1];
	// Skip docs-only files (e.g. README) and draft files prefixed with _
	if (slug === 'README' || slug.startsWith('_')) continue;

	const parsed = matter(raw);
	const bodyHtml = marked.parse(parsed.content ?? '', { async: false }) as string;

	contentBySlug.set(slug, {
		frontmatter: parsed.data as MarketingFrontmatter,
		bodyHtml
	});
}

export function getMarketingContent(slug: string): MarketingContent | null {
	return contentBySlug.get(slug) ?? null;
}

export function listMarketingContentSlugs(): string[] {
	return [...contentBySlug.keys()];
}
