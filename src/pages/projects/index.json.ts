import type { APIRoute } from 'astro';
import { resolveSite } from '../../lib/constants';
import { getContentSnapshotMeta, getProjects, serializeProject } from '../../lib/content';

export const prerender = true;

export const GET: APIRoute = async ({ site }) => {
	const [projects, contentMeta] = await Promise.all([getProjects(), Promise.resolve(getContentSnapshotMeta())]);
	const base = resolveSite(site);

	return new Response(
		JSON.stringify(
			{
				generatedAt: new Date().toISOString(),
				syncGeneratedAt: contentMeta.syncGeneratedAt,
				count: projects.length,
				projects: projects.map((project) => serializeProject(project, base)),
			},
			null,
			2,
		),
		{
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
			},
		},
	);
};
