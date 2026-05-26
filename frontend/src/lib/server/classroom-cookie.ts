import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';

export const CLASSROOM_COOKIE_NAME = 'classroom_session';
const COOKIE_TTL_SECONDS = 8 * 60 * 60;
const DEV_CLASSROOM_COOKIE_SECRET = 'dev-classroom-cookie-secret';

export interface ClassroomCookiePayload {
	classroomId: string;
	participantId: string;
	displayName: string;
	exp: number;
}

function getSecret(): string {
	const secret = env.BETTER_AUTH_SECRET;
	if (secret?.trim()) return secret;
	if (process.env.NODE_ENV !== 'production') return DEV_CLASSROOM_COOKIE_SECRET;
	throw new Error('BETTER_AUTH_SECRET is required for classroom sessions.');
}

function encodeBase64Url(value: string): string {
	return Buffer.from(value, 'utf8').toString('base64url');
}

function decodeBase64Url(value: string): string {
	return Buffer.from(value, 'base64url').toString('utf8');
}

function sign(payload: string): string {
	return createHmac('sha256', getSecret()).update(payload).digest('base64url');
}

export function createClassroomCookieValue(
	payload: Omit<ClassroomCookiePayload, 'exp'>,
	now = Date.now()
): string {
	const body: ClassroomCookiePayload = {
		...payload,
		exp: Math.floor(now / 1000) + COOKIE_TTL_SECONDS
	};
	const encoded = encodeBase64Url(JSON.stringify(body));
	return `${encoded}.${sign(encoded)}`;
}

export function verifyClassroomCookieValue(value: string | undefined | null): ClassroomCookiePayload | null {
	if (!value) return null;
	const [encoded, signature] = value.split('.');
	if (!encoded || !signature) return null;

	const expected = sign(encoded);
	const signatureBuffer = Buffer.from(signature);
	const expectedBuffer = Buffer.from(expected);
	if (signatureBuffer.length !== expectedBuffer.length) return null;
	if (!timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

	try {
		const parsed = JSON.parse(decodeBase64Url(encoded)) as Partial<ClassroomCookiePayload>;
		if (
			!parsed.classroomId ||
			!parsed.participantId ||
			!parsed.displayName ||
			typeof parsed.exp !== 'number'
		) {
			return null;
		}
		if (parsed.exp <= Math.floor(Date.now() / 1000)) return null;
		return {
			classroomId: parsed.classroomId,
			participantId: parsed.participantId,
			displayName: parsed.displayName,
			exp: parsed.exp
		};
	} catch {
		return null;
	}
}

export function classroomCookieMaxAge(): number {
	return COOKIE_TTL_SECONDS;
}
