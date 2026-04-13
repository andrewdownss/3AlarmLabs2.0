<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Card, CardContent } from '$lib/components/ui/card';
	import type { AnimationOverlay } from './overlay-types';

	interface Props {
		overlays: AnimationOverlay[];
		selectedOverlayId: string | null;
	}

	let { overlays, selectedOverlayId }: Props = $props();

	const dispatch = createEventDispatcher<{
		selectOverlay: { overlayId: string | null };
	}>();

	function handleSelect(overlayId: string | null) {
		dispatch('selectOverlay', { overlayId });
	}
</script>

<Card>
	<CardContent class="space-y-3 p-4">
		<div class="flex items-center justify-between gap-3">
			<div>
				<div class="text-sm font-medium">Layers</div>
				<p class="mt-1 text-xs text-muted-foreground">Select an overlay to edit its settings.</p>
			</div>
			<Badge variant="secondary" class="text-[10px]">{overlays.length}</Badge>
		</div>

		{#if overlays.length === 0}
			<div class="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
				No overlays yet. Add a fire or smoke asset to begin.
			</div>
		{:else}
			<div class="space-y-2">
				{#each overlays as overlay, index (overlay.id)}
					<button
						type="button"
						class={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition-colors ${
							overlay.id === selectedOverlayId
								? 'border-primary bg-primary/10'
								: 'border-border hover:bg-accent/40'
						}`}
						onclick={() => handleSelect(overlay.id)}
					>
						<div class="min-w-0">
							<div class="truncate text-sm font-medium">{overlay.name ?? overlay.kind}</div>
							<div class="text-xs text-muted-foreground">
								Layer {index + 1} • {Math.round(overlay.width)} x {Math.round(overlay.height)}
							</div>
						</div>
						<Badge variant={overlay.id === selectedOverlayId ? 'default' : 'secondary'}>
							{overlay.kind}
						</Badge>
					</button>
				{/each}
			</div>
		{/if}
	</CardContent>
</Card>
