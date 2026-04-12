export const SITE_NAME = 'JC-Builds';
export const SITE_TITLE = 'JC-Builds Public Lab';
export const SITE_DESCRIPTION =
	'An agent-readable public lab and portfolio for active builds, dated updates, and infrastructure-aware project work.';
export const SITE_FALLBACK_URL = 'https://d449i4mct1wst.cloudfront.net';

export function resolveSite(site?: URL) {
	return site ?? new URL(SITE_FALLBACK_URL);
}

export function absoluteUrl(pathname: string, site?: URL) {
	return new URL(pathname, resolveSite(site));
}

export function normalizeCalendarDate(date: Date) {
	return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12));
}

export function formatDate(date: Date) {
	return new Intl.DateTimeFormat('en-US', {
		dateStyle: 'medium',
	}).format(date);
}

export function formatCalendarDate(date: Date) {
	return new Intl.DateTimeFormat('en-US', {
		dateStyle: 'medium',
		timeZone: 'UTC',
	}).format(date);
}

export function formatDateTime(date: Date) {
	return new Intl.DateTimeFormat('en-US', {
		dateStyle: 'medium',
		timeStyle: 'short',
	}).format(date);
}
