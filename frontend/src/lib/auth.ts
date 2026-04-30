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
	// Production: set BETTER_AUTH_BASE_URL to the public site URL. In `vite dev`, omitting baseURL lets
	// Better Auth use the request origin so /api/auth/* matches even when .env has a different port
	// (e.g. Docker :3000) than the Vite server (e.g. :5173) — otherwise sign-out returns 404.
	baseURL: dev ? undefined : (env.BETTER_AUTH_BASE_URL?.trim() || undefined),
	plugins: [sveltekitCookies(getRequestEvent)]
});
