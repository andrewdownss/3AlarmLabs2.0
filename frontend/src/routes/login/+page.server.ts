import { fail, redirect } from '@sveltejs/kit';
import { auth } from '$lib/auth.js';
import type { PageServerLoad } from './$types';
import { safeAppPath } from '$lib/server/safe-path';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.user) {
		throw redirect(303, safeAppPath(url.searchParams.get('next')));
	}
};

export const actions = {
	default: async ({ request, url }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '');
		const password = String(form.get('password') ?? '');
		const next = safeAppPath(String(form.get('next') ?? url.searchParams.get('next') ?? ''));

		if (!email || !password) {
			return fail(400, {
				fieldErrors: {
					email: email ? undefined : ['Email is required'],
					password: password ? undefined : ['Password is required']
				},
				next
			});
		}

		try {
			await auth.api.signInEmail({ body: { email, password, rememberMe: true } });
		} catch (e) {
			return fail(400, {
				formError: (e as Error).message || 'Invalid credentials',
				fieldErrors: { email: ['Check your email/password'], password: ['Check your email/password'] },
				next
			});
		}

		throw redirect(303, next);
	}
};
