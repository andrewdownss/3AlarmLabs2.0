export interface ImageSizePx {
	width: number;
	height: number;
}

export type OverlayKind = 'fire' | 'smoke';

export interface AnimationOverlay {
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
	flipY: boolean;
	playbackSpeed: number;
}
