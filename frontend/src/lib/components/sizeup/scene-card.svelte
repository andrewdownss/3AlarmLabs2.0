<script lang="ts">
	import { env } from '$env/dynamic/public';
	import { Button } from '$lib/components/ui/button';
	import { Spinner } from '$lib/components/ui/spinner';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import PlayIcon from '@lucide/svelte/icons/play';

	interface Scene {
		id: string;
		title: string;
		baseImageUrl: string | null;
		captureMeta: { lat: number; lng: number; heading: number; pitch: number; fov: number } | null;
		updatedAt: Date | string;
	}

	interface Props {
		scene: Scene;
		isDeleting: boolean;
		ondelete: (sceneId: string) => void;
	}

	let { scene, isDeleting, ondelete }: Props = $props();

	const thumbnailUrl = $derived.by(() => {
		if (scene.baseImageUrl) return scene.baseImageUrl;
		if (scene.captureMeta) {
			const { lat, lng, heading, pitch, fov } = scene.captureMeta;
			const key = env.PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
			return `https://maps.googleapis.com/maps/api/streetview?size=400x250&location=${lat},${lng}&heading=${heading}&pitch=${pitch}&fov=${fov}&key=${key}`;
		}
		return '';
	});

	function formatDate(date: Date | string): string {
		return new Date(date).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}
</script>

<article
	class="flex flex-col overflow-hidden border border-border bg-card shadow-sm transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-px hover:border-muted-foreground/30 hover:shadow-md"
>
	{#if thumbnailUrl}
		<div class="relative aspect-16/10 overflow-hidden border-b border-border bg-muted">
			<img
				src={thumbnailUrl}
				alt={scene.title}
				class="h-full w-full object-cover"
				loading="lazy"
			/>
		</div>
	{:else}
		<div
			class="flex aspect-16/10 items-center justify-center border-b border-border bg-muted text-muted-foreground"
		>
			No preview
		</div>
	{/if}
	<div class="p-5">
		<div class="flex items-start justify-between gap-4">
			<div class="min-w-0">
				<h3 class="truncate text-xl font-semibold tracking-tight">{scene.title}</h3>
				<p class="mt-1 text-sm text-muted-foreground">Updated {formatDate(scene.updatedAt)}</p>
			</div>
			<Button
				variant="ghost"
				size="sm"
				class="shrink-0 text-destructive hover:text-destructive"
				disabled={isDeleting}
				onclick={() => ondelete(scene.id)}
			>
				{#if isDeleting}
					<Spinner class="h-4 w-4" />
				{:else}
					<TrashIcon class="h-3.5 w-3.5" />
				{/if}
			</Button>
		</div>
		<div class="mt-5 flex gap-3">
			<Button class="flex-1" href="/app/sizeup/scenes/{scene.id}/present">
				<PlayIcon class="mr-1 h-3.5 w-3.5" />
				Present
			</Button>
			<Button class="flex-1" variant="outline" href="/app/sizeup/scenes/{scene.id}/edit">
				<PencilIcon class="mr-1 h-3.5 w-3.5" />
				Edit
			</Button>
		</div>
	</div>
</article>
