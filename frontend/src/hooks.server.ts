import { auth } from '$lib/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { building, dev } from '$app/environment';
import { sequence } from '@sveltejs/kit/hooks';
import type { Handle } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user as userTable } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { getCachedUserRow, setCachedUserRow } from '$lib/server/cache';

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

export const handle = sequence(perfHandle, securityHeadersHandle, authHandle);
