import cookie from 'cookie';

const SECURE_SESSION_COOKIE = '__Secure-better-auth.session_token';
const PLAIN_SESSION_COOKIE = 'better-auth.session_token';

export interface ParsedBetterAuthSessionCookie {
	cookieName: typeof SECURE_SESSION_COOKIE | typeof PLAIN_SESSION_COOKIE;
	raw: string;
}

/**
 * Reads the signed session cookie from a Cookie header.
 * Prefer `__Secure-` when both are present — Better Auth sets that on HTTPS; an older plain cookie can remain and would win with wrong precedence.
 */
export function parseBetterAuthSessionCookieHeader(
	header: string | undefined
): ParsedBetterAuthSessionCookie | null {
	const cookies = cookie.parse(header || '');
	const secure = cookies[SECURE_SESSION_COOKIE];
	if (secure) return { cookieName: SECURE_SESSION_COOKIE, raw: secure };
	const plain = cookies[PLAIN_SESSION_COOKIE];
	if (plain) return { cookieName: PLAIN_SESSION_COOKIE, raw: plain };
	return null;
}

/**
 * Better Auth sets `session_token` via better-call `signCookieValue`: `${dbToken}.${hmacBase64}`,
 * then URI-encodes for Set-Cookie. The raw session row `token` must be recovered before DB lookup.
 * See better-call `getSignedCookie` (signature shape) — `split('.')[0]` is wrong when `dbToken` contains '.'.
 */
export function sessionTokenFromBetterAuthCookieValue(raw: string): string {
	let value = raw.trim();
	if (!value) return value;

	if (value.includes('%')) {
		try {
			value = decodeURIComponent(value);
		} catch {
			/* keep as-is */
		}
	}

	const dot = value.lastIndexOf('.');
	if (dot < 1) return value;

	const possibleSignature = value.slice(dot + 1);
	if (possibleSignature.length === 44 && possibleSignature.endsWith('=')) {
		return value.slice(0, dot);
	}

	return value.split('.')[0];
}
