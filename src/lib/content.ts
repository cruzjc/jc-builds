import { getCollection, type CollectionEntry } from 'astro:content';
import { absoluteUrl, normalizeCalendarDate, resolveSite } from './constants';
import { getProjectSync, getSyncGeneratedAt } from './project-sync';

export type ProjectEntry = CollectionEntry<'projects'>;
export type UpdateEntry = CollectionEntry<'updates'>;

export type EnrichedProject = {
	entry: ProjectEntry;
	updates: UpdateEntry[];
	repoUrls: string[];
	lastActivity: Date;
	sync: ReturnType<typeof getProjectSync>;
};

function sortByDateDesc<T extends { data: { date: Date } }>(items: T[]) {
	return [...items].sort((left, right) => right.data.date.getTime() - left.data.date.getTime());
}

function sortProjects(items: EnrichedProject[]) {
	return [...items].sort((left, right) => {
		if (left.entry.data.order !== right.entry.data.order) {
			return left.entry.data.order - right.entry.data.order;
		}

		return right.lastActivity.getTime() - left.lastActivity.getTime();
	});
}

function normalizeRepoUrl(url: string) {
	const trimmed = url.trim();

	if (!trimmed) {
		return null;
	}

	return trimmed
		.replace(/^git@github\.com:/u, 'https://github.com/')
		.replace(/^ssh:\/\/git@github\.com\//u, 'https://github.com/')
		.replace(/\.git$/u, '');
}

function dedupeRepoUrls(urls: string[]) {
	const seen = new Set<string>();
	const deduped: string[] = [];

	for (const url of urls) {
		const normalized = normalizeRepoUrl(url);
		if (!normalized || seen.has(normalized)) {
			continue;
		}

		seen.add(normalized);
		deduped.push(normalized);
	}

	return deduped;
}

async function getAllUpdatesInternal() {
	const updates = await getCollection('updates');
	return sortByDateDesc(updates);
}

export async function getAllProjects() {
	const [projects, updates] = await Promise.all([getCollection('projects'), getAllUpdatesInternal()]);

	const enriched = projects.map((entry) => {
		const relatedUpdates = updates.filter((update) => update.data.projectSlug === entry.data.slug);
		const sync = getProjectSync(entry.data.slug);
		const repoUrls = dedupeRepoUrls([...(entry.data.repoUrls ?? []), ...(sync?.remoteUrls ?? [])]);
		const latestUpdate = relatedUpdates[0] ? normalizeCalendarDate(relatedUpdates[0].data.date) : null;
		const lastUpdated = normalizeCalendarDate(entry.data.lastUpdated);
		const syncDate = sync?.lastCommitDate ? new Date(sync.lastCommitDate) : null;
		const lastActivity = new Date(
			Math.max(
				lastUpdated.getTime(),
				latestUpdate?.getTime() ?? 0,
				syncDate?.getTime() ?? 0,
			),
		);

		return {
			entry,
			updates: relatedUpdates,
			repoUrls,
			lastActivity,
			sync,
		};
	});

	return sortProjects(enriched);
}

export async function getProjects() {
	const projects = await getAllProjects();
	return projects.filter((project) => project.entry.data.surface === 'listed');
}

export async function getReferenceProjects() {
	const projects = await getAllProjects();
	return projects.filter((project) => project.entry.data.surface === 'reference');
}

export async function getUpdates() {
	const [updates, projects] = await Promise.all([getAllUpdatesInternal(), getProjects()]);
	const listedSlugs = new Set(projects.map((project) => project.entry.data.slug));
	return updates.filter((update) => listedSlugs.has(update.data.projectSlug));
}

export async function getProjectBySlug(slug: string) {
	const projects = await getAllProjects();
	return projects.find((project) => project.entry.data.slug === slug) ?? null;
}

export function serializeProject(project: EnrichedProject, site?: URL) {
	const base = resolveSite(site);

	return {
		slug: project.entry.data.slug,
		title: project.entry.data.title,
		summary: project.entry.data.summary,
		agentSummary: project.entry.data.agentSummary,
		status: project.entry.data.status,
		surface: project.entry.data.surface,
		featured: project.entry.data.featured,
		tags: project.entry.data.tags,
		repoUrls: project.repoUrls,
		demoUrl: project.entry.data.demoUrl ?? null,
		heroImage: absoluteUrl(project.entry.data.heroImage, base).toString(),
		lastUpdated: normalizeCalendarDate(project.entry.data.lastUpdated).toISOString(),
		lastActivity: project.lastActivity.toISOString(),
		order: project.entry.data.order,
		labStage: project.entry.data.labStage,
		updateCount: project.updates.length,
		url: absoluteUrl(`/projects/${project.entry.data.slug}/`, base).toString(),
		sync: project.sync,
	};
}

export function serializeUpdate(update: UpdateEntry, site?: URL) {
	const base = resolveSite(site);

	return {
		id: update.id,
		projectSlug: update.data.projectSlug,
		date: normalizeCalendarDate(update.data.date).toISOString(),
		title: update.data.title,
		summary: update.data.summary,
		source: update.data.source,
		links: update.data.links,
		url: absoluteUrl(`/projects/${update.data.projectSlug}/#update-${update.id}`, base).toString(),
	};
}

export function getContentSnapshotMeta() {
	return {
		syncGeneratedAt: getSyncGeneratedAt(),
	};
}
