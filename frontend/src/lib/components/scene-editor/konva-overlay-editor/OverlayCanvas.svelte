<script lang="ts">
	import { createEventDispatcher, onDestroy, onMount } from 'svelte';
	import type KonvaType from 'konva';
	import type { ImageSizePx, AnimationOverlay } from './overlay-types';
	import { clampOverlayToImage } from './overlay-utils';
	import { getAnimationPack, getFrameCrop } from '$lib/animations/registry';
	import { getCachedSpritesheet, preloadSpritesheetPacks } from './spritesheet-cache';

	export let baseImageUrl: string;
	export let overlays: AnimationOverlay[] = [];
	export let selectedOverlayId: string | null = null;
	export let isInteractive = true;

	const dispatch = createEventDispatcher<{
		overlaysChange: { overlays: AnimationOverlay[] };
		selectedChange: { selectedOverlayId: string | null };
		imageSize: { imageSize: ImageSizePx };
	}>();

	let containerEl: HTMLDivElement | null = null;

	let Konva: typeof KonvaType | null = null;
	let stage: KonvaType.Stage | null = null;
	let rootLayer: KonvaType.Layer | null = null;
	let rootGroup: KonvaType.Group | null = null;
	let transformer: KonvaType.Transformer | null = null;
	let baseImageNode: KonvaType.Image | null = null;

	let imageSize: ImageSizePx | null = null;
	let resizeObserver: ResizeObserver | null = null;
	let containerSize = { width: 0, height: 0 };
	let interactingOverlayId: string | null = null;
	let lastLoadedBaseImageUrl: string | null = null;
	let baseImageLoadVersion = 0;
	let overlaySyncVersion = 0;
	let isTouchDevice = false;

	const nodeById = new Map<string, KonvaType.Shape>();
	const animatableNodeIds = new Set<string>();

	interface FrameState {
		frameIndex: number;
		lastFrameTime: number;
	}
	const frameStates = new Map<string, FrameState>();
	let animFrameId: number | null = null;
	let isLoading = true;

	function emitSelected(selected: string | null) {
		dispatch('selectedChange', { selectedOverlayId: selected });
	}

	function emitOverlays(next: AnimationOverlay[]) {
		dispatch('overlaysChange', { overlays: next });
	}

	function getOverlayById(id: string) {
		return overlays.find((o) => o.id === id) ?? null;
	}

	function updateOverlay(id: string, partial: Partial<AnimationOverlay>) {
		if (!imageSize) return;
		const current = getOverlayById(id);
		if (!current) return;

		const nextOverlay = clampOverlayToImage({ ...current, ...partial }, imageSize);
		const next = overlays.map((o) => (o.id === id ? nextOverlay : o));
		emitOverlays(next);
	}

	function updateTransformer() {
		if (!transformer) return;

		const node = selectedOverlayId ? nodeById.get(selectedOverlayId) : undefined;
		if (!node) {
			transformer.nodes([]);
			transformer.getLayer()?.batchDraw();
			return;
		}

		transformer.nodes([node]);
		transformer.getLayer()?.batchDraw();
	}

	function fitStageToContainer() {
		if (!stage || !rootGroup || !imageSize) return;
		if (containerSize.width <= 0 || containerSize.height <= 0) return;

		const scaleX = containerSize.width / imageSize.width;
		const scaleY = containerSize.height / imageSize.height;
		const scale = Math.max(0.01, Math.min(scaleX, scaleY));

		const scaledW = imageSize.width * scale;
		const scaledH = imageSize.height * scale;
		const offsetXPx = Math.max(0, (containerSize.width - scaledW) / 2);
		const offsetYPx = Math.max(0, (containerSize.height - scaledH) / 2);

		stage.width(containerSize.width);
		stage.height(containerSize.height);
		stage.scale({ x: scale, y: scale });
		rootGroup.position({ x: offsetXPx / scale, y: offsetYPx / scale });

		stage.batchDraw();
	}

	function ensureStage() {
		if (!Konva || !containerEl || stage) return;

		stage = new Konva.Stage({
			container: containerEl,
			width: containerSize.width || 1,
			height: containerSize.height || 1
		});

		rootLayer = new Konva.Layer();
		rootGroup = new Konva.Group();
		transformer = new Konva.Transformer({
			rotateEnabled: true,
			flipEnabled: false,
			enabledAnchors: [
				'top-left',
				'top-center',
				'top-right',
				'middle-left',
				'middle-right',
				'bottom-left',
				'bottom-center',
				'bottom-right'
			],
			ignoreStroke: true,
			anchorStroke: 'rgba(99, 102, 241, 0.95)',
			anchorFill: 'rgba(255, 255, 255, 0.95)',
			borderStroke: 'rgba(99, 102, 241, 0.95)',
			anchorSize: isTouchDevice ? 28 : 16,
			borderStrokeWidth: isTouchDevice ? 3 : 2,
			borderDash: [6, 5]
		});

		rootLayer.add(rootGroup);
		rootGroup.add(transformer);
		stage.add(rootLayer);

		stage.on('pointerdown', (evt) => {
			if (!isInteractive) return;
			if (!baseImageNode) return;
			const isEmpty = evt.target === stage || evt.target === baseImageNode;
			if (isEmpty) emitSelected(null);
		});

		stage.on('pointerup pointercancel', () => {
			interactingOverlayId = null;
		});
	}

	function applyOverlayToNode(node: KonvaType.Shape, overlay: AnimationOverlay) {
		node.position({
			x: overlay.x,
			y: overlay.flipY ? overlay.y + overlay.height : overlay.y
		});
		node.size({ width: overlay.width, height: overlay.height });
		node.rotation(overlay.rotation);
		node.opacity(overlay.opacity);
		node.scale({ x: 1, y: overlay.flipY ? -1 : 1 });
		node.offsetX(0);
		node.offsetY(0);
	}

	function getOverlayNodeY(node: KonvaType.Shape, overlay: AnimationOverlay, height = node.height()) {
		return overlay.flipY ? node.y() - height : node.y();
	}

	async function loadRequiredSpritesheets(overlayList: AnimationOverlay[]): Promise<void> {
		const neededPackIds = [...new Set(overlayList.map((overlay) => overlay.packId))];
		await preloadSpritesheetPacks(neededPackIds);
	}

	async function loadBaseImage(url: string) {
		if (!Konva || !rootGroup) return;
		const currentLoadVersion = ++baseImageLoadVersion;

		const img = new Image();
		img.crossOrigin = 'anonymous';
		img.decoding = 'async';

		const loaded: HTMLImageElement = await new Promise((resolve, reject) => {
			img.onload = () => resolve(img);
			img.onerror = () => reject(new Error('Failed to load base image'));
			img.src = url;
		});

		if (currentLoadVersion !== baseImageLoadVersion || !Konva || !rootGroup) return;

		const nextImageSize = {
			width: loaded.naturalWidth || loaded.width,
			height: loaded.naturalHeight || loaded.height
		};

		imageSize = nextImageSize;
		dispatch('imageSize', { imageSize: nextImageSize });

		baseImageNode?.destroy();
		baseImageNode = new Konva.Image({
			image: loaded,
			x: 0,
			y: 0,
			width: nextImageSize.width,
			height: nextImageSize.height,
			listening: true
		});

		rootGroup.add(baseImageNode);
		baseImageNode.moveToBottom();
		lastLoadedBaseImageUrl = url;

		fitStageToContainer();
		rootLayer?.batchDraw();
	}

	function attachNodeEvents(node: KonvaType.Shape, overlayId: string) {
		node.on('click tap', () => {
			if (!isInteractive) return;
			emitSelected(overlayId);
		});

		node.on('dragstart', () => {
			if (!isInteractive) return;
			interactingOverlayId = overlayId;
			emitSelected(overlayId);
		});

		node.on('dragend', () => {
			if (!isInteractive) return;
			const overlay = getOverlayById(overlayId);
			if (!overlay) return;
			interactingOverlayId = null;
			updateOverlay(overlayId, {
				x: node.x(),
				y: getOverlayNodeY(node, overlay)
			});
		});

		node.on('transformstart', () => {
			if (!isInteractive) return;
			interactingOverlayId = overlayId;
			emitSelected(overlayId);
		});

		node.on('transformend', () => {
			if (!isInteractive) return;
			if (!imageSize) return;
			const overlay = getOverlayById(overlayId);
			if (!overlay) return;

			interactingOverlayId = null;
			const scaleX = Math.abs(node.scaleX());
			const scaleY = Math.abs(node.scaleY());

			const nextWidth = Math.max(2, node.width() * scaleX);
			const nextHeight = Math.max(2, node.height() * scaleY);

			node.scale({ x: 1, y: overlay.flipY ? -1 : 1 });
			node.offsetX(0);
			node.width(nextWidth);
			node.height(nextHeight);

			updateOverlay(overlayId, {
				x: node.x(),
				y: getOverlayNodeY(node, overlay, nextHeight),
				width: nextWidth,
				height: nextHeight,
				rotation: node.rotation()
			});
		});

		node.dragBoundFunc((pos) => {
			if (!imageSize || !rootGroup || !stage) return pos;
			const overlay = getOverlayById(overlayId);
			if (!overlay) return pos;
			const s = stage.scaleX();
			const gp = rootGroup.position();
			const width = node.width();
			const height = node.height();

			const localX = pos.x / s - gp.x;
			const localY = pos.y / s - gp.y;

			const minY = overlay.flipY ? height : 0;
			const maxY = overlay.flipY ? imageSize.height : imageSize.height - height;
			const clampedX = Math.max(0, Math.min(localX, imageSize.width - width));
			const clampedY = Math.max(minY, Math.min(localY, maxY));

			return {
				x: (clampedX + gp.x) * s,
				y: (clampedY + gp.y) * s
			};
		});
	}

	function getOrCreateNode(overlay: AnimationOverlay): KonvaType.Shape | null {
		if (!Konva || !rootGroup || !imageSize) return null;

		const existing = nodeById.get(overlay.id);
		if (existing) return existing;

		const pack = getAnimationPack(overlay.packId);
		const spritesheetImg = pack ? getCachedSpritesheet(pack.id) : null;

		let node: KonvaType.Shape;

		if (spritesheetImg && pack) {
			const crop = getFrameCrop(pack, 0);
			const imgNode = new Konva.Image({
				id: overlay.id,
				name: 'overlaySprite',
				image: spritesheetImg,
				x: overlay.x,
				y: overlay.y,
				width: overlay.width,
				height: overlay.height,
				crop: crop,
				rotation: overlay.rotation,
				opacity: overlay.opacity,
				draggable: Boolean(isInteractive)
			});
			node = imgNode;
			animatableNodeIds.add(overlay.id);
			frameStates.set(overlay.id, { frameIndex: 0, lastFrameTime: 0 });
		} else {
			const fill = overlay.kind === 'fire' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(148, 163, 184, 0.4)';
			const stroke = overlay.kind === 'fire' ? '#ef4444' : '#94a3b8';
			node = new Konva.Rect({
				id: overlay.id,
				name: 'overlayFallback',
				x: overlay.x,
				y: overlay.y,
				width: overlay.width,
				height: overlay.height,
				rotation: overlay.rotation,
				opacity: overlay.opacity,
				fill,
				stroke,
				strokeWidth: 4,
				strokeScaleEnabled: false,
				dash: overlay.kind === 'smoke' ? [10, 7] : [],
				draggable: Boolean(isInteractive)
			});
		}

		attachNodeEvents(node, overlay.id);
		rootGroup.add(node);
		nodeById.set(overlay.id, node);
		applyOverlayToNode(node, overlay);
		return node;
	}

	function syncOverlayNodes() {
		if (!Konva || !rootGroup || !imageSize) return;

		const overlayIds = new Set(overlays.map((o) => o.id));
		if (interactingOverlayId && !overlayIds.has(interactingOverlayId)) interactingOverlayId = null;

		for (const [id, node] of nodeById) {
			if (overlayIds.has(id)) continue;
			node.destroy();
			nodeById.delete(id);
			animatableNodeIds.delete(id);
			frameStates.delete(id);
		}

		for (const overlay of overlays) {
			const node = getOrCreateNode(overlay);
			if (!node) continue;

			node.draggable(Boolean(isInteractive));

			if (interactingOverlayId === overlay.id) continue;

			applyOverlayToNode(node, overlay);
		}

		baseImageNode?.moveToBottom();
		for (const overlay of overlays) {
			nodeById.get(overlay.id)?.moveToTop();
		}

		updateTransformer();
		transformer?.moveToTop();
		rootLayer?.batchDraw();
	}

	async function syncOverlaysWithLoading() {
		if (!Konva || !rootGroup || !imageSize) return;
		const currentSyncVersion = ++overlaySyncVersion;

		syncOverlayNodes();

		const missingPackIds = [
			...new Set(overlays.map((overlay) => overlay.packId).filter((id) => !getCachedSpritesheet(id)))
		];

		if (missingPackIds.length > 0) {
			await preloadSpritesheetPacks(missingPackIds);
			if (currentSyncVersion !== overlaySyncVersion || !stage) return;

			for (const overlay of overlays) {
				const node = nodeById.get(overlay.id);
				if (node && node.name() === 'overlayFallback' && getCachedSpritesheet(overlay.packId)) {
					node.destroy();
					nodeById.delete(overlay.id);
				}
			}

			syncOverlayNodes();
		}
	}

	function animateFrame(timestamp: number) {
		let needsDraw = false;

		for (const overlay of overlays) {
			if (!animatableNodeIds.has(overlay.id)) continue;

			const pack = getAnimationPack(overlay.packId);
			if (!pack) continue;

			const node = nodeById.get(overlay.id);
			if (!node) continue;

			let state = frameStates.get(overlay.id);
			if (!state) {
				state = { frameIndex: 0, lastFrameTime: timestamp };
				frameStates.set(overlay.id, state);
			}

			const fps = pack.fps * overlay.playbackSpeed;
			const frameDuration = 1000 / fps;

			if (timestamp - state.lastFrameTime >= frameDuration) {
				state.frameIndex = (state.frameIndex + 1) % pack.frameCount;
				state.lastFrameTime = timestamp;

				const crop = getFrameCrop(pack, state.frameIndex);
				(node as KonvaType.Image).crop(crop);
				needsDraw = true;
			}
		}

		if (needsDraw) rootLayer?.batchDraw();
		animFrameId = requestAnimationFrame(animateFrame);
	}

	function startAnimation() {
		if (animFrameId !== null) return;
		animFrameId = requestAnimationFrame(animateFrame);
	}

	function stopAnimation() {
		if (animFrameId !== null) {
			cancelAnimationFrame(animFrameId);
			animFrameId = null;
		}
	}

	onMount(async () => {
		if (typeof window === 'undefined') return;
		isTouchDevice =
			window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
		const mod = await import('konva');
		Konva = (mod as any).default ?? (mod as any);

		if (!containerEl) return;

		resizeObserver = new ResizeObserver((entries) => {
			const entry = entries[0];
			const box = entry?.contentRect;
			if (!box) return;

			containerSize = { width: box.width, height: box.height };
			fitStageToContainer();
		});
		resizeObserver.observe(containerEl);

		const rect = containerEl.getBoundingClientRect();
		containerSize = { width: rect.width, height: rect.height };

		ensureStage();
		await loadRequiredSpritesheets(overlays);
		await loadBaseImage(baseImageUrl);
		syncOverlayNodes();
		startAnimation();
		isLoading = false;
	});

	onDestroy(() => {
		baseImageLoadVersion += 1;
		overlaySyncVersion += 1;
		stopAnimation();
		resizeObserver?.disconnect();
		resizeObserver = null;

		stage?.destroy();
		stage = null;
		nodeById.clear();
		animatableNodeIds.clear();
		frameStates.clear();
	});

	$: if (stage && Konva && baseImageUrl && baseImageUrl !== lastLoadedBaseImageUrl) {
		void loadBaseImage(baseImageUrl).catch(() => {});
	}

	$: if (stage && Konva) {
		overlays;
		selectedOverlayId;
		isInteractive;
		void syncOverlaysWithLoading();
	}

	export function getExportData(): {
		canvas: HTMLCanvasElement;
		region: { x: number; y: number; width: number; height: number };
	} | null {
		if (!stage || !rootGroup || !imageSize || !containerEl) return null;

		const canvasEl = containerEl.querySelector('canvas') as HTMLCanvasElement | null;
		if (!canvasEl) return null;

		const scale = stage.scaleX();
		const gp = rootGroup.position();

		const cssWidth = containerEl.clientWidth || stage.width();
		const canvasPixelWidth = canvasEl.width;
		const dpr = cssWidth > 0 ? canvasPixelWidth / cssWidth : 1;

		return {
			canvas: canvasEl,
			region: {
				x: gp.x * scale * dpr,
				y: gp.y * scale * dpr,
				width: imageSize.width * scale * dpr,
				height: imageSize.height * scale * dpr
			}
		};
	}
</script>

<div class="relative h-full w-full">
	<div bind:this={containerEl} class="h-full w-full"></div>

	{#if isLoading}
		<div
			class="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-sm"
		>
			<div class="flex flex-col items-center gap-3">
				<div
					class="h-8 w-8 animate-spin rounded-full border-4 border-muted-foreground/30 border-t-primary"
				></div>
				<span class="text-sm font-medium text-muted-foreground">Loading scene…</span>
			</div>
		</div>
	{/if}
</div>
