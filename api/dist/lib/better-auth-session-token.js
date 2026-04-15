/**
 * Better Auth sets `session_token` via better-call `signCookieValue`: `${dbToken}.${hmacBase64}`,
 * then URI-encodes for Set-Cookie. The raw session row `token` must be recovered before DB lookup.
 * See better-call `getSignedCookie` (signature shape) — `split('.')[0]` is wrong when `dbToken` contains '.'.
 */
export function sessionTokenFromBetterAuthCookieValue(raw) {
    let value = raw.trim();
    if (!value)
        return value;
    if (value.includes('%')) {
        try {
            value = decodeURIComponent(value);
        }
        catch {
            /* keep as-is */
        }
    }
    const dot = value.lastIndexOf('.');
    if (dot < 1)
        return value;
    const possibleSignature = value.slice(dot + 1);
    if (possibleSignature.length === 44 && possibleSignature.endsWith('=')) {
        return value.slice(0, dot);
    }
    return value.split('.')[0];
}
//# sourceMappingURL=better-auth-session-token.js.map