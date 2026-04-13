<script lang="ts">
	import { env } from '$env/dynamic/public';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';
	import { Input } from '$lib/components/ui/input';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import PlayIcon from '@lucide/svelte/icons/play';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let searchQuery = $state('');
	let isDeleting = $state<string | null>(null);

	const filteredScenes = $derived.by(() => {
		if (!searchQuery.trim()) return data.scenes;
		const q = searchQuery.toLowerCase();
		return data.scenes.filter((s) => s.title.toLowerCase().includes(q));
	});

	const canCreate = $derived(data.canCreateScene);

	function thumbnailUrl(scene: (typeof data.scenes)[number]): string {
		if (scene.baseImageUrl) return scene.baseImageUrl;
		if (scene.captureMeta) {
			const { lat, lng, heading, pitch, fov } = scene.captureMeta;
			const key = env.PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
			return `https://maps.googleapis.com/maps/api/streetview?size=400x250&location=${lat},${lng}&heading=${heading}&pitch=${pitch}&fov=${fov}&key=${key}`;
		}
		return '';
	}

	function formatDate(date: Date | string): string {
		return new Date(date).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	async function handleDelete(sceneId: string) {
		if (!confirm('Delete this scene? This cannot be undone.')) return;
		isDeleting = sceneId;
		try {
			const formData = new FormData();
			formData.set('sceneId', sceneId);
			const res = await fetch('?/deleteScene', { method: 'POST', body: formData });
			if (res.ok) {
				data.scenes = data.scenes.filter((s) => s.id !== sceneId);
				data.sceneCount = data.sceneCount - 1;
			}
		} finally {
			isDeleting = null;
		}
	}
</script>

<svelte:head>
	<title>SizeUp Dashboard | 3AlarmLabs</title>
</svelte:head>

<main class="mx-auto max-w-6xl px-4 py-6 pb-safe sm:py-8">
	<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div class="min-w-0">
			<h1 class="text-2xl font-bold tracking-tight">SizeUp Dashboard</h1>
			<p class="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
				{data.sceneCount} scene{data.sceneCount === 1 ? '' : 's'}
				<Badge variant="outline">{data.planConfig.name}</Badge>
			</p>
		</div>
		<div class="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
			<Input
				type="search"
				placeholder="Search scenes…"
				class="min-h-11 w-full min-w-0 sm:max-w-xs"
				bind:value={searchQuery}
			/>
			{#if canCreate}
				<Button class="min-h-11 w-full shrink-0 sm:w-auto" href="/app/sizeup/scenes/new">
					<PlusIcon class="mr-1.5 h-4 w-4" />
					New Scene
				</Button>
			{/if}
		</div>
	</div>

	{#if !canCreate}
		<div class="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
			You've reached the {data.planConfig.maxScenes}-scene limit on the
			<strong>{data.planConfig.name}</strong> plan.
			<a href="/app/settings/billing" class="font-medium underline">Upgrade</a> to create more.
		</div>
	{/if}

	<Separator class="mb-6" />

	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
		{#if canCreate}
			<a
				href="/app/sizeup/scenes/new"
				class="group flex min-h-[220px] items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25 transition-colors hover:border-primary hover:bg-accent/50"
			>
				<div class="flex flex-col items-center gap-2 text-muted-foreground group-hover:text-primary">
					<PlusIcon class="h-10 w-10" />
					<span class="text-sm font-medium">New Scene</span>
				</div>
			</a>
		{/if}

		{#each filteredScenes as scene (scene.id)}
			<Card class="overflow-hidden">
				{#if thumbnailUrl(scene)}
					<div class="relative aspect-video w-full overflow-hidden bg-muted">
						<img
							src={thumbnailUrl(scene)}
							alt={scene.title}
							class="h-full w-full object-cover"
							loading="lazy"
						/>
					</div>
				{:else}
					<div class="flex aspect-video w-full items-center justify-center bg-muted text-muted-foreground">
						No preview
					</div>
				{/if}
				<CardHeader class="pb-2">
					<CardTitle class="truncate text-base">{scene.title}</CardTitle>
					<CardDescription>Updated {formatDate(scene.updatedAt)}</CardDescription>
				</CardHeader>
				<CardContent class="grid grid-cols-2 gap-2 pt-0 sm:flex sm:flex-wrap sm:items-center">
					<Button class="min-h-11 w-full sm:w-auto" variant="default" size="sm" href="/app/sizeup/scenes/{scene.id}/present">
						<PlayIcon class="mr-1 h-3.5 w-3.5" />
						Present
					</Button>
					<Button class="min-h-11 w-full sm:w-auto" variant="outline" size="sm" href="/app/sizeup/scenes/{scene.id}/edit">
						<PencilIcon class="mr-1 h-3.5 w-3.5" />
						Edit
					</Button>
					<Button
						variant="ghost"
						size="sm"
						class="col-span-2 min-h-11 justify-self-end text-destructive hover:text-destructive sm:col-span-1 sm:ml-auto sm:min-h-9 sm:w-auto"
						disabled={isDeleting === scene.id}
						onclick={() => handleDelete(scene.id)}
					>
						<TrashIcon class="h-3.5 w-3.5" />
					</Button>
				</CardContent>
			</Card>
		{:else}
			<div class="col-span-full py-12 text-center text-muted-foreground">
				{#if searchQuery}
					No scenes match "{searchQuery}"
				{:else}
					No scenes yet. Create your first one!
				{/if}
			</div>
		{/each}
	</div>
</main>
