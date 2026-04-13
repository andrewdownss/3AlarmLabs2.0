<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Card, CardContent } from '$lib/components/ui/card';
	import type { AnimationPack } from '$lib/animations/types';
	import type { OverlayKind } from './overlay-types';
	import { preloadSpritesheetPack } from './spritesheet-cache';

	interface Props {
		firePacks: AnimationPack[];
		smokePacks: AnimationPack[];
		isImageReady: boolean;
		selectedPackId?: string | null;
	}

	let { firePacks, smokePacks, isImageReady, selectedPackId = null }: Props = $props();

	const dispatch = createEventDispatcher<{
		addOverlay: { packId: string; kind: OverlayKind };
	}>();

	function handleAdd(packId: string, kind: OverlayKind) {
		if (!isImageReady) return;
		void preloadSpritesheetPack(packId, 'high');
		dispatch('addOverlay', { packId, kind });
	}

	function handlePrimePack(packId: string) {
		void preloadSpritesheetPack(packId, 'high');
	}
</script>

<Card>
	<CardContent class="space-y-4 p-4">
		<div class="flex items-start justify-between gap-3">
			<div>
				<div class="text-sm font-medium">Assets</div>
				<p class="mt-1 text-xs text-muted-foreground">
					{#if isImageReady}
						Tap or click a pack to add it to the scene.
					{:else}
						Loading the scene image before overlays can be added.
					{/if}
				</p>
			</div>
			<Badge variant="secondary" class="shrink-0 text-[10px] uppercase">Toolbox</Badge>
		</div>

		<div class="space-y-4">
			<div class="space-y-2">
				<div class="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">Fire</div>
				<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
					{#each firePacks as pack (pack.id)}
						<button
							type="button"
							class={`flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border p-3 text-center transition-colors ${
								pack.id === selectedPackId
									? 'border-primary bg-primary/10'
									: 'border-border hover:border-primary/40 hover:bg-accent/40'
							}`}
							disabled={!isImageReady}
							onpointerenter={() => handlePrimePack(pack.id)}
							onfocus={() => handlePrimePack(pack.id)}
							ontouchstart={() => handlePrimePack(pack.id)}
							onclick={() => handleAdd(pack.id, pack.category)}
						>
							<div class="flex h-12 w-12 items-center justify-center rounded-lg bg-red-500/10">
								<img src={pack.previewPath} alt={pack.name} class="h-9 w-9 object-contain" />
							</div>
							<span class="text-xs font-medium">{pack.name}</span>
						</button>
					{/each}
				</div>
			</div>

			<div class="space-y-2">
				<div class="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
					Smoke
				</div>
				<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
					{#each smokePacks as pack (pack.id)}
						<button
							type="button"
							class={`flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border p-3 text-center transition-colors ${
								pack.id === selectedPackId
									? 'border-primary bg-primary/10'
									: 'border-border hover:border-primary/40 hover:bg-accent/40'
							}`}
							disabled={!isImageReady}
							onpointerenter={() => handlePrimePack(pack.id)}
							onfocus={() => handlePrimePack(pack.id)}
							ontouchstart={() => handlePrimePack(pack.id)}
							onclick={() => handleAdd(pack.id, pack.category)}
						>
							<div class="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-400/10">
								<img src={pack.previewPath} alt={pack.name} class="h-9 w-9 object-contain" />
							</div>
							<span class="text-xs font-medium">{pack.name}</span>
						</button>
					{/each}
				</div>
			</div>
		</div>
	</CardContent>
</Card>
