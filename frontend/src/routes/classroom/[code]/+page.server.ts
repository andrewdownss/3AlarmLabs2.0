import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { and, count, eq, gt, isNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { classroomParticipants, classrooms } from '$lib/server/db/schema';
import {
	CLASSROOM_COOKIE_NAME,
	classroomCookieMaxAge,
	createClassroomCookieValue,
	verifyClassroomCookieValue
} from '$lib/server/classroom-cookie';
import {
	isValidClassroomDisplayName,
	sanitizeClassroomDisplayName,
	uniqueClassroomDisplayName
} from '$lib/server/classroom-utils';
import { isClassroomJoinRateLimited } from '$lib/server/classroom-rate-limit';
import { getPostHogClient } from '$lib/server/posthog';

async function getOpenClassroom(code: string) {
	return db.query.classrooms.findFirst({
		where: and(eq(classrooms.code, code), isNull(classrooms.endedAt)),
		columns: {
			id: true,
			code: true,
			name: true,
			maxSeats: true,
			activeSessionId: true
		}
	});
}

export const load: PageServerLoad = async ({ cookies, params }) => {
	const code = params.code.toUpperCase();
	const classroom = await getOpenClassroom(code);
	if (!classroom) {
		return { code, classroom: null, isJoined: false };
	}

	const payload = verifyClassroomCookieValue(cookies.get(CLASSROOM_COOKIE_NAME));
	const isJoined = payload?.classroomId === classroom.id;
	if (isJoined) {
		const participant = await db.query.classroomParticipants.findFirst({
			where: and(
				eq(classroomParticipants.id, payload.participantId),
				eq(classroomParticipants.classroomId, classroom.id)
			),
			columns: { id: true, kickedAt: true }
		});
		if (participant) throw redirect(303, `/classroom/${code}/live`);
	}

	return {
		code,
		classroom: { name: classroom.name, code: classroom.code },
		isJoined: false
	};
};

export const actions: Actions = {
	default: async ({ cookies, getClientAddress, params, request }) => {
		const code = params.code.toUpperCase();
		if (isClassroomJoinRateLimited(`${code}:${getClientAddress()}`)) {
			return fail(429, { error: 'Too many join attempts. Please wait a minute and try again.' });
		}
		const classroom = await getOpenClassroom(code);
		if (!classroom) return fail(404, { error: 'Classroom not found or already ended.' });

		const form = await request.formData();
		const displayName = sanitizeClassroomDisplayName(String(form.get('displayName') ?? ''));
		if (!isValidClassroomDisplayName(displayName)) {
			return fail(400, { error: 'Enter a display name between 2 and 24 characters.' });
		}

		const recentCutoff = new Date(Date.now() - 60_000);
		const activeCount = await db
			.select({ value: count() })
			.from(classroomParticipants)
			.where(
				and(
					eq(classroomParticipants.classroomId, classroom.id),
					isNull(classroomParticipants.kickedAt),
					gt(classroomParticipants.lastSeenAt, recentCutoff)
				)
			);
		if ((activeCount[0]?.value ?? 0) >= classroom.maxSeats) {
			return fail(403, { error: 'This classroom is full. Ask the instructor to free a seat.' });
		}

		const participantId = crypto.randomUUID();
		const uniqueDisplayName = await uniqueClassroomDisplayName(classroom.id, displayName);
		await db.insert(classroomParticipants).values({
			id: participantId,
			classroomId: classroom.id,
			displayName: uniqueDisplayName,
			lastSeenAt: new Date()
		});

		getPostHogClient().capture({
			distinctId: participantId,
			event: 'classroom_joined',
			properties: { classroomId: classroom.id }
		});

		cookies.set(
			CLASSROOM_COOKIE_NAME,
			createClassroomCookieValue({
				classroomId: classroom.id,
				participantId,
				displayName: uniqueDisplayName
			}),
			{
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				secure: process.env.NODE_ENV === 'production',
				maxAge: classroomCookieMaxAge()
			}
		);

		throw redirect(303, `/classroom/${code}/live`);
	}
};
