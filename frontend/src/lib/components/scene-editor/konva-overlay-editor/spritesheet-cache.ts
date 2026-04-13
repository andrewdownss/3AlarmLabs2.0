import { getAnimationPack } from '$lib/animations/registry';

const spritesheetImages = new Map<string, HTMLImageElement>();
const spritesheetLoads = new Map<string, Promise<HTMLImageElement | null>>();

type SpritesheetPriority = 'high' | 'low' | 'auto';

export function getCachedSpritesheet(packId: string): HTMLImageElement | null {
	return spritesheetImages.get(packId) ?? null;
}

export async function preloadSpritesheetPack(
	packId: string,
	priority: SpritesheetPriority = 'auto'
): Promise<HTMLImageElement | null> {
	if (typeof window === 'undefined') return null;
	if (spritesheetImages.has(packId)) return spritesheetImages.get(packId) ?? null;

	const inFlight = spritesheetLoads.get(packId);
	if (inFlight) return inFlight;

	const pack = getAnimationPack(packId);
	if (!pack) return null;

	const nextLoad = new Promise<HTMLImageElement | null>((resolve) => {
		const image = new Image();
		image.crossOrigin = 'anonymous';
		image.decoding = 'async';
		if ('fetchPriority' in image) {
			(image as HTMLImageElement & { fetchPriority: SpritesheetPriority }).fetchPriority = priority;
		}
		image.onload = () => {
			spritesheetImages.set(packId, image);
			resolve(image);
		};
		image.onerror = () => resolve(null);
		image.src = pack.spritesheetPath;
	});

	spritesheetLoads.set(packId, nextLoad);

	try {
		return await nextLoad;
	} finally {
		spritesheetLoads.delete(packId);
	}
}

export async function preloadSpritesheetPacks(packIds: string[]): Promise<void> {
	const uniquePackIds = [...new Set(packIds)];
	await Promise.allSettled(uniquePackIds.map((packId) => preloadSpritesheetPack(packId)));
}
