import { fail, redirect } from '@sveltejs/kit';
import { auth } from '$lib/auth.js';
import type { Actions, PageServerLoad } from './$types';
import { safeAppPath } from '$lib/server/safe-path';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.user) throw redirect(303, safeAppPath(url.searchParams.get('next')));
};

export const actions: Actions = {
	default: async ({ request, url }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const email = String(form.get('email') ?? '').trim().toLowerCase();
		const password = String(form.get('password') ?? '');
		const confirmPassword = String(form.get('confirmPassword') ?? '');
		const next = safeAppPath(String(form.get('next') ?? url.searchParams.get('next') ?? ''));

		const fieldErrors: Record<string, string[]> = {};
		if (!name) fieldErrors.name = ['Name is required'];
		if (!email || !email.includes('@')) fieldErrors.email = ['Valid email is required'];
		if (!password) fieldErrors.password = ['Password is required'];
		else if (password.length < 8) fieldErrors.password = ['Must be at least 8 characters'];
		if (password !== confirmPassword) fieldErrors.confirmPassword = ['Passwords do not match'];

		if (Object.keys(fieldErrors).length > 0) {
			return fail(400, { fieldErrors, name, email, next });
		}

		try {
			await auth.api.signUpEmail({ body: { name, email, password } });
		} catch (e) {
			const message = (e as Error).message || 'Failed to create account.';
			if (message.toLowerCase().includes('already exists') || message.toLowerCase().includes('duplicate')) {
				return fail(400, {
					fieldErrors: { email: ['An account with this email already exists.'] },
					name,
					email,
					next
				});
			}
			return fail(400, { formError: message, name, email, next });
		}

		throw redirect(303, next);
	}
};
