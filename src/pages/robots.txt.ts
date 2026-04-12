import type { APIRoute } from 'astro';
import { absoluteUrl, resolveSite } from '../lib/constants';

export const prerender = true;

export const GET: APIRoute = ({ site }) => {
	const base = resolveSite(site);
	const body = [
		'User-agent: *',
		'Allow: /',
		`Sitemap: ${absoluteUrl('/sitemap-index.xml', base).toString()}`,
		`Sitemap: ${absoluteUrl('/sitemap-0.xml', base).toString()}`,
	].join('\n');

	return new Response(body, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
		},
	});
};
