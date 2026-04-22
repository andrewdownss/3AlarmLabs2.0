<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Input } from '$lib/components/ui/input';
	import * as Card from '$lib/components/ui/card';
	import { Spinner } from '$lib/components/ui/spinner';
	import { deserialize } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import KonvaOverlayEditor from '$lib/components/scene-editor/konva-overlay-editor/KonvaOverlayEditor.svelte';
	import { normalizeAnimationOverlays } from '$lib/components/scene-editor/konva-overlay-editor/overlay-utils';
	import type { AnimationOverlay } from '$lib/components/scene-editor/konva-overlay-editor/overlay-types';
	import type { PageData } from './$types';
	import type {
		AssignmentCompletionRule,
		ExpectedAction,
		SelfPacedConfig,
		TimelineEvent
	} from '$lib/self-paced';

	let { data }: { data: PageData } = $props();

	let newUnitName = $state('');
	let isSaving = $state(false);
	let saveSuccess = $state(false);
	let uploadingSideField = $state<string | null>(null);
	let uploadError = $state<string | null>(null);
	const MAX_SIDE_IMAGE_BYTES = 10 * 1024 * 1024;

	function emptyConfig(): SelfPacedConfig {
		return {
			timeLimitSeconds: undefined,
			timeline: [],
			expectedActions: [],
			assignmentCompletions: [],
			endConditions: { onTimelineComplete: false, onTimeExpired: false }
		};
	}

	let selfPacedEnabled = $state(Boolean(data.scenario.selfPacedConfigJson));
	let selfPacedConfig = $state<SelfPacedConfig>(
		(data.scenario.selfPacedConfigJson as SelfPacedConfig | null) ?? emptyConfig()
	);
	let isSavingSelfPaced = $state(false);
	let selfPacedSaveMsg = $state<string | null>(null);

	/**
	 * Timing & end conditions default open because students only auto-end
	 * when at least one is checked — hiding them made the "under control"
	 * and time-limit settings easy to miss during authoring.
	 */
	let selfPacedTimingOpen = $state(true);
	let selfPacedExpectedOpen = $state(false);
	let selfPacedFollowupsOpen = $state(false);

	function uid(): string {
		return globalThis.crypto?.randomUUID?.() ?? `id-${Math.random().toString(36).slice(2, 10)}`;
	}

	function addTimelineEvent() {
		const next: TimelineEvent = {
			id: uid(),
			offsetSeconds: 60,
			label: '',
			dispatch: { update: '' }
		};
		selfPacedConfig.timeline = [...selfPacedConfig.timeline, next];
	}

	function removeTimelineEvent(id: string) {
		selfPacedConfig.timeline = selfPacedConfig.timeline.filter((t) => t.id !== id);
	}

	function addExpectedAction() {
		const next: ExpectedAction = {
			id: uid(),
			label: '',
			match: { unitName: '', assignmentContains: '' },
			deadlineSeconds: undefined,
			critical: false
		};
		selfPacedConfig.expectedActions = [...selfPacedConfig.expectedActions, next];
	}

	function removeExpectedAction(id: string) {
		selfPacedConfig.expectedActions = selfPacedConfig.expectedActions.filter((a) => a.id !== id);
	}

	function addCompletionRule() {
		const next: AssignmentCompletionRule = {
			id: uid(),
			label: '',
			trigger: { unitName: '', assignmentContains: '' },
			delaySeconds: 60,
			dispatch: { update: '' }
		};
		selfPacedConfig.assignmentCompletions = [...selfPacedConfig.assignmentCompletions, next];
	}

	function removeCompletionRule(id: string) {
		selfPacedConfig.assignmentCompletions = selfPacedConfig.assignmentCompletions.filter(
			(r) => r.id !== id
		);
	}

	function clampNonNegInt(n: number): number {
		return Math.max(0, Math.floor(Number.isFinite(n) ? n : 0));
	}

	/** Compact label for authoring (e.g. 13m 20s, 1h 5m). Stored values remain seconds. */
	function formatDurationShort(totalSec: number): string {
		const s = clampNonNegInt(totalSec);
		const h = Math.floor(s / 3600);
		const m = Math.floor((s % 3600) / 60);
		const sec = s % 60;
		if (h > 0) return `${h}h ${m}m${sec > 0 ? ` ${sec}s` : ''}`;
		if (m > 0) return `${m}m ${sec}s`;
		return `${sec}s`;
	}

	const sortedTimelinePreview = $derived.by(() =>
		[...selfPacedConfig.timeline].sort(
			(a, b) =>
				clampNonNegInt(a.offsetSeconds ?? 0) - clampNonNegInt(b.offsetSeconds ?? 0) ||
				a.id.localeCompare(b.id)
		)
	);

	/** 1-based index when events are sorted by fire time (matches preview dots). */
	const timelineChronologicalRank = $derived.by(() => {
		const m = new Map<string, number>();
		sortedTimelinePreview.forEach((ev, i) => m.set(ev.id, i + 1));
		return m;
	});

	/** Longest relevant time on the preview axis (timeline, deadlines, limit). */
	const timelineAxisMaxSeconds = $derived.by(() => {
		const offsets = selfPacedConfig.timeline.map((e) => clampNonNegInt(e.offsetSeconds ?? 0));
		const deadlines = selfPacedConfig.expectedActions
			.map((a) => (a.deadlineSeconds != null ? clampNonNegInt(a.deadlineSeconds) : 0))
			.filter((x) => x > 0);
		const limit =
			selfPacedConfig.timeLimitSeconds != null
				? clampNonNegInt(selfPacedConfig.timeLimitSeconds)
				: 0;
		return Math.max(60, limit, ...offsets, ...deadlines, 1);
	});

	function scrollToTimelineEvent(eventId: string) {
		document.getElementById(`selfpaced-tl-${eventId}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
	}

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

	/** SvelteKit form actions from `fetch` must opt into the action protocol (same as `use:enhance`). */
	async function submitAction(action: string, body: FormData) {
		const res = await fetch(`${page.url.pathname}?/${action}`, {
			method: 'POST',
			body,
			credentials: 'same-origin',
			headers: {
				accept: 'application/json',
				'x-sveltekit-action': 'true'
			}
		});
		return deserialize(await res.text());
	}

	async function handleImageUpload(sideField: string, event: Event) {
		if (uploadingSideField) return;
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		uploadError = null;

		if (file.size > MAX_SIDE_IMAGE_BYTES) {
			uploadError = `Image is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 10 MB — try resizing or exporting at a lower quality.`;
			input.value = '';
			return;
		}

		uploadingSideField = sideField;
		const fd = new FormData();
		fd.set('side', sideField);
		fd.set('file', file);
		try {
			const result = await submitAction('uploadSideImage', fd);
			if (result.type === 'failure') {
				const data = result.data as { error?: string } | undefined;
				uploadError = data?.error ?? 'Upload failed. Try again.';
				console.error('[uploadSideImage]', result.data);
			} else {
				await invalidateAll();
			}
			input.value = '';
		} catch (err) {
			console.error('[uploadSideImage]', err);
			uploadError = 'Upload failed. Check your connection and try again.';
		} finally {
			uploadingSideField = null;
		}
	}

	async function handleSave() {
		isSaving = true;
		try {
			const form = document.getElementById('details-form') as HTMLFormElement;
			const fd = new FormData(form);
			fd.set('stageMetadataJson', JSON.stringify(overlaysToJson()));
			const result = await submitAction('update', fd);
			if (result.type === 'failure') {
				console.error('[update]', result.data);
				return;
			}
			saveSuccess = true;
			setTimeout(() => (saveSuccess = false), 2000);
			await invalidateAll();
		} finally {
			isSaving = false;
		}
	}

	async function saveSelfPaced() {
		isSavingSelfPaced = true;
		selfPacedSaveMsg = null;
		try {
			const fd = new FormData();
			if (selfPacedEnabled) {
				const cleaned: SelfPacedConfig = {
					timeLimitSeconds: selfPacedConfig.timeLimitSeconds || undefined,
					timeline: selfPacedConfig.timeline.map((t) => ({
						id: t.id,
						offsetSeconds: Number(t.offsetSeconds) || 0,
						label: t.label?.trim() || undefined,
						dispatch: cleanDispatch(t.dispatch)
					})),
					expectedActions: selfPacedConfig.expectedActions.map((a) => ({
						id: a.id,
						label: a.label.trim(),
						match: cleanMatch(a.match),
						deadlineSeconds:
							typeof a.deadlineSeconds === 'number' && a.deadlineSeconds > 0
								? a.deadlineSeconds
								: undefined,
						critical: Boolean(a.critical)
					})),
					assignmentCompletions: selfPacedConfig.assignmentCompletions.map((r) => ({
						id: r.id,
						label: r.label?.trim() || undefined,
						trigger: cleanMatch(r.trigger),
						delaySeconds: Number(r.delaySeconds) || 0,
						dispatch: cleanDispatch(r.dispatch)
					})),
					endConditions: { ...selfPacedConfig.endConditions }
				};
				fd.set('selfPacedConfigJson', JSON.stringify(cleaned));
			} else {
				fd.set('selfPacedConfigJson', '');
			}
			const result = await submitAction('updateSelfPacedConfig', fd);
			if (result.type === 'failure') {
				const err = (result.data as { selfPacedError?: string } | undefined)?.selfPacedError;
				selfPacedSaveMsg = err ?? 'Could not save self-paced config.';
				return;
			}
			selfPacedSaveMsg = 'Saved.';
			await invalidateAll();
		} finally {
			isSavingSelfPaced = false;
			setTimeout(() => (selfPacedSaveMsg = null), 3000);
		}
	}

	function cleanDispatch(d: TimelineEvent['dispatch']): TimelineEvent['dispatch'] {
		const out: TimelineEvent['dispatch'] = {};
		if (d.stage) out.stage = d.stage;
		if (d.side) out.side = d.side;
		if (d.hazard?.trim()) out.hazard = d.hazard.trim();
		if (d.update?.trim()) out.update = d.update.trim();
		return out;
	}

	function cleanMatch(m: { unitName?: string; assignmentContains?: string }) {
		const out: { unitName?: string; assignmentContains?: string } = {};
		if (m.unitName?.trim()) out.unitName = m.unitName.trim();
		if (m.assignmentContains?.trim()) out.assignmentContains = m.assignmentContains.trim();
		return out;
	}

	async function addResource() {
		if (!newUnitName.trim()) return;
		const fd = new FormData();
		fd.set('unitName', newUnitName.trim());
		const result = await submitAction('addResource', fd);
		if (result.type === 'failure') {
			console.error('[addResource]', result.data);
			return;
		}
		newUnitName = '';
		await invalidateAll();
	}

	async function removeResource(unitName: string) {
		const fd = new FormData();
		fd.set('unitName', unitName);
		const result = await submitAction('removeResource', fd);
		if (result.type === 'failure') {
			console.error('[removeResource]', result.data);
			return;
		}
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
				{#if isSaving}
					<Spinner class="mr-2 h-4 w-4" />
					Saving…
				{:else if saveSuccess}
					Saved!
				{:else}
					Save Changes
				{/if}
			</Button>
		</div>
	</div>

	<div class="space-y-6">
		<div class="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm leading-relaxed text-foreground dark:bg-primary/10">
			<p class="font-semibold">How to build a scenario</p>
			<ol class="mt-1.5 ml-4 list-decimal space-y-0.5 text-xs text-muted-foreground sm:text-sm">
				<li>Fill in <strong class="font-medium text-foreground">Details</strong> (title, dispatch notes, construction, etc.).</li>
				<li>Upload building images and add fire/smoke overlays in <strong class="font-medium text-foreground">Scene Builder</strong>.</li>
				<li>Add apparatus in <strong class="font-medium text-foreground">Default Resources</strong> so students have units to assign.</li>
				<li>
					<a href="#self-paced-script" class="font-medium text-primary underline underline-offset-2">Scroll to Self-Paced Script</a>
					and toggle <strong class="font-medium text-foreground">Enable self-paced mode</strong> on if you want a scripted, interactive timeline (otherwise the scenario runs as free-form self-practice).
				</li>
				<li>Click <strong class="font-medium text-foreground">Save Changes</strong>. Students run it from the Command page via <em>Self Practice</em> or <em>Instructor-Led</em>.</li>
			</ol>
		</div>

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
					<div class="space-y-1.5">
						<label class="text-sm font-medium" for="dispatchNotes">Dispatch Notes</label>
						<textarea
							id="dispatchNotes"
							name="dispatchNotes"
							placeholder="Initial dispatch information shown to the student before they start the scenario."
							class="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						>{data.scenario.dispatchNotes ?? ''}</textarea>
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
						<label class="text-sm font-medium" for="side-image-upload">
							{activeSideConfig.label} Image
						</label>
						<div class="flex items-center gap-3">
							<input
								id="side-image-upload"
								type="file"
								accept="image/*"
								disabled={uploadingSideField !== null}
								onchange={(e) => handleImageUpload(activeSideConfig.field, e)}
								class="text-xs"
							/>
							{#if uploadingSideField === activeSideConfig.field}
								<Spinner class="h-4 w-4 text-muted-foreground" />
							{/if}
						</div>
						{#if !activeImageUrl}
							<p class="text-xs text-muted-foreground">Upload an image to begin adding overlays for this side. Max 10 MB.</p>
						{/if}
						{#if uploadError}
							<p class="text-xs text-destructive">{uploadError}</p>
						{/if}
					</div>
				</div>

				{#if activeImageUrl}
					<div>
						<div
							id="stage-label"
							class="mb-2 block text-xs font-medium text-muted-foreground uppercase tracking-wider"
						>
							Stage
						</div>
						<div class="flex gap-1" role="group" aria-labelledby="stage-label">
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

		<Card.Root id="self-paced-script">
			<Card.Header>
				<Card.Title>Self-Paced Script</Card.Title>
				<p class="text-sm text-muted-foreground">
					Turn this on to make the scenario <strong class="font-medium text-foreground">scripted and interactive</strong>. You define timed events (stage changes, hazards, dispatch updates), expected actions, and end conditions (time limit, "under control" declaration, etc.). When students open the scenario they'll see a "Start scenario" gate, and the timeline runs automatically after they press start. Leave it off to run the scenario as free-form self-practice.
				</p>
			</Card.Header>
			<Card.Content class="space-y-6">
				<div class="flex items-center justify-between rounded-lg border bg-muted/20 px-4 py-3">
					<div>
						<p class="text-sm font-medium">Enable self-paced mode</p>
						<p class="text-xs text-muted-foreground">
							{#if selfPacedEnabled}
								On: the scenario is scripted. Configure the timeline and end conditions below, then press <strong class="font-medium text-foreground">Save self-paced script</strong>.
							{:else}
								Off: the scenario runs as free-form self-practice with no scripted events. Turn this on to author timed dispatches and end conditions.
							{/if}
						</p>
					</div>
					<label class="inline-flex cursor-pointer items-center gap-2 text-sm">
						<input type="checkbox" bind:checked={selfPacedEnabled} />
						{selfPacedEnabled ? 'On' : 'Off'}
					</label>
				</div>

				{#if selfPacedEnabled}
					<details
						class="group mb-6 rounded-xl border border-border bg-muted/15 [&_summary::-webkit-details-marker]:hidden dark:bg-muted/10"
						bind:open={selfPacedTimingOpen}
					>
						<summary
							class="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3.5 text-sm font-semibold text-foreground hover:bg-muted/25"
						>
							<span>Time limit &amp; end conditions</span>
							<span
								class="shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
								aria-hidden="true"
							>▼</span>
						</summary>
						<div class="border-t border-border/60 px-4 pb-4 pt-1">
					<div class="grid gap-4 pt-3 sm:grid-cols-2">
						<div class="space-y-1.5">
							<label class="text-sm font-medium" for="timeLimitMin">Time limit</label>
							<div class="flex flex-wrap items-end gap-2">
								<div class="space-y-1">
									<span class="text-xs text-muted-foreground" id="timeLimitMin-h">Minutes</span>
									<Input
										id="timeLimitMin"
										type="number"
										min="0"
										step="1"
										class="w-[5.5rem]"
										placeholder="—"
										value={selfPacedConfig.timeLimitSeconds == null ? '' : Math.floor(selfPacedConfig.timeLimitSeconds / 60)}
										oninput={(e) => {
											const raw = (e.currentTarget as HTMLInputElement).value;
											if (raw === '') {
												selfPacedConfig.timeLimitSeconds = undefined;
												return;
											}
											const mm = clampNonNegInt(Number.parseInt(raw, 10) || 0);
											const ss =
												selfPacedConfig.timeLimitSeconds != null
													? selfPacedConfig.timeLimitSeconds % 60
													: 0;
											selfPacedConfig.timeLimitSeconds = mm * 60 + ss;
										}}
									/>
								</div>
								<div class="space-y-1">
									<span class="text-xs text-muted-foreground" id="timeLimitSec-h">Seconds (0–59)</span>
									<Input
										id="timeLimitSec"
										type="number"
										min="0"
										max="59"
										step="1"
										class="w-[5.5rem]"
										placeholder="—"
										value={selfPacedConfig.timeLimitSeconds == null ? '' : selfPacedConfig.timeLimitSeconds % 60}
										oninput={(e) => {
											const raw = (e.currentTarget as HTMLInputElement).value;
											if (raw === '') {
												selfPacedConfig.timeLimitSeconds = undefined;
												return;
											}
											let ss = clampNonNegInt(Number.parseInt(raw, 10) || 0);
											ss = Math.min(59, ss);
											const mm =
												selfPacedConfig.timeLimitSeconds != null
													? Math.floor(selfPacedConfig.timeLimitSeconds / 60)
													: 0;
											selfPacedConfig.timeLimitSeconds = mm * 60 + ss;
										}}
									/>
								</div>
							</div>
							<p class="text-xs text-muted-foreground">
								{#if selfPacedConfig.timeLimitSeconds != null}
									= <strong class="font-medium text-foreground">{formatDurationShort(selfPacedConfig.timeLimitSeconds)}</strong>
									({selfPacedConfig.timeLimitSeconds} s stored). Clear both fields for no limit.
								{:else}
									Optional. Leave both blank for no time limit.
								{/if}
							</p>
						</div>
						<div class="space-y-1.5">
							<p class="text-sm font-medium">End conditions</p>
							<label class="flex items-center gap-2 text-sm">
								<input type="checkbox" bind:checked={selfPacedConfig.endConditions.onTimelineComplete} />
								End when all timeline events have fired
							</label>
							<label class="flex items-center gap-2 text-sm">
								<input type="checkbox" bind:checked={selfPacedConfig.endConditions.onTimeExpired} />
								End when time limit is reached (timeout)
							</label>
							<label class="flex items-center gap-2 text-sm">
								<input type="checkbox" bind:checked={selfPacedConfig.endConditions.onUnderControl} />
								End when student declares "under control"
							</label>
						</div>
					</div>
						</div>
					</details>

					<div class="rounded-xl border border-border bg-muted/10 p-4 dark:bg-muted/5">
						{#if selfPacedConfig.timeline.length > 0}
							<div
								class="mb-6 rounded-xl border-2 border-primary/20 bg-primary/5 px-4 py-6 sm:px-7 sm:py-9 dark:bg-primary/10"
								aria-label="Timeline preview by simulation time"
							>
								<div class="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-4">
									<p class="text-base font-semibold tracking-tight text-foreground sm:text-lg">When things fire</p>
									<p class="shrink-0 rounded-md border border-border/60 bg-background/80 px-3 py-2 text-xs text-muted-foreground shadow-sm sm:text-sm">
										<span class="font-medium text-foreground">Axis:</span> 0 →
										<span class="font-semibold tabular-nums text-foreground">{formatDurationShort(timelineAxisMaxSeconds)}</span>
										{#if selfPacedConfig.timeLimitSeconds != null}
											<span class="text-destructive"> · limit {formatDurationShort(selfPacedConfig.timeLimitSeconds)}</span>
										{/if}
									</p>
								</div>
								<p class="mb-6 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:mb-8">
									Dots are <span class="font-medium text-primary">timeline events</span> (order by time).
									{#if selfPacedConfig.expectedActions.some((a) => a.deadlineSeconds != null && a.deadlineSeconds > 0)}
										Ticks below are <span class="font-medium text-amber-700 dark:text-amber-300">action deadlines</span>.
									{/if}
									Click a dot to jump to that card.
								</p>
								<div
									class="relative min-h-[9rem] overflow-x-auto rounded-xl border border-primary/15 bg-background/70 px-3 py-10 sm:min-h-[10.5rem] sm:px-5 sm:py-12 dark:bg-background/50"
								>
									<div class="relative mx-auto min-h-[6.5rem] min-w-[280px] max-w-5xl px-1 sm:min-h-[7rem] sm:px-3">
										<div
											class="absolute left-3 right-3 top-1/2 h-3 -translate-y-1/2 rounded-full bg-muted shadow-inner"
											aria-hidden="true"
										></div>
										{#if selfPacedConfig.timeLimitSeconds != null && selfPacedConfig.timeLimitSeconds > 0}
											{@const limPct =
												timelineAxisMaxSeconds > 0
													? Math.min(
															100,
															Math.max(0, (selfPacedConfig.timeLimitSeconds / timelineAxisMaxSeconds) * 100)
														)
													: 0}
											<div
												class="pointer-events-none absolute top-1/2 z-10 h-8 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-destructive shadow-[0_0_0_1px_rgba(255,255,255,0.6)] dark:shadow-[0_0_0_1px_rgba(0,0,0,0.5)]"
												style={`left: calc(12px + (100% - 24px) * ${limPct / 100})`}
												title="Time limit at {formatDurationShort(selfPacedConfig.timeLimitSeconds)}"
											></div>
										{/if}
										{#each sortedTimelinePreview as ev, pi (ev.id)}
											{@const off = clampNonNegInt(ev.offsetSeconds ?? 0)}
											{@const pct =
												timelineAxisMaxSeconds > 0
													? Math.min(100, Math.max(0, (off / timelineAxisMaxSeconds) * 100))
													: 0}
											<button
												type="button"
												class="absolute top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
												style={`left: calc(12px + (100% - 24px) * ${pct / 100})`}
												onclick={() => scrollToTimelineEvent(ev.id)}
												title="{formatDurationShort(off)} — {ev.label?.trim() || `Event ${pi + 1}`}"
											>
												<span
													class="flex h-9 w-9 items-center justify-center rounded-full border-2 border-background bg-primary text-xs font-bold text-primary-foreground shadow-md ring-2 ring-primary/25"
												>
													{pi + 1}
												</span>
												<span class="max-w-[6rem] truncate text-center text-xs font-semibold tabular-nums text-foreground">
													{formatDurationShort(off)}
												</span>
											</button>
										{/each}
										{#each selfPacedConfig.expectedActions as action (action.id)}
											{#if action.deadlineSeconds != null && action.deadlineSeconds > 0}
												{@const d = clampNonNegInt(action.deadlineSeconds)}
												{@const dPct =
													timelineAxisMaxSeconds > 0
														? Math.min(100, Math.max(0, (d / timelineAxisMaxSeconds) * 100))
														: 0}
												<div
													class="pointer-events-none absolute top-[calc(50%+28px)] z-10 -translate-x-1/2 sm:top-[calc(50%+32px)]"
													style={`left: calc(12px + (100% - 24px) * ${dPct / 100})`}
													title="Deadline {formatDurationShort(d)}"
												>
													<div class="h-0 w-0 border-x-[6px] border-b-[8px] border-x-transparent border-b-amber-500 drop-shadow-sm"></div>
												</div>
											{/if}
										{/each}
									</div>
									<div
										class="mx-1 mt-8 flex flex-col gap-2 border-t border-border/50 pt-6 text-xs text-muted-foreground sm:mx-3 sm:flex-row sm:items-center sm:justify-between sm:text-sm"
									>
										<span>
											<span class="font-medium text-foreground">Start</span>
											<span class="ml-1.5 tabular-nums">0</span>
										</span>
										<span class="sm:text-right">
											<span class="font-medium text-foreground">End of scale</span>
											<span class="ml-1.5 tabular-nums font-semibold text-foreground"
												>{formatDurationShort(timelineAxisMaxSeconds)}</span
											>
										</span>
									</div>
								</div>
							</div>
						{/if}

						<div class="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
							<div>
								<h4 class="text-base font-semibold tracking-tight">Timeline events</h4>
								<p class="mt-0.5 max-w-xl text-xs text-muted-foreground">
									Events run in <strong class="font-medium text-foreground">time order</strong> (by offset).
									{#if selfPacedConfig.timeline.length > 0}
										The <strong class="font-medium text-foreground">When things fire</strong> strip above shows the full run. Expand a
										card to edit label, scene, and dispatch.
									{:else}
										Add an event to see the visual timeline.
									{/if}
								</p>
							</div>
							<Button type="button" variant="default" size="sm" class="shrink-0" onclick={addTimelineEvent}>+ Add event</Button>
						</div>
						{#if selfPacedConfig.timeline.length === 0}
							<div class="rounded-lg border-2 border-dashed border-muted-foreground/25 bg-background px-4 py-6 text-center">
								<p class="text-sm font-medium text-foreground">No timed events yet</p>
								<p class="mt-1 text-xs text-muted-foreground">
									Add one to drive automatic updates after the student presses Start. Each event can change the fire stage, switch the visible side, show a hazard, or push a dispatch update at a specific simulation time (e.g. at 1:30 → "Heavy fire showing side Charlie").
								</p>
							</div>
						{:else}
							<ul class="mt-6 flex list-none flex-col gap-5 pl-0 sm:mt-8" role="list">
								{#each selfPacedConfig.timeline as event, ti (event.id)}
									<li
										id="selfpaced-tl-{event.id}"
										class="relative overflow-hidden rounded-xl border-2 border-border bg-card shadow-sm ring-1 ring-black/5 dark:ring-white/10 scroll-mt-8"
									>
										<div
											class="absolute left-0 top-0 h-full w-1.5 bg-primary"
											aria-hidden="true"
										></div>
										<div class="pl-4 sm:pl-5">
											<div
												class="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-muted/40 px-3 py-3 sm:px-4 dark:bg-muted/25"
											>
												<div class="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-1">
													<span
														class="inline-flex h-8 min-w-[2rem] shrink-0 items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-bold tabular-nums text-primary-foreground shadow-sm"
														title="Chronological order (matches dots on the preview strip)"
													>
														{timelineChronologicalRank.get(event.id) ?? ti + 1}
													</span>
													<div class="min-w-0 space-y-2">
														<p class="text-[11px] font-medium text-muted-foreground">Fire after (simulation time from start)</p>
														<div class="flex flex-wrap items-end gap-3">
															<div class="space-y-1">
																<label class="text-xs font-semibold text-foreground" for={`tl-min-${event.id}`}>Minutes</label>
																<Input
																	id={`tl-min-${event.id}`}
																	type="number"
																	min="0"
																	step="1"
																	class="h-10 w-[4.75rem] border-2 text-center text-lg font-bold tabular-nums"
																	value={Math.floor(clampNonNegInt(event.offsetSeconds ?? 0) / 60)}
																	oninput={(e) => {
																		const mm = clampNonNegInt(
																			Number.parseInt((e.currentTarget as HTMLInputElement).value, 10) || 0
																		);
																		const ss = clampNonNegInt(event.offsetSeconds ?? 0) % 60;
																		event.offsetSeconds = mm * 60 + ss;
																	}}
																/>
															</div>
															<div class="space-y-1">
																<label class="text-xs font-semibold text-foreground" for={`tl-sec-${event.id}`}>Seconds</label>
																<Input
																	id={`tl-sec-${event.id}`}
																	type="number"
																	min="0"
																	max="59"
																	step="1"
																	class="h-10 w-[4.75rem] border-2 text-center text-lg font-bold tabular-nums"
																	value={clampNonNegInt(event.offsetSeconds ?? 0) % 60}
																	oninput={(e) => {
																		let ss = clampNonNegInt(
																			Number.parseInt((e.currentTarget as HTMLInputElement).value, 10) || 0
																		);
																		ss = Math.min(59, ss);
																		const mm = Math.floor(clampNonNegInt(event.offsetSeconds ?? 0) / 60);
																		event.offsetSeconds = mm * 60 + ss;
																	}}
																/>
															</div>
															<div class="rounded-md border border-dashed border-muted-foreground/30 bg-background/80 px-3 py-2">
																<p class="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Total</p>
																<p class="text-sm font-bold tabular-nums text-foreground">
																	{formatDurationShort(clampNonNegInt(event.offsetSeconds ?? 0))}
																</p>
																<p class="text-[10px] text-muted-foreground">{clampNonNegInt(event.offsetSeconds ?? 0)} s</p>
															</div>
														</div>
														<p class="text-[11px] text-muted-foreground">
															Use <strong class="font-medium text-foreground">minutes</strong> for long offsets (e.g. 13 min + 20 s = 800 s). Seconds field is 0–59.
														</p>
													</div>
												</div>
												<Button
													type="button"
													variant="outline"
													size="sm"
													class="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
													onclick={() => removeTimelineEvent(event.id)}
												>
													Remove
												</Button>
											</div>

											<details
												class="group border-t border-border bg-muted/15 [&_summary::-webkit-details-marker]:hidden open:bg-muted/25 dark:bg-muted/10"
											>
												<summary
													class="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-3 text-sm font-medium text-muted-foreground hover:text-foreground sm:px-4"
												>
													<span>Label, scene &amp; dispatch</span>
													<span
														class="shrink-0 text-xs text-muted-foreground transition-transform duration-200 group-open:rotate-180"
														aria-hidden="true"
													>▼</span>
												</summary>
											<div class="space-y-5 px-3 pb-4 pt-0 sm:px-4">
												<div class="space-y-2">
													<p class="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
														Label <span class="font-normal normal-case tracking-normal text-muted-foreground/80">(optional, for you)</span>
													</p>
													<Input
														id={`tl-label-${event.id}`}
														placeholder="e.g., Smoke from Side B — second alarm"
														class="border-input/80 text-sm font-medium"
														bind:value={event.label}
													/>
												</div>

												<div class="space-y-2">
													<p class="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
														Scene &amp; view
													</p>
													<p class="text-[11px] text-muted-foreground">What the student sees on the board / map (optional).</p>
													<div class="grid gap-3 rounded-lg border border-border/80 bg-muted/30 p-3 sm:grid-cols-2 dark:bg-muted/20">
														<div class="space-y-1.5">
															<label class="text-xs font-semibold text-foreground" for={`tl-stage-${event.id}`}>Stage change</label>
															<select
																id={`tl-stage-${event.id}`}
																bind:value={event.dispatch.stage}
																class="flex h-10 w-full rounded-md border-2 border-input bg-background px-3 text-sm font-medium"
															>
																<option value={undefined}>No change</option>
																{#each STAGES as stage (stage.key)}
																	<option value={stage.key}>{stage.label}</option>
																{/each}
															</select>
														</div>
														<div class="space-y-1.5">
															<label class="text-xs font-semibold text-foreground" for={`tl-side-${event.id}`}>View side</label>
															<select
																id={`tl-side-${event.id}`}
																bind:value={event.dispatch.side}
																class="flex h-10 w-full rounded-md border-2 border-input bg-background px-3 text-sm font-medium"
															>
																<option value={undefined}>No change</option>
																{#each SIDES as side (side.key)}
																	<option value={side.key}>{side.label}</option>
																{/each}
															</select>
														</div>
													</div>
												</div>

												<div class="space-y-2">
													<p class="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-800 dark:text-blue-200">
														Dispatch text
													</p>
													<p class="text-[11px] text-muted-foreground">
														Shown as instructor-style updates (optional—at least one field in the whole event should do something).
													</p>
													<div class="space-y-3 rounded-lg border-2 border-blue-200/80 bg-blue-50/80 p-3 dark:border-blue-900/60 dark:bg-blue-950/35">
														<div class="space-y-1.5">
															<label class="text-xs font-semibold text-blue-950 dark:text-blue-100" for={`tl-update-${event.id}`}>
																Update message
															</label>
															<Input
																id={`tl-update-${event.id}`}
																placeholder="e.g., Reports of extension to exposure Delta-2"
																class="border-blue-200/80 bg-background dark:border-blue-900/50"
																bind:value={event.dispatch.update}
															/>
														</div>
														<div class="space-y-1.5">
															<label class="text-xs font-semibold text-red-800 dark:text-red-200" for={`tl-hazard-${event.id}`}>
																Hazard alert
															</label>
															<Input
																id={`tl-hazard-${event.id}`}
																placeholder="e.g., Collapse zone — Side Charlie"
																class="border-red-200/80 bg-background dark:border-red-900/50"
																bind:value={event.dispatch.hazard}
															/>
														</div>
													</div>
												</div>
											</div>
											</details>
										</div>
									</li>
								{/each}
							</ul>
						{/if}
					</div>

					<details
						class="group rounded-xl border border-border bg-muted/10 [&_summary::-webkit-details-marker]:hidden dark:bg-muted/5"
						bind:open={selfPacedExpectedOpen}
					>
						<summary
							class="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3.5 hover:bg-muted/30"
						>
							<div class="min-w-0 pr-2">
								<h4 class="text-base font-semibold tracking-tight">Expected actions</h4>
								<p class="mt-0.5 max-w-xl text-xs text-muted-foreground">
									Optional review checks—expand to add or edit.
								</p>
							</div>
							<div class="flex shrink-0 items-center gap-2">
								<Button
									type="button"
									variant="default"
									size="sm"
									onclick={(e) => {
										e.preventDefault();
										e.stopPropagation();
										addExpectedAction();
									}}
								>+ Add action</Button>
								<span class="text-muted-foreground transition-transform duration-200 group-open:rotate-180" aria-hidden="true"
									>▼</span
								>
							</div>
						</summary>
						<div class="border-t border-border/60 px-4 pb-4 pt-2">
						{#if selfPacedConfig.expectedActions.length === 0}
							<p class="rounded-lg border-2 border-dashed border-muted-foreground/25 bg-background px-4 py-6 text-center text-sm text-muted-foreground">
								Add actions to track what you expect the student to task on the board.
							</p>
						{:else}
							<ul class="mt-4 flex list-none flex-col gap-4 pl-0" role="list">
								{#each selfPacedConfig.expectedActions as action, ai (action.id)}
									<li
										class="relative overflow-hidden rounded-xl border-2 border-border bg-card shadow-sm ring-1 ring-black/5 dark:ring-white/10"
									>
										<div class="absolute left-0 top-0 h-full w-1.5 bg-amber-500" aria-hidden="true"></div>
										<div class="pl-4 sm:pl-5">
											<div
												class="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-amber-50/80 px-3 py-3 sm:px-4 dark:bg-amber-950/25"
											>
												<div class="flex flex-wrap items-center gap-2">
													<span
														class="inline-flex h-8 min-w-[2rem] items-center justify-center rounded-lg bg-amber-600 px-2.5 text-sm font-bold text-white shadow-sm"
													>
														{ai + 1}
													</span>
													<span class="text-xs font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-100">
														Expected action
													</span>
												</div>
												<Button
													type="button"
													variant="outline"
													size="sm"
													class="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
													onclick={() => removeExpectedAction(action.id)}
												>
													Remove
												</Button>
											</div>
											<div class="space-y-4 px-3 py-4 sm:px-4">
												<div class="space-y-1.5">
													<label class="text-xs font-semibold text-foreground" for={`ea-label-${action.id}`}>Description</label>
													<Input
														id={`ea-label-${action.id}`}
														placeholder="e.g., Stretch line to Div 2"
														class="border-input/80 font-medium"
														bind:value={action.label}
													/>
												</div>
												<div class="space-y-2">
													<p class="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Match on command board</p>
													<div class="grid gap-3 rounded-lg border border-border/80 bg-muted/30 p-3 sm:grid-cols-2 dark:bg-muted/20">
														<div class="space-y-1.5">
															<label class="text-xs font-semibold" for={`ea-unit-${action.id}`}>Unit name contains</label>
															<Input id={`ea-unit-${action.id}`} placeholder="e.g., Engine 1" bind:value={action.match.unitName} />
														</div>
														<div class="space-y-1.5">
															<label class="text-xs font-semibold" for={`ea-asg-${action.id}`}>Assignment contains</label>
															<Input
																id={`ea-asg-${action.id}`}
																placeholder="e.g., line, search, vent"
																bind:value={action.match.assignmentContains}
															/>
														</div>
													</div>
												</div>
												<div class="flex flex-col gap-3 rounded-lg border-2 border-amber-200/70 bg-amber-50/50 p-3 sm:flex-row sm:items-end sm:justify-between dark:border-amber-900/50 dark:bg-amber-950/30">
													<div class="min-w-0 flex-1 space-y-2">
														<label class="text-xs font-semibold text-amber-950 dark:text-amber-100">
															Deadline (from simulation start)
														</label>
														<div class="flex flex-wrap items-end gap-2">
															<div class="space-y-1">
																<span class="text-[10px] text-amber-900/80 dark:text-amber-200/80">Minutes</span>
																<Input
																	type="number"
																	min="0"
																	step="1"
																	class="h-9 w-[4.5rem] border-amber-200/80 dark:border-amber-900/50"
																	value={action.deadlineSeconds == null ? '' : Math.floor(action.deadlineSeconds / 60)}
																	oninput={(e) => {
																		const raw = (e.currentTarget as HTMLInputElement).value;
																		if (raw === '') {
																			action.deadlineSeconds = undefined;
																			return;
																		}
																		const mm = clampNonNegInt(Number.parseInt(raw, 10) || 0);
																		const ss =
																			action.deadlineSeconds != null ? action.deadlineSeconds % 60 : 0;
																		action.deadlineSeconds = mm * 60 + ss;
																	}}
																/>
															</div>
															<div class="space-y-1">
																<span class="text-[10px] text-amber-900/80 dark:text-amber-200/80">Seconds (0–59)</span>
																<Input
																	type="number"
																	min="0"
																	max="59"
																	step="1"
																	class="h-9 w-[4.5rem] border-amber-200/80 dark:border-amber-900/50"
																	value={action.deadlineSeconds == null ? '' : action.deadlineSeconds % 60}
																	oninput={(e) => {
																		const raw = (e.currentTarget as HTMLInputElement).value;
																		if (raw === '') {
																			action.deadlineSeconds = undefined;
																			return;
																		}
																		let ss = clampNonNegInt(Number.parseInt(raw, 10) || 0);
																		ss = Math.min(59, ss);
																		const mm =
																			action.deadlineSeconds != null
																				? Math.floor(action.deadlineSeconds / 60)
																				: 0;
																		action.deadlineSeconds = mm * 60 + ss;
																	}}
																/>
															</div>
															<div class="rounded-md border border-amber-200/60 bg-background/90 px-2.5 py-1.5 dark:border-amber-900/40">
																<p class="text-[9px] font-bold uppercase text-muted-foreground">Total</p>
																<p class="text-xs font-bold tabular-nums">
																	{#if action.deadlineSeconds != null}
																		{formatDurationShort(action.deadlineSeconds)}
																		<span class="ml-1 text-[10px] font-normal text-muted-foreground"
																			>({action.deadlineSeconds} s)</span
																		>
																	{:else}
																		<span class="text-muted-foreground">No deadline</span>
																	{/if}
																</p>
															</div>
														</div>
														<p class="text-[10px] text-amber-900/70 dark:text-amber-200/70">
															Clear both fields to remove the deadline. Shown on the preview strip as an amber tick.
														</p>
													</div>
													<label class="flex cursor-pointer items-center gap-2 rounded-md border border-amber-200/60 bg-background px-3 py-2 text-sm font-medium dark:border-amber-900/40">
														<input type="checkbox" bind:checked={action.critical} class="size-4 rounded border-input" />
														Critical (highlight in review)
													</label>
												</div>
											</div>
										</div>
									</li>
								{/each}
							</ul>
						{/if}
						</div>
					</details>

					<details
						class="group rounded-xl border border-border bg-muted/10 [&_summary::-webkit-details-marker]:hidden dark:bg-muted/5"
						bind:open={selfPacedFollowupsOpen}
					>
						<summary
							class="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3.5 hover:bg-muted/30"
						>
							<div class="min-w-0 pr-2">
								<h4 class="text-base font-semibold tracking-tight">Assignment completion follow-ups</h4>
								<p class="mt-0.5 max-w-xl text-xs text-muted-foreground">
									Optional delayed dispatches after board matches—expand to add or edit.
								</p>
							</div>
							<div class="flex shrink-0 items-center gap-2">
								<Button
									type="button"
									variant="default"
									size="sm"
									onclick={(e) => {
										e.preventDefault();
										e.stopPropagation();
										addCompletionRule();
									}}
								>+ Add rule</Button>
								<span class="text-muted-foreground transition-transform duration-200 group-open:rotate-180" aria-hidden="true"
									>▼</span
								>
							</div>
						</summary>
						<div class="border-t border-border/60 px-4 pb-4 pt-2">
						{#if selfPacedConfig.assignmentCompletions.length === 0}
							<p class="rounded-lg border-2 border-dashed border-muted-foreground/25 bg-background px-4 py-6 text-center text-sm text-muted-foreground">
								Add a rule to fire an automatic update after a unit lands on the board with the right task.
							</p>
						{:else}
							<ul class="mt-4 flex list-none flex-col gap-4 pl-0" role="list">
								{#each selfPacedConfig.assignmentCompletions as rule, ri (rule.id)}
									<li
										class="relative overflow-hidden rounded-xl border-2 border-border bg-card shadow-sm ring-1 ring-black/5 dark:ring-white/10"
									>
										<div class="absolute left-0 top-0 h-full w-1.5 bg-violet-500" aria-hidden="true"></div>
										<div class="pl-4 sm:pl-5">
											<div
												class="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-violet-50/90 px-3 py-3 sm:px-4 dark:bg-violet-950/30"
											>
												<div class="flex flex-wrap items-center gap-2">
													<span
														class="inline-flex h-8 min-w-[2rem] items-center justify-center rounded-lg bg-violet-600 px-2.5 text-sm font-bold text-white shadow-sm"
													>
														{ri + 1}
													</span>
													<span class="text-xs font-semibold uppercase tracking-wide text-violet-900 dark:text-violet-100">
														Follow-up rule
													</span>
												</div>
												<Button
													type="button"
													variant="outline"
													size="sm"
													class="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
													onclick={() => removeCompletionRule(rule.id)}
												>
													Remove
												</Button>
											</div>
											<div class="space-y-4 px-3 py-4 sm:px-4">
												<div class="space-y-1.5">
													<label class="text-xs font-semibold text-foreground" for={`ac-label-${rule.id}`}>
														Label <span class="font-normal text-muted-foreground">(optional)</span>
													</label>
													<Input
														id={`ac-label-${rule.id}`}
														placeholder="e.g., Primary search complete"
														class="border-input/80"
														bind:value={rule.label}
													/>
												</div>
												<div class="space-y-2">
													<p class="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Trigger</p>
													<div class="grid gap-3 rounded-lg border border-border/80 bg-muted/30 p-3 sm:grid-cols-2 dark:bg-muted/20">
														<div class="space-y-1.5">
															<label class="text-xs font-semibold" for={`ac-unit-${rule.id}`}>Unit name contains</label>
															<Input id={`ac-unit-${rule.id}`} placeholder="e.g., Truck 1" bind:value={rule.trigger.unitName} />
														</div>
														<div class="space-y-1.5">
															<label class="text-xs font-semibold" for={`ac-asg-${rule.id}`}>Assignment contains</label>
															<Input id={`ac-asg-${rule.id}`} placeholder="e.g., search" bind:value={rule.trigger.assignmentContains} />
														</div>
													</div>
												</div>
												<div class="grid gap-3 sm:grid-cols-2">
													<div class="space-y-2 rounded-lg border-2 border-violet-200/80 bg-violet-50/60 p-3 dark:border-violet-900/50 dark:bg-violet-950/35">
														<label class="text-xs font-semibold text-violet-950 dark:text-violet-100" for={`ac-delay-min-${rule.id}`}>
															Delay before dispatch
														</label>
														<div class="flex flex-wrap items-end gap-2">
															<div class="space-y-1">
																<span class="text-[10px] text-violet-900/80 dark:text-violet-200/80">Minutes</span>
																<Input
																	id={`ac-delay-min-${rule.id}`}
																	type="number"
																	min="0"
																	step="1"
																	class="h-9 w-[4.5rem] border-violet-200/80 font-semibold tabular-nums dark:border-violet-900/50"
																	value={Math.floor(clampNonNegInt(rule.delaySeconds ?? 0) / 60)}
																	oninput={(e) => {
																		const mm = clampNonNegInt(
																			Number.parseInt((e.currentTarget as HTMLInputElement).value, 10) || 0
																		);
																		const ss = clampNonNegInt(rule.delaySeconds ?? 0) % 60;
																		rule.delaySeconds = mm * 60 + ss;
																	}}
																/>
															</div>
															<div class="space-y-1">
																<span class="text-[10px] text-violet-900/80 dark:text-violet-200/80">Seconds (0–59)</span>
																<Input
																	id={`ac-delay-sec-${rule.id}`}
																	type="number"
																	min="0"
																	max="59"
																	step="1"
																	class="h-9 w-[4.5rem] border-violet-200/80 font-semibold tabular-nums dark:border-violet-900/50"
																	value={clampNonNegInt(rule.delaySeconds ?? 0) % 60}
																	oninput={(e) => {
																		let ss = clampNonNegInt(
																			Number.parseInt((e.currentTarget as HTMLInputElement).value, 10) || 0
																		);
																		ss = Math.min(59, ss);
																		const mm = Math.floor(clampNonNegInt(rule.delaySeconds ?? 0) / 60);
																		rule.delaySeconds = mm * 60 + ss;
																	}}
																/>
															</div>
														</div>
														<p class="text-[10px] text-violet-900/75 dark:text-violet-200/75">
															Total wait: <strong class="font-semibold text-violet-950 dark:text-violet-50"
																>{formatDurationShort(clampNonNegInt(rule.delaySeconds ?? 0))}</strong
															>
															({clampNonNegInt(rule.delaySeconds ?? 0)} s)
														</p>
													</div>
													<div class="space-y-1.5 rounded-lg border-2 border-blue-200/80 bg-blue-50/70 p-3 sm:col-span-1 dark:border-blue-900/50 dark:bg-blue-950/35">
														<label class="text-xs font-semibold text-blue-950 dark:text-blue-100" for={`ac-update-${rule.id}`}>
															Dispatched update
														</label>
														<Input
															id={`ac-update-${rule.id}`}
															placeholder="e.g., Primary all-clear from Truck 1"
															class="border-blue-200/80 dark:border-blue-900/50"
															bind:value={rule.dispatch.update}
														/>
													</div>
												</div>
											</div>
										</div>
									</li>
								{/each}
							</ul>
						{/if}
						</div>
					</details>
				{/if}

				<div class="flex items-center justify-end gap-3">
					{#if selfPacedSaveMsg}
						<span class="text-xs text-muted-foreground">{selfPacedSaveMsg}</span>
					{/if}
					<Button type="button" onclick={saveSelfPaced} disabled={isSavingSelfPaced}>
						{#if isSavingSelfPaced}<Spinner class="mr-2 h-4 w-4" />Saving…{:else}Save script{/if}
					</Button>
				</div>
			</Card.Content>
		</Card.Root>
	</div>
</div>
