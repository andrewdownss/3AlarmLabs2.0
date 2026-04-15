declare const SECURE_SESSION_COOKIE = "__Secure-better-auth.session_token";
declare const PLAIN_SESSION_COOKIE = "better-auth.session_token";
export interface ParsedBetterAuthSessionCookie {
    cookieName: typeof SECURE_SESSION_COOKIE | typeof PLAIN_SESSION_COOKIE;
    raw: string;
}
/**
 * Reads the signed session cookie from a Cookie header.
 * Prefer `__Secure-` when both are present — Better Auth sets that on HTTPS; an older plain cookie can remain and would win with wrong precedence.
 */
export declare function parseBetterAuthSessionCookieHeader(header: string | undefined): ParsedBetterAuthSessionCookie | null;
/**
 * Better Auth sets `session_token` via better-call `signCookieValue`: `${dbToken}.${hmacBase64}`,
 * then URI-encodes for Set-Cookie. The raw session row `token` must be recovered before DB lookup.
 * See better-call `getSignedCookie` (signature shape) — `split('.')[0]` is wrong when `dbToken` contains '.'.
 */
export declare function sessionTokenFromBetterAuthCookieValue(raw: string): string;
export {};
//# sourceMappingURL=better-auth-session-token.d.ts.map