import { auth } from '$lib/auth';
import type { RequestHandler } from './$types';

/**
 * Same-origin logout endpoint. Forwards to Better Auth's sign-out handler so session cookies are
 * cleared even when `/api/auth/*` is not intercepted (e.g. misconfigured BETTER_AUTH_BASE_URL origin).
 */
export const POST: RequestHandler = async (event) => {
	const url = new URL('/api/auth/sign-out', event.url);
	const forwarded = new Request(url, {
		method: 'POST',
		headers: event.request.headers
	});
	return auth.handler(forwarded);
};
