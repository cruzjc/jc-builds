import type { APIRoute } from 'astro';
import { resolveSite } from '../../lib/constants';
import { getUpdates, serializeUpdate } from '../../lib/content';

export const prerender = true;

export const GET: APIRoute = async ({ site }) => {
	const updates = await getUpdates();
	const base = resolveSite(site);

	return new Response(
		JSON.stringify(
			{
				generatedAt: new Date().toISOString(),
				count: updates.length,
				updates: updates.map((update) => serializeUpdate(update, base)),
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
