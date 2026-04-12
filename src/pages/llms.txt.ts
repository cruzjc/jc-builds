import type { APIRoute } from 'astro';
import { SITE_DESCRIPTION, SITE_NAME, absoluteUrl, resolveSite } from '../lib/constants';

export const prerender = true;

export const GET: APIRoute = ({ site }) => {
	const base = resolveSite(site);
	const lines = [
		`# ${SITE_NAME}`,
		'',
		SITE_DESCRIPTION,
		'',
		'Primary entrypoints:',
		`- Home: ${absoluteUrl('/', base).toString()}`,
		`- About: ${absoluteUrl('/about/', base).toString()}`,
		`- Projects JSON: ${absoluteUrl('/projects/index.json', base).toString()}`,
		`- Updates JSON: ${absoluteUrl('/updates/index.json', base).toString()}`,
		`- Reference template: ${absoluteUrl('/projects/template/', base).toString()}`,
		`- RSS feed: ${absoluteUrl('/rss.xml', base).toString()}`,
		`- Sitemap: ${absoluteUrl('/sitemap-index.xml', base).toString()}`,
		'',
		'Project pages follow the pattern /projects/{slug}/.',
		'Listed projects appear on the homepage, in Projects JSON, and in update feeds.',
		'The /projects/template/ page is a public reference pattern for creating new project entries.',
		'Project records are stable summaries. Update records are dated log entries linked back to a project.',
	].join('\n');

	return new Response(lines, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
		},
	});
};
