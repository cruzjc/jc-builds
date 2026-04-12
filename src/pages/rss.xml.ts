import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { SITE_DESCRIPTION, SITE_NAME, resolveSite } from '../lib/constants';
import { getProjects, getUpdates } from '../lib/content';

export const prerender = true;

export const GET: APIRoute = async ({ site }) => {
	const [updates, projects] = await Promise.all([getUpdates(), getProjects()]);
	const base = resolveSite(site);

	return rss({
		title: `${SITE_NAME} Updates`,
		description: SITE_DESCRIPTION,
		site: base,
		items: updates.map((update) => {
			const project = projects.find((entry) => entry.entry.data.slug === update.data.projectSlug);
			return {
				title: `${project?.entry.data.title ?? update.data.projectSlug}: ${update.data.title}`,
				description: update.data.summary,
				pubDate: update.data.date,
				link: `/projects/${update.data.projectSlug}/#update-${update.id}`,
				categories: project?.entry.data.tags ?? [],
			};
		}),
	});
};
