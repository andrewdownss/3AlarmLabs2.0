import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { classrooms } from '$lib/server/db/schema';

function normalizeCode(raw: string): string {
	return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
}

export const load: PageServerLoad = async ({ url }) => {
	const prefilledCode = normalizeCode(url.searchParams.get('code') ?? '');
	return { prefilledCode: prefilledCode.length === 5 ? prefilledCode : '' };
};

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await request.formData();
		const code = normalizeCode(String(form.get('code') ?? ''));

		if (code.length !== 5) {
			return fail(400, { error: 'Please enter a valid 5-character classroom code.' });
		}

		const classroom = await db.query.classrooms.findFirst({
			where: and(eq(classrooms.code, code), isNull(classrooms.endedAt)),
			columns: { id: true }
		});

		if (!classroom) {
			return fail(404, { error: 'Classroom not found or no longer active.' });
		}

		throw redirect(303, `/classroom/${code}`);
	}
};
