import { ArrayBufferTarget, Muxer } from 'mp4-muxer';

export interface ExportData {
	canvas: HTMLCanvasElement;
	region: { x: number; y: number; width: number; height: number };
}

export interface SceneExportOptions {
	getExportData: () => ExportData | null;
	duration: number;
	outputWidth: number;
	outputHeight: number;
	onProgress?: (progress: number) => void;
}

export interface SceneExportResult {
	blob: Blob;
	extension: string;
	url: string;
}

export interface AspectRatio {
	label: string;
	value: string;
	width: number;
	height: number;
}

export interface Duration {
	label: string;
	value: number;
}

export const ASPECT_RATIOS: AspectRatio[] = [
	{ label: '1:1', value: '1:1', width: 1080, height: 1080 },
	{ label: '4:5', value: '4:5', width: 1080, height: 1350 },
	{ label: '9:16', value: '9:16', width: 1080, height: 1920 }
];

export const DURATIONS: Duration[] = [
	{ label: '3s', value: 3 },
	{ label: '5s', value: 5 },
	{ label: '10s', value: 10 }
];

const EXPORT_FRAME_RATE = 30;
const EXPORT_BITRATE = 8_000_000;
const MP4_CODEC_CANDIDATES = ['avc1.640028', 'avc1.4d4028', 'avc1.42001f'];

export function isExportSupported(): boolean {
	return (
		typeof VideoEncoder !== 'undefined' &&
		typeof VideoFrame !== 'undefined' &&
		typeof HTMLCanvasElement !== 'undefined'
	);
}

async function getSupportedEncoderConfig(width: number, height: number): Promise<VideoEncoderConfig> {
	for (const codec of MP4_CODEC_CANDIDATES) {
		const config: VideoEncoderConfig = {
			codec,
			width,
			height,
			bitrate: EXPORT_BITRATE,
			framerate: EXPORT_FRAME_RATE
		};
		const support = await VideoEncoder.isConfigSupported(config);
		if (support.supported) return config;
	}

	throw new Error('MP4 export is not supported in this browser');
}

function drawFrameToCanvas(
	ctx: CanvasRenderingContext2D,
	outputWidth: number,
	outputHeight: number,
	data: ExportData | null
) {
	ctx.fillStyle = '#000';
	ctx.fillRect(0, 0, outputWidth, outputHeight);

	if (!data) return;

	const { canvas: src, region } = data;
	const scaleX = outputWidth / region.width;
	const scaleY = outputHeight / region.height;
	const scale = Math.min(scaleX, scaleY);
	const dw = region.width * scale;
	const dh = region.height * scale;
	const dx = (outputWidth - dw) / 2;
	const dy = (outputHeight - dh) / 2;

	ctx.drawImage(src, region.x, region.y, region.width, region.height, dx, dy, dw, dh);
}

export async function recordScene(options: SceneExportOptions): Promise<SceneExportResult> {
	const { getExportData, duration, outputWidth, outputHeight, onProgress } = options;

	if (!isExportSupported()) {
		throw new Error('MP4 export is not supported in this browser');
	}

	const recordCanvas = document.createElement('canvas');
	recordCanvas.width = outputWidth;
	recordCanvas.height = outputHeight;
	const context = recordCanvas.getContext('2d');
	if (!context) {
		throw new Error('Could not create export canvas');
	}
	const ctx: CanvasRenderingContext2D = context;

	const encoderConfig = await getSupportedEncoderConfig(outputWidth, outputHeight);
	const target = new ArrayBufferTarget();
	const muxer = new Muxer({
		target,
		video: {
			codec: 'avc',
			width: outputWidth,
			height: outputHeight,
			frameRate: EXPORT_FRAME_RATE
		},
		fastStart: 'in-memory'
	});

	let encoderError: Error | null = null;
	const encoder = new VideoEncoder({
		output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
		error: (error) => {
			encoderError = error instanceof Error ? error : new Error(String(error));
		}
	});

	encoder.configure(encoderConfig);

	const totalFrames = Math.max(1, Math.round(duration * EXPORT_FRAME_RATE));
	const frameDurationUs = Math.round(1_000_000 / EXPORT_FRAME_RATE);

	return new Promise<SceneExportResult>((resolve, reject) => {
		let isSettled = false;
		let frameIndex = 0;
		const startTime = performance.now();

		function rejectOnce(error: unknown) {
			if (isSettled) return;
			isSettled = true;
			try {
				if (encoder.state !== 'closed') encoder.close();
			} catch {
				// Ignore close errors during rejection
			}
			reject(error);
		}

		function resolveOnce(result: SceneExportResult) {
			if (isSettled) return;
			isSettled = true;
			resolve(result);
		}

		async function finalizeExport() {
			try {
				if (encoderError) {
					rejectOnce(encoderError);
					return;
				}
				await encoder.flush();
				muxer.finalize();
				if (encoder.state !== 'closed') encoder.close();

				const blob = new Blob([target.buffer], { type: 'video/mp4' });
				const url = URL.createObjectURL(blob);
				onProgress?.(1);
				resolveOnce({ blob, extension: 'mp4', url });
			} catch (error) {
				rejectOnce(error);
			}
		}

		function renderLoop(now: number) {
			try {
				if (encoderError) {
					rejectOnce(encoderError);
					return;
				}

				const elapsed = now - startTime;
				const expectedFrameIndex = Math.min(
					totalFrames,
					Math.floor((elapsed / 1000) * EXPORT_FRAME_RATE) + 1
				);

				while (frameIndex < expectedFrameIndex && frameIndex < totalFrames) {
					drawFrameToCanvas(ctx, outputWidth, outputHeight, getExportData());

					const frame = new VideoFrame(recordCanvas, {
						timestamp: frameIndex * frameDurationUs,
						duration: frameDurationUs
					});
					encoder.encode(frame, { keyFrame: frameIndex % EXPORT_FRAME_RATE === 0 });
					frame.close();

					frameIndex += 1;
					onProgress?.(frameIndex / totalFrames);
				}

				if (frameIndex >= totalFrames) {
					void finalizeExport();
					return;
				}

				requestAnimationFrame(renderLoop);
			} catch (error) {
				rejectOnce(error);
			}
		}

		requestAnimationFrame(renderLoop);
	});
}
