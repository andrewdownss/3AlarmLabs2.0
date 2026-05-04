import { browser } from '$app/environment';
import { createAuthClient } from 'better-auth/svelte';

/**
 * Sign-out and other client calls must hit the same origin the browser uses so Set-Cookie from
 * Better Auth matches this site (especially important behind HTTPS / proxies).
 */
export const authClient = createAuthClient({
	baseURL: browser ? window.location.origin : ''
});

/**
 * Prefer POST `/logout`, which forwards to Better Auth's sign-out handler on the server (works even
 * when `/api/auth/*` routing or CSRF trusted origins are misconfigured). Falls back to the client SDK.
 */
export async function performLogout(): Promise<void> {
	if (!browser) return;
	try {
		const res = await fetch('/logout', {
			method: 'POST',
			credentials: 'same-origin',
			headers: { Accept: 'application/json' }
		});
		if (res.ok) return;
	} catch {
		/* fall through to SDK */
	}
	await authClient.signOut();
}
