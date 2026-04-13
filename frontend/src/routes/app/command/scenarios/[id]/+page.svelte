<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Input } from '$lib/components/ui/input';
	import * as Card from '$lib/components/ui/card';
	import { invalidateAll } from '$app/navigation';
	import KonvaOverlayEditor from '$lib/components/scene-editor/konva-overlay-editor/KonvaOverlayEditor.svelte';
	import { normalizeAnimationOverlays } from '$lib/components/scene-editor/konva-overlay-editor/overlay-utils';
	import type { AnimationOverlay } from '$lib/components/scene-editor/konva-overlay-editor/overlay-types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let newUnitName = $state('');
	let isSaving = $state(false);
	let saveSuccess = $state(false);

	const SIDES = [
		{ key: 'alpha', label: 'Side Alpha', field: 'sideAlphaImageUrl' as const },
		{ key: 'bravo', label: 'Side Bravo', field: 'sideBravoImageUrl' as const },
		{ key: 'charlie', label: 'Side Charlie', field: 'sideCharlieImageUrl' as const },
		{ key: 'delta', label: 'Side Delta', field: 'sideDeltaImageUrl' as const }
	];
	const STAGES = [
		{ key: 'incipient', label: 'Incipient' },
		{ key: 'growth', label: 'Growth' },
		{ key: 'fully_developed', label: 'Fully Developed' },
		{ key: 'decay', label: 'Decay' }
	];

	let activeSide = $state('alpha');
	let activeStage = $state('incipient');

	type StageOverlays = Record<string, AnimationOverlay[]>;
	type SideStageOverlays = Record<string, StageOverlays>;

	function initOverlays(): SideStageOverlays {
		const raw = (data.scenario.stageMetadataJson ?? {}) as SideStageOverlays;
		const result: SideStageOverlays = {};
		for (const side of SIDES) {
			result[side.key] = {};
			for (const stage of STAGES) {
				const persisted = (raw[side.key] as StageOverlays)?.[stage.key];
				result[side.key][stage.key] = normalizeAnimationOverlays(persisted as any);
			}
		}
		return result;
	}

	let overlayData = $state<SideStageOverlays>(initOverlays());

	let editorKey = $state(0);

	const activeSideConfig = $derived(SIDES.find(s => s.key === activeSide)!);
	const activeImageUrl = $derived(data.scenario[activeSideConfig.field] ?? null);
	const activeOverlays = $derived(overlayData[activeSide]?.[activeStage] ?? []);

	function handleOverlaysChange(event: CustomEvent<{ overlays: AnimationOverlay[] }>) {
		overlayData[activeSide][activeStage] = event.detail.overlays;
	}

	function selectSide(sideKey: string) {
		if (sideKey === activeSide) return;
		activeSide = sideKey;
		editorKey++;
	}

	function selectStage(stageKey: string) {
		if (stageKey === activeStage) return;
		activeStage = stageKey;
		editorKey++;
	}

	function overlaysToJson(): SideStageOverlays {
		const out: SideStageOverlays = {};
		for (const side of SIDES) {
			out[side.key] = {};
			for (const stage of STAGES) {
				const arr = overlayData[side.key]?.[stage.key] ?? [];
				out[side.key][stage.key] = arr.map(o => ({
					id: o.id,
					packId: o.packId,
					kind: o.kind,
					x: o.x,
					y: o.y,
					width: o.width,
					height: o.height,
					rotation: o.rotation,
					opacity: o.opacity,
					flipY: o.flipY,
					playbackSpeed: o.playbackSpeed
				}));
			}
		}
		return out;
	}

	async function handleImageUpload(sideField: string, event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		const fd = new FormData();
		fd.set('side', sideField);
		fd.set('file', file);
		await fetch('?/uploadSideImage', { method: 'POST', body: fd, credentials: 'same-origin' });
		await invalidateAll();
	}

	async function handleSave() {
		isSaving = true;
		try {
			const form = document.getElementById('details-form') as HTMLFormElement;
			const fd = new FormData(form);
			fd.set('stageMetadataJson', JSON.stringify(overlaysToJson()));
			await fetch('?/update', { method: 'POST', body: fd, credentials: 'same-origin' });
			saveSuccess = true;
			setTimeout(() => (saveSuccess = false), 2000);
			await invalidateAll();
		} finally {
			isSaving = false;
		}
	}

	async function addResource() {
		if (!newUnitName.trim()) return;
		const fd = new FormData();
		fd.set('unitName', newUnitName.trim());
		await fetch('?/addResource', { method: 'POST', body: fd, credentials: 'same-origin' });
		newUnitName = '';
		await invalidateAll();
	}

	async function removeResource(unitName: string) {
		const fd = new FormData();
		fd.set('unitName', unitName);
		await fetch('?/removeResource', { method: 'POST', body: fd, credentials: 'same-origin' });
		await invalidateAll();
	}

	function getOverlayCount(sideKey: string, stageKey: string): number {
		return overlayData[sideKey]?.[stageKey]?.length ?? 0;
	}
</script>

<div class="mx-auto w-full max-w-7xl px-4 py-10">
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-semibold tracking-tight">Edit Scenario</h1>
			<p class="mt-1 text-sm text-muted-foreground">{data.scenario.title}</p>
		</div>
		<div class="flex gap-2">
			<Button variant="outline" href="/app/command">Back</Button>
			<Button onclick={handleSave} disabled={isSaving}>
				{#if isSaving}Saving…{:else if saveSuccess}Saved!{:else}Save Changes{/if}
			</Button>
		</div>
	</div>

	<div class="space-y-6">
		<Card.Root>
			<Card.Header><Card.Title>Details</Card.Title></Card.Header>
			<Card.Content>
				<form id="details-form" class="space-y-4">
					<div class="space-y-1.5">
						<label class="text-sm font-medium" for="title">Title</label>
						<Input id="title" name="title" value={data.scenario.title} required />
					</div>
					<div class="space-y-1.5">
						<label class="text-sm font-medium" for="description">Description</label>
						<textarea id="description" name="description" class="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{data.scenario.description ?? ''}</textarea>
					</div>
					<div class="grid gap-4 sm:grid-cols-2">
						<div class="space-y-1.5">
							<label class="text-sm font-medium" for="constructionType">Construction Type</label>
							<select id="constructionType" name="constructionType" class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
								<option value="">Select...</option>
								{#each ['Type I - Fire Resistive', 'Type II - Non-Combustible', 'Type III - Ordinary', 'Type IV - Heavy Timber', 'Type V - Wood Frame'] as t}
									<option value={t} selected={data.scenario.constructionType === t}>{t}</option>
								{/each}
							</select>
						</div>
						<div class="space-y-1.5">
							<label class="text-sm font-medium" for="alarmLevel">Alarm Level</label>
							<select id="alarmLevel" name="alarmLevel" class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
								<option value="">Select...</option>
								{#each ['1st Alarm', '2nd Alarm', '3rd Alarm', 'All Hands'] as a}
									<option value={a} selected={data.scenario.alarmLevel === a}>{a}</option>
								{/each}
							</select>
						</div>
					</div>
					<div class="grid gap-4 sm:grid-cols-2">
						<div class="space-y-1.5">
							<label class="text-sm font-medium" for="address">Address</label>
							<Input id="address" name="address" value={data.scenario.address ?? ''} />
						</div>
						<div class="space-y-1.5">
							<label class="text-sm font-medium" for="occupancyType">Occupancy</label>
							<Input id="occupancyType" name="occupancyType" value={data.scenario.occupancyType ?? ''} />
						</div>
					</div>
				</form>
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title>Scene Builder</Card.Title>
				<p class="text-sm text-muted-foreground">Upload building images and add fire/smoke overlays per side and stage.</p>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="flex gap-1 rounded-lg border bg-muted/30 p-1">
					{#each SIDES as side}
						<button
							type="button"
							onclick={() => selectSide(side.key)}
							class="flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors {activeSide === side.key ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}"
						>
							{side.label}
						</button>
					{/each}
				</div>

				<div class="flex items-center gap-4">
					{#if activeImageUrl}
						<div class="relative h-20 w-32 shrink-0 overflow-hidden rounded-lg border bg-muted">
							<img src={activeImageUrl} alt={activeSideConfig.label} class="h-full w-full object-cover" />
						</div>
					{/if}
					<div class="flex-1 space-y-1">
						<label class="text-sm font-medium">{activeSideConfig.label} Image</label>
						<input type="file" accept="image/*" onchange={(e) => handleImageUpload(activeSideConfig.field, e)} class="text-xs" />
						{#if !activeImageUrl}
							<p class="text-xs text-muted-foreground">Upload an image to begin adding overlays for this side.</p>
						{/if}
					</div>
				</div>

				{#if activeImageUrl}
					<div>
						<label class="mb-2 block text-xs font-medium text-muted-foreground uppercase tracking-wider">Stage</label>
						<div class="flex gap-1">
							{#each STAGES as stage}
								{@const count = getOverlayCount(activeSide, stage.key)}
								<button
									type="button"
									onclick={() => selectStage(stage.key)}
									class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors {activeStage === stage.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-accent'}"
								>
									{stage.label}
									{#if count > 0}
										<span class="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary-foreground/20 text-[10px]">{count}</span>
									{/if}
								</button>
							{/each}
						</div>
					</div>

					{#key editorKey}
						<KonvaOverlayEditor
							baseImageUrl={activeImageUrl}
							initialOverlays={activeOverlays}
							on:overlaysChange={handleOverlaysChange}
						/>
					{/key}
				{:else}
					<div class="flex h-64 items-center justify-center rounded-xl border-2 border-dashed bg-muted/20">
						<p class="text-sm text-muted-foreground">Upload an image for {activeSideConfig.label} to start building overlays.</p>
					</div>
				{/if}
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header><Card.Title>Default Resources</Card.Title></Card.Header>
			<Card.Content>
				<div class="flex flex-wrap gap-2">
					{#each data.scenario.defaultResources as resource}
						<Badge variant="secondary" class="gap-1.5">
							{resource.unitName}
							<button type="button" onclick={() => removeResource(resource.unitName)} class="ml-1 text-muted-foreground hover:text-destructive">&times;</button>
						</Badge>
					{/each}
				</div>
				<div class="mt-3 flex gap-2">
					<Input bind:value={newUnitName} placeholder="e.g., Engine 1" class="max-w-xs" />
					<Button type="button" variant="outline" onclick={addResource}>Add Unit</Button>
				</div>
			</Card.Content>
		</Card.Root>
	</div>
</div>
