import type { RequestHandler } from '@sveltejs/kit';
import { MARKETING_PATHS } from '$lib/marketing/marketing-pages';

interface SitemapEntry {
	path: string;
	changefreq: 'daily' | 'weekly' | 'monthly' | 'yearly';
	priority: string;
}

function escapeXml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

function toLocation(origin: string, path: string): string {
	return path === '/' ? origin : `${origin}${path}`;
}

export const GET: RequestHandler = async ({ url }) => {
	const origin = url.origin;

	const staticEntries: SitemapEntry[] = [
		{ path: '/', changefreq: 'weekly', priority: '1.0' },
		{ path: '/pricing', changefreq: 'monthly', priority: '0.8' },
		{ path: '/demo', changefreq: 'monthly', priority: '0.7' },
		{ path: '/contact', changefreq: 'yearly', priority: '0.4' },
		{ path: '/privacy', changefreq: 'yearly', priority: '0.2' }
	];

	const marketingEntries: SitemapEntry[] = MARKETING_PATHS.map((path) => ({
		path,
		changefreq: 'monthly',
		priority: '0.7'
	}));

	const uniqueEntries = Array.from(
		new Map([...staticEntries, ...marketingEntries].map((entry) => [entry.path, entry])).values()
	);

	const urlsXml = uniqueEntries
		.map(
			(entry) =>
				`<url><loc>${escapeXml(toLocation(origin, entry.path))}</loc><changefreq>${entry.changefreq}</changefreq><priority>${entry.priority}</priority></url>`
		)
		.join('');

	const xml =
		`<?xml version="1.0" encoding="UTF-8"?>` +
		`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
		urlsXml +
		`</urlset>`;

	return new Response(xml, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			'Cache-Control': 'public, max-age=3600'
		}
	});
};
