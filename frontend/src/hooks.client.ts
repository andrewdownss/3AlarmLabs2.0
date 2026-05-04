import posthog from 'posthog-js';
import { env } from '$env/dynamic/public';
import type { HandleClientError } from '@sveltejs/kit';

let isPostHogInitialized = false;

export async function init() {
	const token = env.PUBLIC_POSTHOG_PROJECT_TOKEN?.trim();
	if (!token) return;

	posthog.init(token, {
		api_host: '/ingest',
		ui_host: env.PUBLIC_POSTHOG_UI_HOST || 'https://us.posthog.com',
		defaults: '2026-01-30',
		capture_exceptions: true
	});
	isPostHogInitialized = true;
}

export const handleError: HandleClientError = async ({ error, status, message }) => {
	if (!isPostHogInitialized) return { message, status };
	posthog.captureException(error);
	return { message, status };
};
