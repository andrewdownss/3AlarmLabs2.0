import type { ImageSizePx, AnimationOverlay, OverlayKind } from './overlay-types';
import { ANIMATION_PACKS } from '$lib/animations/registry';

export interface PersistedAnimationOverlay {
	id: string;
	packId: string;
	kind: OverlayKind;
	name?: string;
	x: number;
	y: number;
	width: number;
	height: number;
	rotation: number;
	opacity: number;
	playbackSpeed: number;
	flipY?: boolean;
	flipX?: boolean;
}

function clampNumber(value: number, min: number, max: number) {
	if (!Number.isFinite(value)) return min;
	if (value < min) return min;
	if (value > max) return max;
	return value;
}

export function getDefaultPackId(kind: OverlayKind): string {
	const pack = ANIMATION_PACKS.find((p) => p.category === kind);
	return pack?.id ?? ANIMATION_PACKS[0]?.id ?? '';
}

export function createAnimationOverlay(
	kind: OverlayKind,
	imageSize: ImageSizePx,
	packId?: string
): AnimationOverlay {
	const resolvedPackId = packId ?? getDefaultPackId(kind);
	const defaultWidth = clampNumber(Math.round(imageSize.width * 0.22), 80, imageSize.width);
	const defaultHeight = clampNumber(Math.round(imageSize.height * 0.22), 80, imageSize.height);

	return {
		id: crypto.randomUUID(),
		packId: resolvedPackId,
		kind,
		name: kind === 'fire' ? 'Fire' : 'Smoke',
		x: Math.round((imageSize.width - defaultWidth) / 2),
		y: Math.round((imageSize.height - defaultHeight) / 2),
		width: defaultWidth,
		height: defaultHeight,
		rotation: 0,
		opacity: kind === 'smoke' ? 0.85 : 0.95,
		flipY: false,
		playbackSpeed: 1
	};
}

export function clampOverlayToImage(
	overlay: AnimationOverlay,
	imageSize: ImageSizePx
): AnimationOverlay {
	const width = clampNumber(overlay.width, 2, imageSize.width);
	const height = clampNumber(overlay.height, 2, imageSize.height);
	const x = clampNumber(overlay.x, 0, Math.max(0, imageSize.width - width));
	const y = clampNumber(overlay.y, 0, Math.max(0, imageSize.height - height));

	return {
		...overlay,
		x,
		y,
		width,
		height,
		rotation: Number.isFinite(overlay.rotation) ? overlay.rotation : 0,
		opacity: clampNumber(overlay.opacity, 0, 1),
		playbackSpeed: clampNumber(overlay.playbackSpeed, 0.1, 3)
	};
}

export function normalizeAnimationOverlay(
	overlay: PersistedAnimationOverlay,
	imageSize?: ImageSizePx
): AnimationOverlay {
	const normalizedOverlay: AnimationOverlay = {
		id: overlay.id,
		packId: overlay.packId,
		kind: overlay.kind,
		name: overlay.name,
		x: overlay.x,
		y: overlay.y,
		width: overlay.width,
		height: overlay.height,
		rotation: overlay.rotation,
		opacity: overlay.opacity,
		flipY: overlay.flipY ?? overlay.flipX ?? false,
		playbackSpeed: overlay.playbackSpeed
	};

	return imageSize ? clampOverlayToImage(normalizedOverlay, imageSize) : normalizedOverlay;
}

export function normalizeAnimationOverlays(overlays: PersistedAnimationOverlay[] | null | undefined) {
	return (overlays ?? []).map((overlay) => normalizeAnimationOverlay(overlay));
}
