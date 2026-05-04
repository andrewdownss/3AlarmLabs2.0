import { auth } from '$lib/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { building, dev } from '$app/environment';
import { sequence } from '@sveltejs/kit/hooks';
import type { Handle, HandleServerError } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user as userTable } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { getCachedUserRow, setCachedUserRow } from '$lib/server/cache';
import { getPostHogClient } from '$lib/server/posthog';

// Proxy PostHog requests through /ingest to avoid ad blockers
const posthogProxyHandle: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;
	if (pathname.startsWith('/ingest')) {
		const useAssetHost =
			pathname.startsWith('/ingest/static/') || pathname.startsWith('/ingest/array/');
		const hostname = useAssetHost ? 'us-assets.i.posthog.com' : 'us.i.posthog.com';

		const url = new URL(event.request.url);
		url.protocol = 'https:';
		url.hostname = hostname;
		url.port = '443';
		url.pathname = pathname.replace(/^\/ingest/, '');

		const headers = new Headers(event.request.headers);
		headers.set('host', hostname);
		headers.set('accept-encoding', '');

		const clientIp = event.request.headers.get('x-forwarded-for') || event.getClientAddress();
		if (clientIp) headers.set('x-forwarded-for', clientIp);

		return fetch(url.toString(), {
			method: event.request.method,
			headers,
			body: event.request.body,
			// @ts-expect-error - duplex required for streaming request bodies
			duplex: 'half'
		});
	}
	return resolve(event);
};

/** Dev-only slow-request log (Lighthouse/Network panel are still the best full baselines; Postgres: pg_stat_statements). */
const perfHandle: Handle = async ({ event, resolve }) => {
	const t0 = performance.now();
	const response = await resolve(event);
	if (dev) {
		const ms = performance.now() - t0;
		if (ms >= 400) {
			console.log(
				`[perf] ${event.request.method} ${event.url.pathname}${event.url.search} ${ms.toFixed(0)}ms`
			);
		}
	}
	return response;
};

const securityHeadersHandle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	response.headers.set('X-Frame-Options', 'SAMEORIGIN');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()');

	return response;
};

const authHandle: Handle = async ({ event, resolve }) => {
	const session = await auth.api.getSession({
		headers: event.request.headers
	});

	if (session) {
		event.locals.session = session.session;

		const userId = session.user.id;
		type UserRow = NonNullable<App.Locals['user']>;
		let dbUser = getCachedUserRow<UserRow>(userId);
		if (!dbUser) {
			dbUser = await fetchUserRow(userId);
			if (dbUser) setCachedUserRow(userId, dbUser);
		}

		if (dbUser) {
			event.locals.user = dbUser;
		}
	}

	// Better Auth's `isAuthPath` requires request origin === configured baseURL origin. When
	// BETTER_AUTH_BASE_URL is apex-only but users hit www (or previews use another host), auth routes
	// are skipped → POST /api/auth/sign-out resolves as a missing page (404). Route by pathname only.
	// Default is `/api/auth`; `options.basePath` is omitted from the inferred type but may be set at runtime.
	const authBase =
		((auth.options as { basePath?: string }).basePath ?? '/api/auth').replace(/\/$/, '') ||
		'/api/auth';
	const { pathname } = event.url;
	if (!building && (pathname === authBase || pathname.startsWith(`${authBase}/`))) {
		return auth.handler(event.request);
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

async function fetchUserRow(userId: string) {
	return db.query.user.findFirst({
		where: eq(userTable.id, userId),
		columns: {
			id: true,
			name: true,
			email: true,
			emailVerified: true,
			image: true,
			isAdmin: true,
			createdAt: true,
			updatedAt: true
		}
	});
}

export const handle = sequence(posthogProxyHandle, perfHandle, securityHeadersHandle, authHandle);

export const handleError: HandleServerError = async ({ error, status, message }) => {
	const posthog = getPostHogClient();
	posthog.capture({
		distinctId: 'server',
		event: 'server_error',
		properties: {
			error: error instanceof Error ? error.message : String(error),
			status,
			message
		}
	});
	return { message, status };
};
