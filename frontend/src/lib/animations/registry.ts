import type { AnimationPack, FrameCrop } from './types';

export const ANIMATION_PACKS: AnimationPack[] = [
	{
		id: 'blaze4',
		name: 'Blaze 4',
		category: 'fire',
		frameCount: 32,
		frameWidth: 512,
		frameHeight: 512,
		columns: 8,
		rows: 4,
		fps: 24,
		spritesheetPath: '/animations/fire/blaze4/spritesheet.png',
		previewPath: '/animations/fire/blaze4/preview.png'
	},
	{
		id: 'blaze5',
		name: 'Blaze 5',
		category: 'fire',
		frameCount: 32,
		frameWidth: 512,
		frameHeight: 512,
		columns: 8,
		rows: 4,
		fps: 24,
		spritesheetPath: '/animations/fire/blaze5/spritesheet.png',
		previewPath: '/animations/fire/blaze5/preview.png'
	},
	{
		id: 'blaze6',
		name: 'Blaze 6',
		category: 'fire',
		frameCount: 32,
		frameWidth: 512,
		frameHeight: 512,
		columns: 8,
		rows: 4,
		fps: 24,
		spritesheetPath: '/animations/fire/blaze6/spritesheet.png',
		previewPath: '/animations/fire/blaze6/preview.png'
	},
	{
		id: 'blaze7',
		name: 'Blaze 7',
		category: 'fire',
		frameCount: 32,
		frameWidth: 512,
		frameHeight: 512,
		columns: 8,
		rows: 4,
		fps: 24,
		spritesheetPath: '/animations/fire/blaze7/spritesheet.png',
		previewPath: '/animations/fire/blaze7/preview.png'
	},
	{
		id: 'blaze8',
		name: 'Blaze 8',
		category: 'fire',
		frameCount: 32,
		frameWidth: 512,
		frameHeight: 512,
		columns: 8,
		rows: 4,
		fps: 24,
		spritesheetPath: '/animations/fire/blaze8/spritesheet.png',
		previewPath: '/animations/fire/blaze8/preview.png'
	},
	{
		id: 'smoke1',
		name: 'Smoke 1',
		category: 'smoke',
		frameCount: 32,
		frameWidth: 256,
		frameHeight: 512,
		columns: 8,
		rows: 4,
		fps: 24,
		spritesheetPath: '/animations/smoke/smoke1/spritesheet.png',
		previewPath: '/animations/smoke/smoke1/preview.png'
	},
	{
		id: 'smoke2',
		name: 'Smoke 2',
		category: 'smoke',
		frameCount: 32,
		frameWidth: 256,
		frameHeight: 512,
		columns: 8,
		rows: 4,
		fps: 24,
		spritesheetPath: '/animations/smoke/smoke2/spritesheet.png',
		previewPath: '/animations/smoke/smoke2/preview.png'
	},
	{
		id: 'smoke3',
		name: 'Smoke 3',
		category: 'smoke',
		frameCount: 32,
		frameWidth: 256,
		frameHeight: 512,
		columns: 8,
		rows: 4,
		fps: 24,
		spritesheetPath: '/animations/smoke/smoke3/spritesheet.png',
		previewPath: '/animations/smoke/smoke3/preview.png'
	},
	{
		id: 'smoke4',
		name: 'Smoke 4',
		category: 'smoke',
		frameCount: 32,
		frameWidth: 256,
		frameHeight: 512,
		columns: 8,
		rows: 4,
		fps: 24,
		spritesheetPath: '/animations/smoke/smoke4/spritesheet.png',
		previewPath: '/animations/smoke/smoke4/preview.png'
	},
	{
		id: 'smoke5',
		name: 'Smoke 5',
		category: 'smoke',
		frameCount: 32,
		frameWidth: 256,
		frameHeight: 512,
		columns: 8,
		rows: 4,
		fps: 24,
		spritesheetPath: '/animations/smoke/smoke5/spritesheet.png',
		previewPath: '/animations/smoke/smoke5/preview.png'
	},
	{
		id: 'smoke6',
		name: 'Smoke 6',
		category: 'smoke',
		frameCount: 32,
		frameWidth: 256,
		frameHeight: 512,
		columns: 8,
		rows: 4,
		fps: 24,
		spritesheetPath: '/animations/smoke/smoke6/spritesheet.png',
		previewPath: '/animations/smoke/smoke6/preview.png'
	}
];

const animationPackById = new Map(ANIMATION_PACKS.map((pack) => [pack.id, pack] as const));

export function getAnimationPack(id: string): AnimationPack | undefined {
	return animationPackById.get(id);
}

export function getFrameCrop(pack: AnimationPack, frameIndex: number): FrameCrop {
	const idx = frameIndex % pack.frameCount;
	const col = idx % pack.columns;
	const row = Math.floor(idx / pack.columns);
	return {
		x: col * pack.frameWidth,
		y: row * pack.frameHeight,
		width: pack.frameWidth,
		height: pack.frameHeight
	};
}
