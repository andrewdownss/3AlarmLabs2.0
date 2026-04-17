<script lang="ts">
	import SizeupHeader from '$lib/components/sizeup/sizeup-header.svelte';
	import SceneCard from '$lib/components/sizeup/scene-card.svelte';
	import NewSceneCard from '$lib/components/sizeup/new-scene-card.svelte';
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

<main class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
	<SizeupHeader
		sceneCount={data.sceneCount}
		planName={data.planConfig.name}
		{canCreate}
		bind:searchQuery
	/>

	{#if !canCreate}
		<div
			class="mt-6 border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
		>
			You've reached the {data.planConfig.maxScenes}-scene limit on the
			<strong>{data.planConfig.name}</strong> plan.
			<a href="/app/settings/billing" class="font-medium underline">Upgrade</a> to create more.
		</div>
	{/if}

	<section class="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
		{#if canCreate}
			<NewSceneCard />
		{/if}

		{#each filteredScenes as scene (scene.id)}
			<SceneCard
				{scene}
				isDeleting={isDeleting === scene.id}
				ondelete={handleDelete}
			/>
		{:else}
			<div class="col-span-full py-12 text-center text-muted-foreground">
				{#if searchQuery}
					No scenes match "{searchQuery}"
				{:else}
					No scenes yet. Create your first one!
				{/if}
			</div>
		{/each}
	</section>
</main>
