import type { SimpleArrival } from './stage-mapping';

function clampNonNegInt(value: number): number {
	return Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
}

/** Fisher–Yates shuffle (in-place on a copy). */
function shuffle<T>(items: T[]): T[] {
	const out = [...items];
	for (let i = out.length - 1; i > 0; i -= 1) {
		const j = Math.floor(Math.random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

export interface ScrambleArrivalsOptions {
	/** Earliest possible offset in seconds. Default 15. */
	minSeconds?: number;
	/** Latest possible offset in seconds. Default 180 (3 min). */
	maxSeconds?: number;
	/** Minimum gap between consecutive arrivals after sorting. Default 8. */
	minGapSeconds?: number;
}

/**
 * Redistribute arrival offsets while keeping unit assignments.
 * Offsets are shuffled into a spaced sequence within the configured window.
 */
export function scrambleArrivalOffsets(
	arrivals: SimpleArrival[],
	options: ScrambleArrivalsOptions = {}
): SimpleArrival[] {
	if (arrivals.length === 0) return arrivals;

	const minSeconds = clampNonNegInt(options.minSeconds ?? 15);
	const maxSeconds = clampNonNegInt(options.maxSeconds ?? 180);
	const minGapSeconds = clampNonNegInt(options.minGapSeconds ?? 8);
	const window = Math.max(maxSeconds - minSeconds, 0);

	const slots: number[] = [];
	for (let i = 0; i < arrivals.length; i += 1) {
		const ideal = minSeconds + Math.round((window / Math.max(arrivals.length - 1, 1)) * i);
		const jitter = Math.floor(Math.random() * Math.max(minGapSeconds, 1));
		slots.push(clampNonNegInt(Math.min(maxSeconds, ideal + jitter)));
	}

	const shuffledSlots = shuffle(slots).sort((a, b) => a - b);

	for (let i = 1; i < shuffledSlots.length; i += 1) {
		if (shuffledSlots[i] - shuffledSlots[i - 1] < minGapSeconds) {
			shuffledSlots[i] = Math.min(maxSeconds, shuffledSlots[i - 1] + minGapSeconds);
		}
	}

	return arrivals.map((arrival, index) => ({
		...arrival,
		offsetSeconds: shuffledSlots[index] ?? minSeconds
	}));
}

/**
 * Reset arrivals to evenly spaced stagger from t=0.
 */
export function resetArrivalStagger(
	arrivals: SimpleArrival[],
	gapSeconds = 30
): SimpleArrival[] {
	const gap = clampNonNegInt(gapSeconds);
	return arrivals.map((arrival, index) => ({
		...arrival,
		offsetSeconds: gap * index
	}));
}
