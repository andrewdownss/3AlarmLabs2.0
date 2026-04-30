export function clampSeconds(value: number, maxSeconds: number): number {
	if (!Number.isFinite(value)) return 0;
	return Math.max(0, Math.min(Math.max(0, maxSeconds), Math.round(value)));
}

export function snapSeconds(value: number, stepSeconds = 5): number {
	if (stepSeconds <= 0) return Math.round(value);
	return Math.round(value / stepSeconds) * stepSeconds;
}

export function formatTimelineTime(totalSeconds: number): string {
	const seconds = Math.max(0, Math.floor(totalSeconds));
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = seconds % 60;
	return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

export function secondsToPercent(seconds: number, maxSeconds: number): number {
	if (maxSeconds <= 0) return 0;
	return Math.max(0, Math.min(100, (seconds / maxSeconds) * 100));
}

export function percentToSeconds(percent: number, maxSeconds: number): number {
	return clampSeconds((percent / 100) * maxSeconds, maxSeconds);
}
