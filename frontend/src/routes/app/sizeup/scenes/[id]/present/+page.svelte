<script lang="ts">
	import OverlayCanvas from '$lib/components/scene-editor/konva-overlay-editor/OverlayCanvas.svelte';
	import ExportPanel from '$lib/components/scene-editor/ExportPanel.svelte';
	import type { AnimationOverlay } from '$lib/components/scene-editor/konva-overlay-editor/overlay-types';
	import { normalizeAnimationOverlays } from '$lib/components/scene-editor/konva-overlay-editor/overlay-utils';
	import type { PageData } from './$types';
	import { Spinner } from '$lib/components/ui/spinner';
	import { env } from '$env/dynamic/public';
	import { invalidateAll } from '$app/navigation';
	import { deserialize } from '$app/forms';

	let { data }: { data: PageData } = $props();
	const overlays = $derived.by(() => normalizeAnimationOverlays(data.scene.overlaysJson as AnimationOverlay[] | null));

	function buildStreetViewStaticUrl(meta: NonNullable<(typeof data.scene)['captureMeta']>) {
		const key = env.PUBLIC_GOOGLE_MAPS_API_KEY;
		if (!key) return null;
		const url = new URL('https://maps.googleapis.com/maps/api/streetview');
		url.searchParams.set('size', '1280x1280');
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

	let isFullscreen = $state(false);
	let showExport = $state(false);
	let overlayCanvasRef: OverlayCanvas | undefined = $state();
	let shareLoading = $state(false);
	let shareCopied = $state(false);

	function toggleFullscreen() {
		if (!document.fullscreenElement) { document.documentElement.requestFullscreen(); isFullscreen = true; }
		else { document.exitFullscreen(); isFullscreen = false; }
	}

	function getExportData() { return overlayCanvasRef?.getExportData() ?? null; }

	async function handleShare() {
		shareLoading = true;
		try {
			const fd = new FormData();
			fd.set('sceneId', data.scene.id);
			const resp = await fetch(`/app/sizeup/scenes/${data.scene.id}/present?/generateShareLink`, { method: 'POST', body: fd, credentials: 'same-origin' });
			const result = deserialize(await resp.text());
			const shareUrl = result.type === 'success' ? (result.data as Record<string, unknown>)?.shareUrl as string | undefined : undefined;
			if (shareUrl) { await navigator.clipboard.writeText(shareUrl); shareCopied = true; setTimeout(() => (shareCopied = false), 2000); }
			await invalidateAll();
		} finally { shareLoading = false; }
	}
</script>

<svelte:document onfullscreenchange={() => { isFullscreen = !!document.fullscreenElement; }} />

<div class="flex h-screen flex-col bg-black">
	{#if !isFullscreen}
		<div class="flex items-center justify-between border-b border-white/10 bg-black px-4 py-3">
			<div class="min-w-0">
				<h1 class="truncate text-lg font-semibold text-white">{data.scene.title}</h1>
				<p class="text-xs text-white/50">Present Mode</p>
			</div>
			<div class="flex gap-2">
				{#if data.planConfig.canShareLink}
					<button type="button" onclick={handleShare} disabled={shareLoading} class="inline-flex h-8 items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 text-sm font-medium text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50">
						{#if shareLoading}
							<Spinner class="h-4 w-4" />
						{/if}
						{shareCopied ? 'Link copied!' : 'Share'}
					</button>
				{/if}
				{#if data.planConfig.canExportVideo}
					<button type="button" onclick={() => (showExport = true)} class="inline-flex h-8 items-center gap-1.5 rounded-md border border-indigo-500/40 bg-indigo-500/10 px-3 text-sm font-medium text-indigo-300 hover:bg-indigo-500/20">Export</button>
				{/if}
				<a href={`/app/sizeup/scenes/${data.scene.id}/edit`} class="inline-flex h-8 items-center rounded-md border border-white/20 px-3 text-sm font-medium text-white/80 hover:bg-white/10">Edit</a>
				<button type="button" onclick={toggleFullscreen} class="inline-flex h-8 items-center rounded-md border border-white/20 px-3 text-sm font-medium text-white/80 hover:bg-white/10">Fullscreen</button>
				<a href="/app/sizeup" class="inline-flex h-8 items-center rounded-md border border-white/20 px-3 text-sm font-medium text-white/80 hover:bg-white/10">Dashboard</a>
			</div>
		</div>
	{/if}
	<div class="relative flex-1">
		{#if baseImageSrc}
			<OverlayCanvas bind:this={overlayCanvasRef} baseImageUrl={baseImageSrc} {overlays} selectedOverlayId={null} isInteractive={false} />
		{:else}
			<div class="flex h-full items-center justify-center text-white/40">No image captured.</div>
		{/if}
		{#if data.planConfig.watermark}
			<div class="pointer-events-none absolute inset-0 z-20 select-none overflow-hidden">
				{#each Array(6) as _, row}
					{#each Array(4) as _, col}
						<div class="absolute flex flex-col items-center text-center" style="left: {col * 28 - 5}%; top: {row * 20 - 5}%; transform: rotate(-25deg);">
							<div class="text-[clamp(18px,3.5vw,42px)] font-black leading-none text-white/30">3 ALARM LABS</div>
							<div class="mt-0.5 text-[clamp(7px,1vw,12px)] font-semibold tracking-[0.3em] text-white/20">FREE PLAN</div>
						</div>
					{/each}
				{/each}
			</div>
		{/if}
		{#if isFullscreen}
			<button type="button" class="absolute top-4 right-4 z-30 rounded-lg bg-black/60 px-3 py-2 text-xs text-white/70 hover:text-white" onclick={toggleFullscreen}>Exit Fullscreen</button>
		{/if}
	</div>
	{#if showExport}
		<ExportPanel {getExportData} sceneTitle={data.scene.title} onClose={() => (showExport = false)} />
	{/if}
</div>
