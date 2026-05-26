const attempts = new Map();
export function isDemoRadioRateLimited(key, maxAttempts, now = Date.now()) {
    const windowMs = 60_000;
    const current = attempts.get(key);
    if (!current || current.resetAt <= now) {
        attempts.set(key, { count: 1, resetAt: now + windowMs });
        return false;
    }
    current.count += 1;
    return current.count > maxAttempts;
}
//# sourceMappingURL=demo-rate-limit.js.map