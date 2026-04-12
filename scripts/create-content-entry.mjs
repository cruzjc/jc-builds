import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const projectsDir = resolve(rootDir, 'src/content/projects');
const updatesDir = resolve(rootDir, 'src/content/updates');
const projectSyncConfigPath = resolve(rootDir, 'project-sync.config.json');
const siteConstantsPath = resolve(rootDir, 'src/lib/constants.ts');

const projectStatuses = new Set(['active', 'shipping', 'research', 'archived']);
const projectStages = new Set(['tracking', 'building', 'testing', 'shipping']);
const projectSurfaces = new Set(['listed', 'reference']);
const updateSources = new Set(['manual', 'git-sync', 'agent']);

function printRootUsage() {
	console.log(`Usage:
  node scripts/create-content-entry.mjs project [options]
  node scripts/create-content-entry.mjs update [options]

Commands:
  project   Scaffold a new file in src/content/projects
  update    Scaffold a new dated file in src/content/updates

Run the subcommand with --help for detailed options.`);
}

function printProjectUsage() {
	console.log(`Usage:
  pnpm new:project -- --title "Project Title" --summary "Short summary" [options]

Options:
  --title <text>                 Required project title
  --slug <slug>                  Optional slug, inferred from title when omitted
  --summary <text>               Required human-facing summary (max 240)
  --agent-summary <text>         Optional machine-facing summary (defaults to summary, max 280)
  --status <value>               active | shipping | research | archived (default: active)
  --surface <value>              listed | reference (default: listed)
  --featured <true|false>        Mark as featured (default: false)
  --tags <csv>                   Comma-separated tags (defaults to slug)
  --tag <value>                  Repeatable single tag
  --repo-url <url>               Repeatable repository URL
  --demo-url <url>               Optional demo URL
  --hero-image <path>            Hero image path (default: /art/<slug>.svg)
  --last-updated <YYYY-MM-DD>    Default: today
  --order <number>               Default: next available order
  --lab-stage <value>            tracking | building | testing | shipping (default: building)
  --local-path <path>            Optional local repo path to register in project-sync.config.json
  --body <markdown>              Optional body content
  --body-file <path>             Read body content from a file
  --force                        Overwrite an existing file
  --dry-run                      Print the generated output without writing files
  --help                         Show this message`);
}

function printUpdateUsage() {
	console.log(`Usage:
  pnpm new:update -- --project <slug> --title "Update title" --summary "Short summary" [options]

Aliases:
  pnpm new:post -- --project <slug> --title "Update title" --summary "Short summary"

Options:
  --project <slug>               Required project slug
  --date <YYYY-MM-DD>            Default: today
  --title <text>                 Required update title
  --summary <text>               Required update summary (max 280)
  --source <value>               manual | git-sync | agent (default: agent)
  --link "Label|https://..."     Repeatable link entry
  --body <markdown>              Optional body content
  --body-file <path>             Read body content from a file
  --no-project-link              Skip the default project-page link
  --no-touch-project             Do not update the matching project's lastUpdated value
  --force                        Overwrite an existing file
  --dry-run                      Print the generated output without writing files
  --help                         Show this message`);
}

function parseArgs(argv) {
	const args = { _: [] };

	for (let index = 0; index < argv.length; index += 1) {
		const token = argv[index];
		if (!token.startsWith('--')) {
			args._.push(token);
			continue;
		}

		if (token === '--') {
			continue;
		}

		let rawKey = token.slice(2);
		let value;

		if (rawKey.startsWith('no-')) {
			rawKey = rawKey.slice(3);
			value = false;
		} else if (rawKey.includes('=')) {
			const splitIndex = rawKey.indexOf('=');
			value = rawKey.slice(splitIndex + 1);
			rawKey = rawKey.slice(0, splitIndex);
		} else {
			const nextToken = argv[index + 1];
			if (nextToken && !nextToken.startsWith('--')) {
				value = nextToken;
				index += 1;
			} else {
				value = true;
			}
		}

		const key = rawKey.replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase());
		const existing = args[key];
		if (existing === undefined) {
			args[key] = value;
			continue;
		}

		args[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
	}

	return args;
}

function getArg(args, key) {
	const value = args[key];
	return Array.isArray(value) ? value.at(-1) : value;
}

function getArrayArg(args, ...keys) {
	return keys.flatMap((key) => {
		const value = args[key];
		if (value === undefined) {
			return [];
		}

		return Array.isArray(value) ? value : [value];
	});
}

function getBooleanArg(args, key, defaultValue = false) {
	const value = getArg(args, key);
	if (value === undefined) {
		return defaultValue;
	}

	if (typeof value === 'boolean') {
		return value;
	}

	const normalized = String(value).trim().toLowerCase();
	if (['1', 'true', 'yes', 'y'].includes(normalized)) {
		return true;
	}

	if (['0', 'false', 'no', 'n'].includes(normalized)) {
		return false;
	}

	throw new Error(`Invalid boolean value for --${key}: ${value}`);
}

function requireTextArg(args, key, label = key) {
	const value = getArg(args, key);
	if (typeof value !== 'string' || value.trim().length === 0) {
		throw new Error(`Missing required --${label}`);
	}

	return value.trim();
}

function slugify(value) {
	return value
		.toLowerCase()
		.replace(/['’]/gu, '')
		.replace(/[^a-z0-9]+/gu, '-')
		.replace(/^-+|-+$/gu, '')
		.replace(/-{2,}/gu, '-');
}

function formatLocalDate(date = new Date()) {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

function coerceDate(value) {
	const resolved = value?.trim() || formatLocalDate();
	if (!/^\d{4}-\d{2}-\d{2}$/u.test(resolved)) {
		throw new Error(`Expected YYYY-MM-DD date, received: ${resolved}`);
	}

	return resolved;
}

function splitCsvValues(values) {
	return values
		.flatMap((value) => String(value).split(','))
		.map((value) => value.trim())
		.filter(Boolean);
}

function ensureValueInSet(value, allowed, label) {
	if (!allowed.has(value)) {
		throw new Error(`Invalid ${label}: ${value}`);
	}

	return value;
}

function ensureUrl(value, label) {
	try {
		return new URL(value).toString();
	} catch {
		throw new Error(`Invalid URL for ${label}: ${value}`);
	}
}

function ensureLength(value, max, label) {
	if (value.length > max) {
		throw new Error(`${label} must be ${max} characters or fewer`);
	}

	return value;
}

function quoteYamlString(value) {
	return JSON.stringify(value);
}

function renderScalarLine(key, value) {
	if (typeof value === 'boolean' || typeof value === 'number') {
		return `${key}: ${value}`;
	}

	return `${key}: ${quoteYamlString(String(value))}`;
}

function renderStringList(key, values) {
	if (values.length === 0) {
		return `${key}: []`;
	}

	return `${key}:\n${values.map((value) => `  - ${quoteYamlString(value)}`).join('\n')}`;
}

function renderLinkList(links) {
	if (links.length === 0) {
		return 'links: []';
	}

	return `links:\n${links
		.map(
			(link) =>
				`  - label: ${quoteYamlString(link.label)}\n    url: ${quoteYamlString(link.url)}`,
		)
		.join('\n')}`;
}

function renderDocument(frontmatterLines, body) {
	return ['---', ...frontmatterLines, '---', '', body.trim(), ''].join('\n');
}

async function listFiles(dirPath) {
	const entries = await readdir(dirPath, { withFileTypes: true });
	const files = [];

	for (const entry of entries) {
		const absolutePath = resolve(dirPath, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await listFiles(absolutePath)));
			continue;
		}

		if (entry.isFile() && /\.(md|mdx)$/u.test(entry.name)) {
			files.push(absolutePath);
		}
	}

	return files.sort();
}

function splitFrontmatter(content) {
	const match = content.match(/^---\n([\s\S]*?)\n---\n?/u);
	if (!match) {
		return { frontmatter: '', body: content };
	}

	return {
		frontmatter: match[1],
		body: content.slice(match[0].length),
	};
}

function extractFrontmatterScalar(frontmatter, key) {
	const match = frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, 'mu'));
	if (!match) {
		return null;
	}

	const rawValue = match[1].trim();
	if (
		(rawValue.startsWith('"') && rawValue.endsWith('"')) ||
		(rawValue.startsWith("'") && rawValue.endsWith("'"))
	) {
		return rawValue.slice(1, -1);
	}

	return rawValue;
}

function extractFrontmatterStringList(frontmatter, key) {
	const lines = frontmatter.split('\n');
	const startIndex = lines.findIndex((line) => line.startsWith(`${key}:`));
	if (startIndex === -1) {
		return [];
	}

	const inlineValue = lines[startIndex].slice(key.length + 1).trim();
	if (inlineValue === '[]') {
		return [];
	}

	if (inlineValue.length > 0) {
		return [inlineValue.replace(/^["']|["']$/gu, '')];
	}

	const values = [];
	for (let index = startIndex + 1; index < lines.length; index += 1) {
		const line = lines[index];
		if (!line.startsWith('  - ')) {
			break;
		}

		values.push(line.slice(4).trim().replace(/^["']|["']$/gu, ''));
	}

	return values;
}

async function readProjectRecords() {
	const files = await listFiles(projectsDir);
	return Promise.all(
		files.map(async (filePath) => {
			const content = await readFile(filePath, 'utf8');
			const { frontmatter } = splitFrontmatter(content);
			return {
				path: filePath,
				frontmatter,
				slug: extractFrontmatterScalar(frontmatter, 'slug'),
				title: extractFrontmatterScalar(frontmatter, 'title'),
				surface: extractFrontmatterScalar(frontmatter, 'surface'),
				lastUpdated: extractFrontmatterScalar(frontmatter, 'lastUpdated'),
				order: Number.parseInt(extractFrontmatterScalar(frontmatter, 'order') ?? '999', 10),
				repoUrls: extractFrontmatterStringList(frontmatter, 'repoUrls'),
			};
		}),
	);
}

async function getNextProjectOrder(surface) {
	const projects = await readProjectRecords();
	const scopedProjects = projects.filter((project) => {
		if (!project.surface) {
			return true;
		}

		return project.surface === surface;
	});
	const maxOrder = scopedProjects.reduce((currentMax, project) => {
		if (!Number.isFinite(project.order)) {
			return currentMax;
		}

		return Math.max(currentMax, project.order);
	}, 0);

	return maxOrder + 1;
}

async function findProjectRecord(slug) {
	const projects = await readProjectRecords();
	return projects.find((project) => project.slug === slug) ?? null;
}

async function loadBody({ body, bodyFile, fallbackBody }) {
	if (typeof body === 'string' && body.trim().length > 0) {
		return body.trim();
	}

	if (typeof bodyFile === 'string' && bodyFile.trim().length > 0) {
		return (await readFile(resolve(rootDir, bodyFile), 'utf8')).trim();
	}

	return fallbackBody.trim();
}

async function writeTextOutput(filePath, content, dryRun) {
	if (dryRun) {
		console.log(`Would write ${filePath}\n`);
		console.log(content);
		return;
	}

	await mkdir(dirname(filePath), { recursive: true });
	await writeFile(filePath, content, 'utf8');
	console.log(`Wrote ${filePath}`);
}

async function upsertProjectSyncConfig({ slug, localPath, repoUrls, dryRun }) {
	if (!localPath) {
		return;
	}

	const payload = existsSync(projectSyncConfigPath)
		? JSON.parse(await readFile(projectSyncConfigPath, 'utf8'))
		: { projects: [] };
	const projects = Array.isArray(payload.projects) ? payload.projects : [];
	const existingIndex = projects.findIndex((project) => project.slug === slug);
	const nextEntry = {
		slug,
		localPath,
		remoteUrls: repoUrls,
	};

	if (existingIndex >= 0) {
		projects[existingIndex] = nextEntry;
	} else {
		projects.push(nextEntry);
	}

	const nextPayload = `${JSON.stringify({ ...payload, projects }, null, 2)}\n`;
	if (dryRun) {
		console.log(`Would update ${projectSyncConfigPath} for slug ${slug}`);
		return;
	}

	await writeFile(projectSyncConfigPath, nextPayload, 'utf8');
	console.log(`Updated ${projectSyncConfigPath}`);
}

async function updateProjectLastUpdated({ project, date, dryRun }) {
	if (!project?.path) {
		return;
	}

	const content = await readFile(project.path, 'utf8');
	if (!/^lastUpdated:\s*/mu.test(content)) {
		return;
	}

	const nextContent = content.replace(
		/(^lastUpdated:\s*)(.+)$/mu,
		(_, prefix) => `${prefix}${quoteYamlString(date)}`,
	);

	if (content === nextContent) {
		return;
	}

	if (dryRun) {
		console.log(`Would update ${project.path} lastUpdated -> ${date}`);
		return;
	}

	await writeFile(project.path, nextContent, 'utf8');
	console.log(`Updated ${project.path}`);
}

async function resolveSiteUrl() {
	if (process.env.SITE_URL?.trim()) {
		return new URL(process.env.SITE_URL.trim()).toString().replace(/\/$/u, '');
	}

	const constantsSource = await readFile(siteConstantsPath, 'utf8');
	const match = constantsSource.match(/SITE_FALLBACK_URL\s*=\s*'([^']+)'/u);
	if (!match) {
		throw new Error('Unable to read SITE_FALLBACK_URL from src/lib/constants.ts');
	}

	return match[1].replace(/\/$/u, '');
}

function defaultProjectBody() {
	return `## Objective

Describe why this project exists and what problem it solves.

## How it works

Summarize the stack, runtime, or operating model that matters most.

## Current state

Capture the current status, important boundaries, and the next visible step.`;
}

function defaultUpdateBody(projectTitle) {
	return `Document the dated change for ${projectTitle ?? 'this project'} here.

Call out the user-facing impact, the operational change, or the next step that matters.`;
}

function parseLinks(args) {
	return getArrayArg(args, 'link').map((rawValue) => {
		const value = String(rawValue).trim();
		const separator = value.includes('|') ? '|' : '=';
		const splitIndex = value.indexOf(separator);
		if (splitIndex <= 0) {
			throw new Error(`Invalid --link value: ${value}`);
		}

		const label = value.slice(0, splitIndex).trim();
		const url = value.slice(splitIndex + 1).trim();
		if (!label || !url) {
			throw new Error(`Invalid --link value: ${value}`);
		}

		return {
			label,
			url: ensureUrl(url, '--link'),
		};
	});
}

async function createProjectEntry(args) {
	const title = requireTextArg(args, 'title');
	const slug = slugify(getArg(args, 'slug')?.trim() || title);
	if (!slug) {
		throw new Error('Unable to infer a slug. Provide --slug or a title with letters/numbers.');
	}

	const summary = ensureLength(requireTextArg(args, 'summary'), 240, 'Project summary');
	const agentSummary = ensureLength(
		(getArg(args, 'agentSummary')?.trim() || summary),
		280,
		'Project agent summary',
	);
	const status = ensureValueInSet(
		getArg(args, 'status')?.trim() || 'active',
		projectStatuses,
		'project status',
	);
	const surface = ensureValueInSet(
		getArg(args, 'surface')?.trim() || 'listed',
		projectSurfaces,
		'project surface',
	);
	const featured = getBooleanArg(args, 'featured', false);
	const tags = splitCsvValues(getArrayArg(args, 'tags', 'tag'));
	const repoUrls = splitCsvValues(getArrayArg(args, 'repoUrl')).map((url) => ensureUrl(url, '--repo-url'));
	const demoUrlArg = getArg(args, 'demoUrl');
	const demoUrl = typeof demoUrlArg === 'string' ? ensureUrl(demoUrlArg.trim(), '--demo-url') : null;
	const heroImage = getArg(args, 'heroImage')?.trim() || `/art/${slug}.svg`;
	const lastUpdated = coerceDate(getArg(args, 'lastUpdated'));
	const orderArg = getArg(args, 'order');
	const order =
		orderArg === undefined
			? await getNextProjectOrder(surface)
			: Number.parseInt(String(orderArg), 10);
	if (!Number.isInteger(order) || order < 0) {
		throw new Error(`Invalid project order: ${orderArg}`);
	}

	const labStage = ensureValueInSet(
		getArg(args, 'labStage')?.trim() || 'building',
		projectStages,
		'project lab stage',
	);
	const localPath = getArg(args, 'localPath')?.trim() || null;
	const body = await loadBody({
		body: getArg(args, 'body'),
		bodyFile: getArg(args, 'bodyFile'),
		fallbackBody: defaultProjectBody(),
	});
	const dryRun = getBooleanArg(args, 'dryRun', false);
	const force = getBooleanArg(args, 'force', false);
	const filePath = resolve(projectsDir, `${slug}.mdx`);

	if (existsSync(filePath) && !force) {
		throw new Error(`Project file already exists: ${filePath}`);
	}

	const frontmatter = [
		renderScalarLine('slug', slug),
		renderScalarLine('title', title),
		renderScalarLine('summary', summary),
		renderScalarLine('agentSummary', agentSummary),
		renderScalarLine('status', status),
		renderScalarLine('surface', surface),
		renderScalarLine('featured', featured),
		renderStringList('tags', tags.length > 0 ? tags : [slug]),
		renderStringList('repoUrls', repoUrls),
		...(demoUrl ? [renderScalarLine('demoUrl', demoUrl)] : []),
		renderScalarLine('heroImage', heroImage),
		renderScalarLine('lastUpdated', lastUpdated),
		renderScalarLine('order', order),
		renderScalarLine('labStage', labStage),
	];

	const content = renderDocument(frontmatter, body);
	await writeTextOutput(filePath, content, dryRun);
	await upsertProjectSyncConfig({
		slug,
		localPath,
		repoUrls,
		dryRun,
	});
}

async function createUpdateEntry(args) {
	const projectSlug = requireTextArg(args, 'project');
	const title = requireTextArg(args, 'title');
	const summary = ensureLength(requireTextArg(args, 'summary'), 280, 'Update summary');
	const date = coerceDate(getArg(args, 'date'));
	const source = ensureValueInSet(
		getArg(args, 'source')?.trim() || 'agent',
		updateSources,
		'update source',
	);
	const dryRun = getBooleanArg(args, 'dryRun', false);
	const force = getBooleanArg(args, 'force', false);
	const includeProjectLink = getBooleanArg(args, 'projectLink', true);
	const touchProject = getBooleanArg(args, 'touchProject', true);
	const project = await findProjectRecord(projectSlug);
	const body = await loadBody({
		body: getArg(args, 'body'),
		bodyFile: getArg(args, 'bodyFile'),
		fallbackBody: defaultUpdateBody(project?.title ?? projectSlug),
	});
	const slugFragment = slugify(title);
	if (!slugFragment) {
		throw new Error('Unable to infer an update filename slug from the title.');
	}
	const filePath = resolve(updatesDir, `${date}-${slugFragment}.mdx`);

	if (existsSync(filePath) && !force) {
		throw new Error(`Update file already exists: ${filePath}`);
	}

	const links = parseLinks(args);
	if (includeProjectLink && project) {
		const siteUrl = await resolveSiteUrl();
		const projectPageUrl = `${siteUrl}/projects/${projectSlug}/`;
		if (!links.some((link) => link.url === projectPageUrl)) {
			links.unshift({
				label: 'Project page',
				url: projectPageUrl,
			});
		}
	}

	const frontmatter = [
		renderScalarLine('projectSlug', projectSlug),
		renderScalarLine('date', date),
		renderScalarLine('title', title),
		renderScalarLine('summary', summary),
		renderLinkList(links),
		renderScalarLine('source', source),
	];

	const content = renderDocument(frontmatter, body);
	await writeTextOutput(filePath, content, dryRun);

	if (touchProject && project) {
		await updateProjectLastUpdated({
			project,
			date,
			dryRun,
		});
	}
}

async function main() {
	const [command, ...rest] = process.argv.slice(2);
	if (!command || command === '--help' || command === '-h') {
		printRootUsage();
		return;
	}

	const args = parseArgs(rest);
	if (getBooleanArg(args, 'help', false)) {
		if (command === 'project') {
			printProjectUsage();
			return;
		}

		if (command === 'update') {
			printUpdateUsage();
			return;
		}

		printRootUsage();
		return;
	}

	if (command === 'project') {
		await createProjectEntry(args);
		return;
	}

	if (command === 'update') {
		await createUpdateEntry(args);
		return;
	}

	throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
	console.error(error.message);
	process.exitCode = 1;
});
