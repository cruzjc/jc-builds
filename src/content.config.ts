import { glob } from 'astro/loaders';
import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';

const projectSlug = z.string().regex(/^[a-z0-9-]+$/);
const projectStatus = z.enum(['active', 'shipping', 'research', 'archived']);
const projectStage = z.enum(['tracking', 'building', 'testing', 'shipping']);
const projectSurface = z.enum(['listed', 'reference']);
const projectLink = z.object({
	label: z.string(),
	url: z.url(),
});

const projects = defineCollection({
	loader: glob({
		base: './src/content/projects',
		pattern: '**/*.{md,mdx}',
		generateId: ({ data, entry }) => {
			if (typeof data.slug === 'string' && data.slug.length > 0) {
				return data.slug;
			}

			return entry.replace(/\.(md|mdx)$/u, '');
		},
	}),
	schema: z.object({
		slug: projectSlug,
		title: z.string(),
		summary: z.string().max(240),
		agentSummary: z.string().max(280),
		status: projectStatus,
		surface: projectSurface.default('listed'),
		featured: z.boolean().default(false),
		tags: z.array(z.string()).min(1),
		repoUrls: z.array(z.url()).default([]),
		demoUrl: z.url().optional(),
		heroImage: z.string(),
		lastUpdated: z.coerce.date(),
		order: z.number().int().nonnegative().default(999),
		labStage: projectStage.default('building'),
	}),
});

const updates = defineCollection({
	loader: glob({
		base: './src/content/updates',
		pattern: '**/*.{md,mdx}',
	}),
	schema: z.object({
		projectSlug,
		date: z.coerce.date(),
		title: z.string(),
		summary: z.string().max(280),
		links: z.array(projectLink).default([]),
		source: z.enum(['manual', 'git-sync', 'agent']).default('manual'),
	}),
});

export const collections = {
	projects,
	updates,
};
