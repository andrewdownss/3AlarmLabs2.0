export function safeAppPath(next: string | null | undefined, fallback = '/app/sizeup'): string {
	if (!next) return fallback;
	const trimmed = next.trim();
	if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return fallback;
	return trimmed;
}
