<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent } from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import type { OverlayDraftField, OverlayDraftValues } from './editor-types';
	import type { AnimationOverlay } from './overlay-types';

	interface Props {
		selectedOverlay: AnimationOverlay | null;
		selectedOverlayIndex: number;
		draft: OverlayDraftValues;
	}

	let { selectedOverlay, selectedOverlayIndex, draft }: Props = $props();

	const dispatch = createEventDispatcher<{
		draftInput: { field: OverlayDraftField; value: string };
		draftCommit: { field: OverlayDraftField };
		bringForward: void;
		sendBackward: void;
		bringToFront: void;
		sendToBack: void;
		duplicateOverlay: void;
		deleteOverlay: void;
	}>();

	const numericFields: Array<{ field: OverlayDraftField; label: string; min?: string; max?: string; step: string }> = [
		{ field: 'x', label: 'Position X', step: '1' },
		{ field: 'y', label: 'Position Y', step: '1' },
		{ field: 'width', label: 'Width', min: '2', step: '1' },
		{ field: 'height', label: 'Height', min: '2', step: '1' },
		{ field: 'rotation', label: 'Rotation', step: '1' }
	];

	function handleDraftInput(field: OverlayDraftField, value: string) {
		dispatch('draftInput', { field, value });
	}

	function handleDraftCommit(field: OverlayDraftField) {
		dispatch('draftCommit', { field });
	}
</script>

<Card class="h-full">
	<CardContent class="space-y-4 p-4">
		<div class="flex items-start justify-between gap-3">
			<div>
				<div class="text-sm font-medium">Properties</div>
				{#if selectedOverlay}
					<p class="mt-1 text-xs text-muted-foreground">
						{selectedOverlay.name ?? selectedOverlay.kind} • {Math.round(selectedOverlay.width)} x
						{Math.round(selectedOverlay.height)}
					</p>
				{:else}
					<p class="mt-1 text-xs text-muted-foreground">Select an overlay to edit its properties.</p>
				{/if}
			</div>
			{#if selectedOverlay}
				<Badge variant="secondary">Layer {selectedOverlayIndex + 1}</Badge>
			{/if}
		</div>

		{#if selectedOverlay}
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
				{#each numericFields as fieldConfig (fieldConfig.field)}
					<label class="space-y-1.5">
						<span class="text-xs font-medium text-muted-foreground">{fieldConfig.label}</span>
						<Input
							type="number"
							step={fieldConfig.step}
							min={fieldConfig.min}
							max={fieldConfig.max}
							value={draft[fieldConfig.field]}
							class="h-10 text-sm"
							oninput={(event) =>
								handleDraftInput(fieldConfig.field, (event.currentTarget as HTMLInputElement).value)}
							onchange={() => handleDraftCommit(fieldConfig.field)}
							onblur={() => handleDraftCommit(fieldConfig.field)}
						/>
					</label>
				{/each}

				<label class="space-y-1.5">
					<span class="text-xs font-medium text-muted-foreground">Opacity</span>
					<Input
						type="number"
						step="0.05"
						min="0"
						max="1"
						value={draft.opacity}
						class="h-10 text-sm"
						oninput={(event) =>
							handleDraftInput('opacity', (event.currentTarget as HTMLInputElement).value)}
						onchange={() => handleDraftCommit('opacity')}
						onblur={() => handleDraftCommit('opacity')}
					/>
				</label>

				<label class="space-y-1.5">
					<span class="text-xs font-medium text-muted-foreground">Playback speed</span>
					<Input
						type="number"
						step="0.1"
						min="0.1"
						max="3"
						value={draft.playbackSpeed}
						class="h-10 text-sm"
						oninput={(event) =>
							handleDraftInput('playbackSpeed', (event.currentTarget as HTMLInputElement).value)}
						onchange={() => handleDraftCommit('playbackSpeed')}
						onblur={() => handleDraftCommit('playbackSpeed')}
					/>
				</label>
			</div>

			<div class="space-y-3">
				<label class="space-y-1.5">
					<div class="flex items-center justify-between gap-3">
						<span class="text-xs font-medium text-muted-foreground">Opacity</span>
						<span class="text-xs text-muted-foreground">{draft.opacity || '0'}</span>
					</div>
					<input
						class="w-full accent-primary"
						type="range"
						min="0"
						max="1"
						step="0.01"
						value={draft.opacity}
						oninput={(event) => {
							handleDraftInput('opacity', (event.currentTarget as HTMLInputElement).value);
							handleDraftCommit('opacity');
						}}
					/>
				</label>

				<label class="space-y-1.5">
					<div class="flex items-center justify-between gap-3">
						<span class="text-xs font-medium text-muted-foreground">Playback speed</span>
						<span class="text-xs text-muted-foreground">{draft.playbackSpeed || '1'}x</span>
					</div>
					<input
						class="w-full accent-primary"
						type="range"
						min="0.1"
						max="3"
						step="0.1"
						value={draft.playbackSpeed}
						oninput={(event) => {
							handleDraftInput('playbackSpeed', (event.currentTarget as HTMLInputElement).value);
							handleDraftCommit('playbackSpeed');
						}}
					/>
				</label>
			</div>

			<div class="space-y-3">
				<div class="space-y-1.5">
					<div class="text-xs font-medium text-muted-foreground">Layer order</div>
					<div class="grid grid-cols-2 gap-2">
						<Button variant="outline" class="h-11" onclick={() => dispatch('bringForward')}>
							Bring forward
						</Button>
						<Button variant="outline" class="h-11" onclick={() => dispatch('sendBackward')}>
							Send backward
						</Button>
						<Button variant="outline" class="h-11" onclick={() => dispatch('bringToFront')}>
							Bring to front
						</Button>
						<Button variant="outline" class="h-11" onclick={() => dispatch('sendToBack')}>
							Send to back
						</Button>
					</div>
				</div>

				<div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
					<Button variant="outline" class="h-11" onclick={() => dispatch('duplicateOverlay')}>
						Duplicate
					</Button>
					<Button variant="destructive" class="h-11" onclick={() => dispatch('deleteOverlay')}>
						Delete
					</Button>
				</div>
			</div>
		{:else}
			<div class="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
				Choose a layer from the canvas or the layers tab to edit its position, size, opacity, and
				playback speed.
			</div>
		{/if}
	</CardContent>
</Card>
