import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { organizations } from '$lib/server/db/schema';

const JOIN_CODE_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateJoinCode(length = 5): string {
	let code = '';
	for (let i = 0; i < length; i += 1) {
		code += JOIN_CODE_CHARSET[Math.floor(Math.random() * JOIN_CODE_CHARSET.length)];
	}
	return code;
}

export async function allocateUniqueOrganizationJoinCode(maxAttempts = 12): Promise<string> {
	for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
		const candidate = generateJoinCode();
		const taken = await db.query.organizations.findFirst({
			where: eq(organizations.joinCode, candidate),
			columns: { id: true }
		});
		if (!taken) return candidate;
	}
	throw new Error('Could not allocate a unique organization join code');
}
