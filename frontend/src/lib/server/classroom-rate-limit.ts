const attempts = new Map<string, { count: number; resetAt: number }>();

export function isClassroomJoinRateLimited(key: string, now = Date.now()): boolean {
	const windowMs = 60_000;
	const maxAttempts = 10;
	const current = attempts.get(key);
	if (!current || current.resetAt <= now) {
		attempts.set(key, { count: 1, resetAt: now + windowMs });
		return false;
	}
	current.count += 1;
	return current.count > maxAttempts;
}
