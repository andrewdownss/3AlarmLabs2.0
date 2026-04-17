<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Spinner } from '$lib/components/ui/spinner';
	import KonvaOverlayEditor from '$lib/components/scene-editor/konva-overlay-editor/KonvaOverlayEditor.svelte';
	import type { PageData } from './$types';
	import { env } from '$env/dynamic/public';
	import type { AnimationOverlay } from '$lib/components/scene-editor/konva-overlay-editor/overlay-types';
	import { normalizeAnimationOverlays } from '$lib/components/scene-editor/konva-overlay-editor/overlay-utils';
	import { invalidateAll } from '$app/navigation';

	let { data }: { data: PageData } = $props();
	let overlays = $state<AnimationOverlay[]>([]);
	let isSaving = $state(false);
	let saveError = $state<string | null>(null);
	let saveSuccess = $state(false);
	let isUpgradingImage = $state(false);

	function buildStreetViewStaticUrl(meta: NonNullable<PageData['scene']['captureMeta']>) {
		const key = env.PUBLIC_GOOGLE_MAPS_API_KEY;
		if (!key) return null;
		const url = new URL('https://maps.googleapis.com/maps/api/streetview');
		url.searchParams.set('size', '640x640');
		url.searchParams.set('location', `${meta.lat},${meta.lng}`);
		url.searchParams.set('heading', String(meta.heading));
		url.searchParams.set('pitch', String(meta.pitch));
		url.searchParams.set('fov', String(meta.fov));
		if (meta.panoId) url.searchParams.set('pano', meta.panoId);
		url.searchParams.set('key', key);
		return url.toString();
	}

	const baseImageSrc = $derived.by(() => {
		if (data.scene.baseImageUrl) return data.scene.baseImageUrl;
		if (data.scene.captureMeta) return buildStreetViewStaticUrl(data.scene.captureMeta);
		return null;
	});

	function overlaysToDbJson(next: AnimationOverlay[]) {
		return next.map((o) => ({ id: o.id, packId: o.packId, kind: o.kind, x: o.x, y: o.y, width: o.width, height: o.height, rotation: o.rotation, opacity: o.opacity, flipY: o.flipY, playbackSpeed: o.playbackSpeed }));
	}

	async function handleSave() {
		if (isSaving) return;
		saveError = null; saveSuccess = false; isSaving = true;
		try {
			const fd = new FormData();
			fd.set('overlaysJson', JSON.stringify(overlaysToDbJson(overlays)));
			const res = await fetch('?/save', { method: 'POST', body: fd, credentials: 'same-origin' });
			const payload = await res.json();
			if (payload?.type === 'failure') { saveError = payload?.data?.formError ?? 'Save failed.'; return; }
			saveSuccess = true;
			setTimeout(() => (saveSuccess = false), 2000);
		} catch (e) { saveError = (e as Error).message ?? 'Save failed.'; }
		finally { isSaving = false; }
	}

	async function generateHiRes() {
		if (isUpgradingImage) return;
		isUpgradingImage = true;
		try {
			const fd = new FormData();
			const res = await fetch('?/generateHiRes', { method: 'POST', body: fd, credentials: 'same-origin' });
			const payload = await res.json();
			if (payload?.type !== 'failure') await invalidateAll();
		} finally { isUpgradingImage = false; }
	}

	$effect(() => {
		overlays = normalizeAnimationOverlays(
			data.scene.overlaysJson as AnimationOverlay[] | null
		);
	});

	onMount(() => { if (data.needsHiRes) generateHiRes(); });
</script>

<div class="mx-auto w-full max-w-[1600px] px-4 py-8">
	<div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
		<div class="min-w-0">
			<Badge variant="secondary">Edit</Badge>
			<h1 class="mt-2 text-2xl font-semibold tracking-tight">{data.scene.title}</h1>
			<p class="mt-1 text-sm text-muted-foreground">Drag fire or smoke animations onto the scene, then save.</p>
		</div>
		<div class="flex flex-wrap gap-2 sm:justify-end">
			<Button variant="outline" href="/app/sizeup">Dashboard</Button>
			<Button variant="outline" href={`/app/sizeup/scenes/new/capture?sceneId=${encodeURIComponent(data.scene.id)}`}>Recapture</Button>
			<Button variant="outline" href={`/app/sizeup/scenes/${data.scene.id}/present`}>Present</Button>
			<Button onclick={handleSave} disabled={isSaving}>
				{#if isSaving}
					<Spinner class="mr-2 h-4 w-4" />
					Saving…
				{:else if saveSuccess}
					Saved!
				{:else}
					Save scene
				{/if}
			</Button>
		</div>
	</div>
	{#if saveError}<div class="mb-4 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{saveError}</div>{/if}
	{#if baseImageSrc}
		<KonvaOverlayEditor baseImageUrl={baseImageSrc} initialOverlays={overlays} on:overlaysChange={(e: CustomEvent<{ overlays: AnimationOverlay[] }>) => (overlays = e.detail.overlays)} />
	{:else}
		<div class="flex h-96 items-center justify-center rounded-xl border bg-muted/30">
			<p class="text-sm text-muted-foreground">No image captured. Go back and capture a Street View image first.</p>
		</div>
	{/if}
</div>
