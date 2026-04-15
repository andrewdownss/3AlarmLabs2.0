import { browser } from '$app/environment';
import { createAuthClient } from 'better-auth/svelte';

/**
 * Sign-out and other client calls must hit the same origin the browser uses so * Set-Cookie from Better Auth matches this site (especially important behind HTTPS / proxies).
 */
export const authClient = createAuthClient({
	baseURL: browser ? window.location.origin : ''
});
