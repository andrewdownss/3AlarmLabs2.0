import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '$lib/server/db';
import { env } from '$env/dynamic/private';
import { hashPassword, verifyPassword } from '$lib/server/password';
import { sendPasswordResetEmail } from '$lib/server/email';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
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
	baseURL: env.BETTER_AUTH_BASE_URL ?? 'http://localhost',
	plugins: [sveltekitCookies(getRequestEvent)]
});
