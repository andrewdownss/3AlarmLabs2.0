const attempts = new Map<string, { count: number; resetAt: number }>();

export function isDemoRadioRateLimited(key: string, maxAttempts: number, now = Date.now()): boolean {
	const windowMs = 60_000;
	const current = attempts.get(key);
	if (!current || current.resetAt <= now) {
		attempts.set(key, { count: 1, resetAt: now + windowMs });
		return false;
	}
	current.count += 1;
	return current.count > maxAttempts;
}
