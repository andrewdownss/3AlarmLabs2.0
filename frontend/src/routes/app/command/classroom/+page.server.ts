import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { classrooms, organizationMembers, organizations } from '$lib/server/db/schema';
import { generateJoinCode } from '$lib/server/join-code';
import { canHostClassroom, getPlanConfig, normalizePlanId } from '$lib/plans';
import { getPostHogClient } from '$lib/server/posthog';

async function generateUniqueClassroomCode(): Promise<string | null> {
	for (let attempt = 0; attempt < 8; attempt += 1) {
		const code = generateJoinCode();
		const existing = await db.query.classrooms.findFirst({
			where: eq(classrooms.code, code),
			columns: { id: true }
		});
		if (!existing) return code;
	}
	return null;
}

export const load: PageServerLoad = async ({ locals, parent }) => {
	if (!locals.user) throw redirect(303, '/login');
	const { planConfig } = await parent();
	const membership = await db.query.organizationMembers.findFirst({
		where: eq(organizationMembers.userId, locals.user.id),
		columns: { organizationId: true }
	});
	const organizationId = membership?.organizationId ?? null;

	const rows = organizationId
		? await db.query.classrooms.findMany({
				where: and(
					eq(classrooms.organizationId, organizationId),
					eq(classrooms.instructorId, locals.user.id),
					isNull(classrooms.endedAt)
				),
				orderBy: [desc(classrooms.createdAt)]
			})
		: [];

	return {
		classrooms: rows,
		canHostClassroom: canHostClassroom(planConfig),
		maxClassroomSeats: planConfig.maxClassroomSeats,
		planName: planConfig.name
	};
};

export const actions: Actions = {
	create: async ({ locals, request }) => {
		if (!locals.user) throw redirect(303, '/login');

		const membership = await db.query.organizationMembers.findFirst({
			where: eq(organizationMembers.userId, locals.user.id),
			columns: { organizationId: true }
		});
		if (!membership) return fail(400, { error: 'Classrooms require an organization.' });

		const org = await db.query.organizations.findFirst({
			where: eq(organizations.id, membership.organizationId),
			columns: { planId: true }
		});
		const planConfig = getPlanConfig(normalizePlanId(org?.planId));
		if (!canHostClassroom(planConfig)) {
			return fail(403, { error: `${planConfig.name} does not include classroom mode.` });
		}

		const form = await request.formData();
		const name = String(form.get('name') ?? 'Training Classroom').trim().slice(0, 80);
		if (name.length < 2) return fail(400, { error: 'Enter a classroom name.' });

		const code = await generateUniqueClassroomCode();
		if (!code) return fail(500, { error: 'Could not generate a classroom code. Try again.' });

		const id = crypto.randomUUID();
		await db.insert(classrooms).values({
			id,
			organizationId: membership.organizationId,
			instructorId: locals.user.id,
			name,
			code,
			maxSeats: planConfig.maxClassroomSeats
		});

		getPostHogClient().capture({
			distinctId: locals.user.id,
			event: 'classroom_created',
			properties: { classroomId: id, maxSeats: planConfig.maxClassroomSeats }
		});

		throw redirect(303, `/app/command/classroom/${id}`);
	}
};
