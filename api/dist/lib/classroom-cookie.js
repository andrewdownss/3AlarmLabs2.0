import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';
export const CLASSROOM_COOKIE_NAME = 'classroom_session';
const DEV_CLASSROOM_COOKIE_SECRET = 'dev-classroom-cookie-secret';
const COOKIE_TTL_SECONDS = 8 * 60 * 60;
function getSecret() {
    const secret = env.BETTER_AUTH_SECRET?.trim();
    if (secret)
        return secret;
    if (process.env.NODE_ENV !== 'production')
        return DEV_CLASSROOM_COOKIE_SECRET;
    return null;
}
function sign(payload) {
    const secret = getSecret();
    if (!secret)
        return null;
    return createHmac('sha256', secret).update(payload).digest('base64url');
}
export function createClassroomCookieValue(payload, now = Date.now()) {
    const body = {
        ...payload,
        exp: Math.floor(now / 1000) + COOKIE_TTL_SECONDS
    };
    const encoded = Buffer.from(JSON.stringify(body), 'utf8').toString('base64url');
    const signature = sign(encoded);
    if (!signature)
        return null;
    return `${encoded}.${signature}`;
}
export function classroomCookieMaxAge() {
    return COOKIE_TTL_SECONDS;
}
export function verifyClassroomCookieValue(value) {
    if (!value)
        return null;
    const [encoded, signature] = value.split('.');
    if (!encoded || !signature)
        return null;
    const expected = sign(encoded);
    if (!expected)
        return null;
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (signatureBuffer.length !== expectedBuffer.length)
        return null;
    if (!timingSafeEqual(signatureBuffer, expectedBuffer))
        return null;
    try {
        const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
        if (!parsed.classroomId ||
            !parsed.participantId ||
            !parsed.displayName ||
            typeof parsed.exp !== 'number') {
            return null;
        }
        if (parsed.exp <= Math.floor(Date.now() / 1000))
            return null;
        return {
            classroomId: parsed.classroomId,
            participantId: parsed.participantId,
            displayName: parsed.displayName,
            exp: parsed.exp
        };
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=classroom-cookie.js.map