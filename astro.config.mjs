// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

const site = process.env.SITE_URL || 'https://d449i4mct1wst.cloudfront.net';

export default defineConfig({
	site,
	output: 'static',
	trailingSlash: 'always',
	build: {
		format: 'directory',
	},
	integrations: [mdx(), sitemap()],
	markdown: {
		shikiConfig: {
			theme: 'github-dark',
		},
	},
});
