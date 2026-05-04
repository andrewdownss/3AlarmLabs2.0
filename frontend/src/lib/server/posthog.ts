import { PostHog } from 'posthog-node';
import { env } from '$env/dynamic/public';

let posthogClient: PostHog | null = null;

const noopPostHogClient = {
	capture: () => undefined,
	flush: async () => undefined
};

export function getPostHogClient() {
	const token = env.PUBLIC_POSTHOG_PROJECT_TOKEN?.trim();
	if (!token) return noopPostHogClient;

	if (!posthogClient) {
		posthogClient = new PostHog(token, {
			host: env.PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
			flushAt: 1,
			flushInterval: 0
		});
	}
	return posthogClient;
}
