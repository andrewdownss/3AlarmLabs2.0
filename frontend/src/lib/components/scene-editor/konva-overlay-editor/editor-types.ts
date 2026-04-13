import type { AnimationOverlay } from './overlay-types';

export interface OverlayDraftValues {
	x: string;
	y: string;
	width: string;
	height: string;
	rotation: string;
	opacity: string;
	playbackSpeed: string;
}

export type OverlayDraftField = keyof OverlayDraftValues;

export type OverlayUpdatePayload = Partial<
	Pick<
		AnimationOverlay,
		'x' | 'y' | 'width' | 'height' | 'rotation' | 'opacity' | 'playbackSpeed'
	>
>;
