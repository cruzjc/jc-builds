import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const configPath = resolve(rootDir, 'project-sync.config.json');
const outputPath = resolve(rootDir, 'src/data/project-sync.generated.json');

function readGitValue(localPath, args) {
	try {
		return execFileSync('git', ['-C', localPath, ...args], {
			cwd: rootDir,
			stdio: ['ignore', 'pipe', 'ignore'],
			encoding: 'utf8',
		}).trim();
	} catch {
		return '';
	}
}

async function readConfig() {
	if (!existsSync(configPath)) {
		return { projects: [] };
	}

	const raw = await readFile(configPath, 'utf8');
	return JSON.parse(raw);
}

function collectProjectSnapshot(project) {
	const localPath = project.localPath ? resolve(rootDir, project.localPath) : null;
	const remoteUrls = new Set(project.remoteUrls ?? []);
	const snapshot = {
		slug: project.slug,
		localPath,
		available: false,
		branch: null,
		dirty: false,
		lastCommitHash: null,
		lastCommitDate: null,
		lastCommitSubject: null,
		remoteUrls: [...remoteUrls],
		error: null,
	};

	if (!localPath || !existsSync(localPath)) {
		snapshot.error = 'Local path unavailable';
		return snapshot;
	}

	const topLevel = readGitValue(localPath, ['rev-parse', '--show-toplevel']);
	if (!topLevel) {
		snapshot.error = 'No git repository detected';
		return snapshot;
	}

	snapshot.available = true;
	snapshot.branch = readGitValue(localPath, ['branch', '--show-current']) || null;
	snapshot.dirty = Boolean(readGitValue(localPath, ['status', '--short']));

	const remoteUrl = readGitValue(localPath, ['remote', 'get-url', 'origin']);
	if (remoteUrl) {
		remoteUrls.add(remoteUrl);
	}

	const lastCommitHash = readGitValue(localPath, ['log', '-1', '--format=%H']);
	const lastCommitDate = readGitValue(localPath, ['log', '-1', '--format=%cI']);
	const lastCommitSubject = readGitValue(localPath, ['log', '-1', '--format=%s']);

	snapshot.lastCommitHash = lastCommitHash || null;
	snapshot.lastCommitDate = lastCommitDate || null;
	snapshot.lastCommitSubject = lastCommitSubject || null;
	snapshot.remoteUrls = [...remoteUrls];

	return snapshot;
}

async function main() {
	const config = await readConfig();
	const projects = Object.fromEntries(
		(config.projects ?? []).map((project) => [project.slug, collectProjectSnapshot(project)]),
	);

	const payload = {
		generatedAt: new Date().toISOString(),
		projects,
	};

	await mkdir(dirname(outputPath), { recursive: true });
	await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
	console.log(`Wrote ${outputPath}`);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
