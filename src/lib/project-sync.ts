import syncSnapshot from '../data/project-sync.generated.json';

type ProjectSyncRecord = {
	slug: string;
	localPath: string | null;
	available: boolean;
	branch: string | null;
	dirty: boolean;
	lastCommitHash: string | null;
	lastCommitDate: string | null;
	lastCommitSubject: string | null;
	remoteUrls: string[];
	error: string | null;
};

type ProjectSyncSnapshot = {
	generatedAt: string | null;
	projects: Record<string, ProjectSyncRecord>;
};

const snapshot = syncSnapshot as ProjectSyncSnapshot;

export function getProjectSync(slug: string) {
	return snapshot.projects[slug] ?? null;
}

export function getSyncGeneratedAt() {
	return snapshot.generatedAt;
}
