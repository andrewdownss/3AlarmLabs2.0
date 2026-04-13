// animation pack
// type for the animation pack object
export interface AnimationPack {
	id: string;
	name: string;
	category: 'fire' | 'smoke';
	frameCount: number;
	frameWidth: number;
	frameHeight: number;
	columns: number;
	rows: number;
	fps: number;
	spritesheetPath: string;
	previewPath: string;
}

// frame crop
// type for the frame crop object
export interface FrameCrop {
	x: number;
	y: number;
	width: number;
	height: number;
}
