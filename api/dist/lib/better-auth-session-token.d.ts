/**
 * Better Auth sets `session_token` via better-call `signCookieValue`: `${dbToken}.${hmacBase64}`,
 * then URI-encodes for Set-Cookie. The raw session row `token` must be recovered before DB lookup.
 * See better-call `getSignedCookie` (signature shape) — `split('.')[0]` is wrong when `dbToken` contains '.'.
 */
export declare function sessionTokenFromBetterAuthCookieValue(raw: string): string;
//# sourceMappingURL=better-auth-session-token.d.ts.map