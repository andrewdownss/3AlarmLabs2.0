const TTL_MS = 30_000;
const MAX_ENTRIES = 500;

interface CacheEntry<T> {
	value: T;
	expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

function prune() {
	if (store.size <= MAX_ENTRIES) return;
	const now = Date.now();
	for (const [key, entry] of store) {
		if (now > entry.expiresAt) store.delete(key);
	}
}

export function get<T>(key: string): T | undefined {
	const entry = store.get(key) as CacheEntry<T> | undefined;
	if (!entry) return undefined;
	if (Date.now() > entry.expiresAt) {
		store.delete(key);
		return undefined;
	}
	return entry.value;
}

export function set<T>(key: string, value: T, ttlMs = TTL_MS): void {
	store.set(key, { value, expiresAt: Date.now() + ttlMs });
	prune();
}

export function invalidate(key: string): void {
	store.delete(key);
}

export function invalidateLayoutCache(userId: string): void {
	store.delete(`app:layout:${userId}`);
}

const USER_ROW_TTL_MS = 10_000;

function userRowCacheKey(userId: string) {
	return `user:row:${userId}`;
}

export function getCachedUserRow<T>(userId: string): T | undefined {
	return get<T>(userRowCacheKey(userId));
}

export function setCachedUserRow<T>(userId: string, value: T): void {
	set(userRowCacheKey(userId), value, USER_ROW_TTL_MS);
}

export function invalidateUserCache(userId: string): void {
	invalidate(userRowCacheKey(userId));
}
