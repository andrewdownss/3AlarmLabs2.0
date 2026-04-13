<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent } from '$lib/components/ui/card';
	import StreetViewCapture from '$lib/components/capture/StreetViewCapture.svelte';
	import type { PageData } from './$types';
	import { page } from '$app/state';

	let { data }: { data: PageData } = $props();
	let captureMeta = $state<any>(null);
	let isCapturing = $state(false);
	const getCurrentMetaRef: { current: (() => any) | null } = { current: null };
	const actionData = $derived.by(() => page.form as any);
	const formError = $derived.by(() => actionData?.formError as string | undefined);

	function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		const meta = getCurrentMetaRef.current?.();
		if (!meta) return;
		isCapturing = true;
		const form = document.createElement('form');
		form.method = 'POST';
		form.action = window.location.pathname + window.location.search;
		const fields: [string, string][] = [
			['lat', String(meta.lat)], ['lng', String(meta.lng)],
			['heading', String(meta.heading)], ['pitch', String(meta.pitch)],
			['zoom', String(meta.zoom)], ['panoId', meta.panoId ?? '']
		];
		for (const [name, value] of fields) {
			const input = document.createElement('input');
			input.type = 'hidden'; input.name = name; input.value = value;
			form.appendChild(input);
		}
		document.body.appendChild(form);
		form.submit();
	}
</script>
<div class="mx-auto w-full max-w-6xl px-4 py-8">
	<div class="flex items-center justify-between">
		<div>
			<div class="text-sm text-muted-foreground">Step 2 of 3</div>
			<h1 class="mt-1 text-2xl font-semibold tracking-tight">Capture base image</h1>
			<p class="mt-1 text-sm text-muted-foreground">Scene: <span class="font-medium text-foreground">{data.scene.title}</span></p>
		</div>
	</div>
	<Card class="mt-6">
		<CardContent class="p-4">
			<div class="relative mx-auto w-full max-w-5xl">
				<div class="relative overflow-hidden rounded-xl border bg-muted/30">
					<StreetViewCapture onChange={(meta: any) => { captureMeta = meta; }} {getCurrentMetaRef} />
				</div>
				<form method="POST" class="mt-4 space-y-3" onsubmit={handleSubmit}>
					{#if formError}<p class="text-sm text-destructive">{formError}</p>{/if}
					{#if captureMeta}
						<input type="hidden" name="lat" value={String(captureMeta.lat)} />
						<input type="hidden" name="lng" value={String(captureMeta.lng)} />
						<input type="hidden" name="heading" value={String(captureMeta.heading)} />
						<input type="hidden" name="pitch" value={String(captureMeta.pitch)} />
						<input type="hidden" name="zoom" value={String(captureMeta.zoom)} />
						<input type="hidden" name="panoId" value={captureMeta.panoId ?? ''} />
					{/if}
					<div class="flex items-center justify-between">
						<Button variant="outline" href="/app/sizeup/scenes/new" disabled={isCapturing}>Back</Button>
						<Button type="submit" disabled={isCapturing}>
							{#if isCapturing}Capturing high-res image…{:else}Capture & continue{/if}
						</Button>
					</div>
				</form>
			</div>
		</CardContent>
	</Card>
</div>
