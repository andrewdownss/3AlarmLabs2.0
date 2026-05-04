import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '$lib/server/db';
import { env } from '$env/dynamic/private';
import { hashPassword, verifyPassword } from '$lib/server/password';
import { sendPasswordResetEmail } from '$lib/server/email';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { dev } from '$app/environment';
import { invalidateUserCache } from '$lib/server/cache';

const trustedOriginsExtra =
	env.BETTER_AUTH_TRUSTED_ORIGINS?.split(',')
		.map((origin) => origin.trim())
		.filter(Boolean) ?? [];

export const auth = betterAuth({
	database: drizzleAdapter(db, { provider: 'pg' }),
	databaseHooks: {
		user: {
			update: {
				after: async (user) => {
					invalidateUserCache(user.id);
				}
			},
			delete: {
				after: async (user) => {
					invalidateUserCache(user.id);
				}
			}
		}
	},
	secret: env.BETTER_AUTH_SECRET,
	emailAndPassword: {
		enabled: true,
		password: {
			hash: hashPassword,
			verify: ({ password, hash }) => verifyPassword(password, hash)
		},
		sendResetPassword: async ({ user, url }) => {
			void sendPasswordResetEmail(user.email, url);
		}
	},
	sessions: { strategy: 'database' },
	// Prefer leaving BETTER_AUTH_BASE_URL unset in production so Better Auth derives the origin from
	// each request (www vs apex, HTTPS, proxies). If set, it MUST exactly match the browser origin or
	// /api/auth/* won't be routed and CSRF trustedOrigins won't match — sign-out breaks silently.
	// Extra origins: set BETTER_AUTH_TRUSTED_ORIGINS (comma-separated) per Better Auth docs.
	baseURL: dev ? undefined : (env.BETTER_AUTH_BASE_URL?.trim() || undefined),
	...(trustedOriginsExtra.length > 0 ? { trustedOrigins: trustedOriginsExtra } : {}),
	plugins: [sveltekitCookies(getRequestEvent)]
});
