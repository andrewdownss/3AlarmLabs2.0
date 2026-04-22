import type { RequestHandler } from '@sveltejs/kit';
import { MARKETING_PATHS } from '$lib/marketing/marketing-pages';

function toLastModISODate(d: Date): string {
	return d.toISOString().slice(0, 10);
}

export const GET: RequestHandler = async ({ url }) => {
	const origin = url.origin;
	const today = toLastModISODate(new Date());

	const staticPaths = ['/', '/signup', '/pricing', '/demo', '/contact', '/privacy'];
	const uniquePaths = Array.from(new Set([...staticPaths, ...MARKETING_PATHS]));

	const urlsXml = uniquePaths
		.map((path) => {
			const loc = path === '/' ? origin : `${origin}${path}`;
			return `<url><loc>${loc}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>${path === '/' ? '1.0' : '0.7'}</priority></url>`;
		})
		.join('');

	const xml =
		`<?xml version="1.0" encoding="UTF-8"?>` +
		`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
		urlsXml +
		`</urlset>`;

	return new Response(xml, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8'
		}
	});
};
