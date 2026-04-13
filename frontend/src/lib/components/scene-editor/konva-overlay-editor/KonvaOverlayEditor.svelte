<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { Card, CardContent } from '$lib/components/ui/card';
	import type { OverlayDraftField, OverlayDraftValues, OverlayUpdatePayload } from './editor-types';
	import OverlayAssetPanel from './OverlayAssetPanel.svelte';
	import OverlayCanvas from './OverlayCanvas.svelte';
	import OverlayLayersPanel from './OverlayLayersPanel.svelte';
	import OverlayPropertiesPanel from './OverlayPropertiesPanel.svelte';
	import type { ImageSizePx, AnimationOverlay, OverlayKind } from './overlay-types';
	import { createAnimationOverlay, clampOverlayToImage } from './overlay-utils';
	import { ANIMATION_PACKS } from '$lib/animations/registry';
	import { preloadSpritesheetPack } from './spritesheet-cache';

	const firePacks = ANIMATION_PACKS.filter((pack) => pack.category === 'fire');
	const smokePacks = ANIMATION_PACKS.filter((pack) => pack.category === 'smoke');

	const emptyDraftValues: OverlayDraftValues = {
		x: '',
		y: '',
		width: '',
		height: '',
		rotation: '',
		opacity: '',
		playbackSpeed: ''
	};

	export let baseImageUrl: string;
	export let initialOverlays: AnimationOverlay[] = [];

	const dispatch = createEventDispatcher<{
		overlaysChange: { overlays: AnimationOverlay[] };
	}>();

	let overlays: AnimationOverlay[] = initialOverlays;
	let selectedOverlayId: string | null = null;
	let imageSize: ImageSizePx | null = null;
	let draft: OverlayDraftValues = { ...emptyDraftValues };
	let mobileTab: 'assets' | 'layers' | 'properties' = 'assets';
	let isTouchDevice = false;

	$: selectedOverlay = selectedOverlayId
		? (overlays.find((overlay) => overlay.id === selectedOverlayId) ?? null)
		: null;
	$: selectedOverlayIndex = selectedOverlay
		? overlays.findIndex((overlay) => overlay.id === selectedOverlay.id)
		: -1;

	$: {
		const nextDraft = selectedOverlay ? createDraftValues(selectedOverlay) : emptyDraftValues;
		draft = { ...nextDraft };
	}

	onMount(() => {
		if (typeof window === 'undefined') return;
		isTouchDevice =
			window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;

		const starterPackIds = [firePacks[0]?.id, smokePacks[0]?.id].filter(
			(packId): packId is string => Boolean(packId)
		);

		for (const packId of starterPackIds) {
			void preloadSpritesheetPack(packId, 'low');
		}
	});

	function createDraftValues(overlay: AnimationOverlay): OverlayDraftValues {
		return {
			x: String(Math.round(overlay.x)),
			y: String(Math.round(overlay.y)),
			width: String(Math.round(overlay.width)),
			height: String(Math.round(overlay.height)),
			rotation: String(Math.round(overlay.rotation)),
			opacity: String(Number(overlay.opacity.toFixed(2))),
			playbackSpeed: String(Number(overlay.playbackSpeed.toFixed(1)))
		};
	}

	function setSelected(id: string | null) {
		selectedOverlayId = id;
	}

	function setOverlays(next: AnimationOverlay[]) {
		overlays = next;
		if (selectedOverlayId && !next.some((overlay) => overlay.id === selectedOverlayId)) {
			selectedOverlayId = null;
		}
		dispatch('overlaysChange', { overlays: next });
	}

	function handleImageSize(next: ImageSizePx) {
		imageSize = next;
	}

	function handleAddFromToolbox(packId: string, kind: OverlayKind) {
		if (!imageSize) return;
		const nextOverlay = createAnimationOverlay(kind, imageSize, packId);
		setOverlays([...overlays, nextOverlay]);
		setSelected(nextOverlay.id);
		mobileTab = 'properties';
	}

	function handleDeleteSelected() {
		if (!selectedOverlayId) return;
		setOverlays(overlays.filter((overlay) => overlay.id !== selectedOverlayId));
	}

	function handleDuplicate() {
		if (!selectedOverlay || !imageSize) return;
		const duplicateOverlay: AnimationOverlay = {
			...selectedOverlay,
			id: crypto.randomUUID(),
			x: selectedOverlay.x + 30,
			y: selectedOverlay.y + 30
		};
		const clampedOverlay = clampOverlayToImage(duplicateOverlay, imageSize);
		setOverlays([...overlays, clampedOverlay]);
		setSelected(clampedOverlay.id);
		mobileTab = 'properties';
	}

	function moveSelectedOverlay(direction: -1 | 1) {
		if (!selectedOverlay) return;
		const currentIndex = overlays.findIndex((overlay) => overlay.id === selectedOverlay.id);
		const nextIndex = currentIndex + direction;
		if (currentIndex < 0 || nextIndex < 0 || nextIndex >= overlays.length) return;

		const nextOverlays = [...overlays];
		const [movedOverlay] = nextOverlays.splice(currentIndex, 1);
		nextOverlays.splice(nextIndex, 0, movedOverlay);
		setOverlays(nextOverlays);
	}

	function moveSelectedOverlayToEdge(edge: 'front' | 'back') {
		if (!selectedOverlay) return;
		const currentIndex = overlays.findIndex((overlay) => overlay.id === selectedOverlay.id);
		if (currentIndex < 0) return;

		const nextOverlays = [...overlays];
		const [movedOverlay] = nextOverlays.splice(currentIndex, 1);
		if (edge === 'front') {
			nextOverlays.push(movedOverlay);
		} else {
			nextOverlays.unshift(movedOverlay);
		}
		setOverlays(nextOverlays);
	}

	function updateSelected(partial: Partial<AnimationOverlay>) {
		if (!selectedOverlay) return;
		const nextOverlays = overlays.map((overlay) => {
			if (overlay.id !== selectedOverlay.id) return overlay;
			if (!imageSize) return { ...overlay, ...partial };
			return clampOverlayToImage({ ...overlay, ...partial }, imageSize);
		});
		setOverlays(nextOverlays);
	}

	function parseDraftNumber(value: string) {
		const parsedValue = Number(value);
		return Number.isFinite(parsedValue) ? parsedValue : null;
	}

	function getDraftPatch(field: OverlayDraftField): OverlayUpdatePayload | null {
		const nextValue = parseDraftNumber(draft[field]);
		if (nextValue === null) return null;

		switch (field) {
			case 'x':
				return nextValue === selectedOverlay?.x ? null : { x: nextValue };
			case 'y':
				return nextValue === selectedOverlay?.y ? null : { y: nextValue };
			case 'width':
				return nextValue === selectedOverlay?.width ? null : { width: nextValue };
			case 'height':
				return nextValue === selectedOverlay?.height ? null : { height: nextValue };
			case 'rotation':
				return nextValue === selectedOverlay?.rotation ? null : { rotation: nextValue };
			case 'opacity':
				return nextValue === selectedOverlay?.opacity ? null : { opacity: nextValue };
			case 'playbackSpeed':
				return nextValue === selectedOverlay?.playbackSpeed ? null : { playbackSpeed: nextValue };
		}
	}

	function handleDraftInput(field: OverlayDraftField, value: string) {
		draft = { ...draft, [field]: value };
	}

	function handleDraftCommit(field: OverlayDraftField) {
		if (!selectedOverlay) return;
		const patch = getDraftPatch(field);
		if (!patch) {
			draft = createDraftValues(selectedOverlay);
			return;
		}
		updateSelected(patch);
	}
</script>

<div class="space-y-4">
	<div class="grid gap-4 xl:grid-cols-[18rem_minmax(0,1fr)_20rem]">
		<div class="hidden xl:block">
			<div class="space-y-4 xl:sticky xl:top-4 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto">
				<OverlayAssetPanel
					{firePacks}
					{smokePacks}
					isImageReady={Boolean(imageSize)}
					selectedPackId={selectedOverlay?.packId ?? null}
					on:addOverlay={(event) => handleAddFromToolbox(event.detail.packId, event.detail.kind)}
				/>
				<OverlayLayersPanel
					{overlays}
					{selectedOverlayId}
					on:selectOverlay={(event) => setSelected(event.detail.overlayId)}
				/>
			</div>
		</div>

		<div class="min-w-0">
			<Card class="overflow-hidden">
				<CardContent class="p-3 sm:p-4">
					<div class="relative overflow-hidden rounded-xl border bg-muted/30">
						<div class="relative h-[52dvh] min-h-[320px] w-full sm:h-[60dvh] xl:h-[min(72vh,820px)]">
							<OverlayCanvas
								{baseImageUrl}
								{overlays}
								{selectedOverlayId}
								on:imageSize={(event) => handleImageSize(event.detail.imageSize)}
								on:selectedChange={(event) => setSelected(event.detail.selectedOverlayId)}
								on:overlaysChange={(event) => setOverlays(event.detail.overlays)}
							/>

							<div
								class="pointer-events-none absolute bottom-3 left-3 rounded-lg border bg-background/85 px-3 py-2 text-xs text-muted-foreground backdrop-blur"
							>
								{#if isTouchDevice}
									Tap to select. Drag to move. Use handles to resize or rotate.
								{:else}
									Click to select. Drag to move. Use handles to resize or rotate.
								{/if}
							</div>
						</div>
					</div>
				</CardContent>
			</Card>

			<div class="mt-4 space-y-4 xl:hidden">
				<div class="sticky top-2 z-10 rounded-xl border bg-background/95 p-1 shadow-sm backdrop-blur">
					<div class="grid grid-cols-3 gap-1">
						{#each ['assets', 'layers', 'properties'] as tab}
							<button
								type="button"
								class={`rounded-lg px-3 py-2 text-sm font-medium capitalize transition-colors ${
									mobileTab === tab
										? 'bg-primary text-primary-foreground'
										: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
								}`}
								onclick={() => (mobileTab = tab as typeof mobileTab)}
							>
								{tab}
							</button>
						{/each}
					</div>
				</div>

				{#if mobileTab === 'assets'}
					<OverlayAssetPanel
						{firePacks}
						{smokePacks}
						isImageReady={Boolean(imageSize)}
						selectedPackId={selectedOverlay?.packId ?? null}
						on:addOverlay={(event) => handleAddFromToolbox(event.detail.packId, event.detail.kind)}
					/>
				{:else if mobileTab === 'layers'}
					<OverlayLayersPanel
						{overlays}
						{selectedOverlayId}
						on:selectOverlay={(event) => setSelected(event.detail.overlayId)}
					/>
				{:else}
					<OverlayPropertiesPanel
						{selectedOverlay}
						{selectedOverlayIndex}
						{draft}
						on:draftInput={(event) => handleDraftInput(event.detail.field, event.detail.value)}
						on:draftCommit={(event) => handleDraftCommit(event.detail.field)}
						on:bringForward={() => moveSelectedOverlay(1)}
						on:sendBackward={() => moveSelectedOverlay(-1)}
						on:bringToFront={() => moveSelectedOverlayToEdge('front')}
						on:sendToBack={() => moveSelectedOverlayToEdge('back')}
						on:duplicateOverlay={handleDuplicate}
						on:deleteOverlay={handleDeleteSelected}
					/>
				{/if}
			</div>
		</div>

		<div class="hidden xl:block">
			<div class="xl:sticky xl:top-4">
				<OverlayPropertiesPanel
					{selectedOverlay}
					{selectedOverlayIndex}
					{draft}
					on:draftInput={(event) => handleDraftInput(event.detail.field, event.detail.value)}
					on:draftCommit={(event) => handleDraftCommit(event.detail.field)}
					on:bringForward={() => moveSelectedOverlay(1)}
					on:sendBackward={() => moveSelectedOverlay(-1)}
					on:bringToFront={() => moveSelectedOverlayToEdge('front')}
					on:sendToBack={() => moveSelectedOverlayToEdge('back')}
					on:duplicateOverlay={handleDuplicate}
					on:deleteOverlay={handleDeleteSelected}
				/>
			</div>
		</div>
	</div>
</div>
