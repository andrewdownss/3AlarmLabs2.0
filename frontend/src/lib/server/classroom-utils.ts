import { and, eq, isNull } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { classroomParticipants } from '$lib/server/db/schema';

const DISPLAY_NAME_MAX_LENGTH = 24;

export function sanitizeClassroomDisplayName(raw: string): string {
	const cleaned = raw
		.replace(/[^\p{L}\p{N}\s.'-]/gu, '')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, DISPLAY_NAME_MAX_LENGTH);
	return cleaned;
}

export function isValidClassroomDisplayName(name: string): boolean {
	return name.length >= 2 && name.length <= DISPLAY_NAME_MAX_LENGTH;
}

export async function uniqueClassroomDisplayName(classroomId: string, desiredName: string): Promise<string> {
	const existing = await db.query.classroomParticipants.findMany({
		where: and(
			eq(classroomParticipants.classroomId, classroomId),
			isNull(classroomParticipants.kickedAt)
		),
		columns: { displayName: true }
	});
	const used = new Set(existing.map((row) => row.displayName.toLowerCase()));
	if (!used.has(desiredName.toLowerCase())) return desiredName;

	for (let suffix = 2; suffix <= 99; suffix += 1) {
		const candidate = `${desiredName.slice(0, DISPLAY_NAME_MAX_LENGTH - 3)} #${suffix}`;
		if (!used.has(candidate.toLowerCase())) return candidate;
	}

	return `${desiredName.slice(0, DISPLAY_NAME_MAX_LENGTH - 7)} ${crypto.randomUUID().slice(0, 6)}`;
}
