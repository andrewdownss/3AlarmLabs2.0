<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import type { SelfPacedConfig, TimelineEvent } from '$lib/self-paced';
	import {
		bucketSimpleScenario,
		rebuildTimelineFromSimpleSections,
		SIMPLE_SIDES,
		SIMPLE_STAGES,
		type SimpleArrival,
		type SimpleScenarioSections,
		type SimpleStageEvent,
		type SimpleStageKey
	} from './stage-mapping';

	interface DefaultResource {
		unitName: string;
		status?: string;
	}

	interface Props {
		config: SelfPacedConfig;
		defaultResources: DefaultResource[];
	}

	let { config = $bindable(), defaultResources }: Props = $props();
	let sections = $state<SimpleScenarioSections>(bucketSimpleScenario(config));
	let newUnitName = $state('');

	const STAGE_LABELS = Object.fromEntries(
		SIMPLE_STAGES.map((stage) => [stage.key, stage.label])
	) as Record<SimpleStageKey, string>;

	const unitOptions = $derived.by(() => {
		const names: string[] = [];
		const addName = (name: string | undefined) => {
			const trimmed = name?.trim();
			if (trimmed && !names.includes(trimmed)) names.push(trimmed);
		};
		for (const resource of defaultResources ?? []) {
			addName(resource.unitName);
		}
		for (const arrival of sections.arrivals) {
			addName(arrival.unitName);
		}
		for (const action of config.expectedActions) {
			addName(action.match.unitName);
		}
		for (const rule of config.assignmentCompletions) {
			addName(rule.trigger.unitName);
		}
		return names.sort((a, b) => a.localeCompare(b));
	});

	const stageWarnings = $derived(getStageWarnings(sections));
	const hasUnscheduled = $derived(sections.unscheduled.length > 0);

	function uid(prefix: string): string {
		return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 10)}`;
	}

	function clampNonNegInt(value: number): number {
		return Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
	}

	function formatDurationShort(totalSec: number): string {
		const seconds = clampNonNegInt(totalSec);
		const minutes = Math.floor(seconds / 60);
		const remainder = seconds % 60;
		return minutes > 0 ? `${minutes}m ${remainder}s` : `${remainder}s`;
	}

	function commit(nextSections = sections) {
		sections = nextSections;
		config = {
			...config,
			timeline: rebuildTimelineFromSimpleSections(nextSections)
		};
	}

	function addArrival(unitName = '') {
		const trimmed = unitName.trim();
		const fallback = unitOptions[0] ?? '';
		commit({
			...sections,
			arrivals: [
				...sections.arrivals,
				{ id: uid('arrival'), unitName: trimmed || fallback, offsetSeconds: 0 }
			]
		});
		newUnitName = '';
	}

	function removeArrival(id: string) {
		commit({
			...sections,
			arrivals: sections.arrivals.filter((arrival) => arrival.id !== id)
		});
	}

	function updateArrival(id: string, patch: Partial<SimpleArrival>) {
		commit({
			...sections,
			arrivals: sections.arrivals.map((arrival) =>
				arrival.id === id ? { ...arrival, ...patch } : arrival
			)
		});
	}

	function getStage(stageKey: SimpleStageKey) {
		return sections.stages.find((stage) => stage.stage === stageKey)!;
	}

	function updateStageStart(stageKey: SimpleStageKey, startSeconds: number | undefined) {
		commit({
			...sections,
			stages: sections.stages.map((stage) =>
				stage.stage === stageKey ? { ...stage, startSeconds } : stage
			)
		});
	}

	function addStageEvent(stageKey: SimpleStageKey, kind: 'event' | 'hazard') {
		const stage = getStage(stageKey);
		const offsetSeconds = stage.startSeconds ?? 0;
		const event: SimpleStageEvent = {
			id: uid('stage-event'),
			offsetSeconds,
			label: '',
			dispatch: kind === 'hazard' ? { hazard: '', side: 'alpha' } : { update: '' }
		};
		commit({
			...sections,
			stages: sections.stages.map((item) =>
				item.stage === stageKey ? { ...item, events: [...item.events, event] } : item
			)
		});
	}

	function removeStageEvent(stageKey: SimpleStageKey, eventId: string) {
		commit({
			...sections,
			stages: sections.stages.map((stage) =>
				stage.stage === stageKey
					? { ...stage, events: stage.events.filter((event) => event.id !== eventId) }
					: stage
			)
		});
	}

	function updateStageEvent(
		stageKey: SimpleStageKey,
		eventId: string,
		patch: Partial<SimpleStageEvent>
	) {
		commit({
			...sections,
			stages: sections.stages.map((stage) =>
				stage.stage === stageKey
					? {
							...stage,
							events: stage.events.map((event) =>
								event.id === eventId ? { ...event, ...patch } : event
							)
						}
					: stage
			)
		});
	}

	function updateStageEventDispatch(
		stageKey: SimpleStageKey,
		eventId: string,
		patch: Partial<TimelineEvent['dispatch']>
	) {
		commit({
			...sections,
			stages: sections.stages.map((stage) =>
				stage.stage === stageKey
					? {
							...stage,
							events: stage.events.map((event) =>
								event.id === eventId
									? { ...event, dispatch: { ...event.dispatch, ...patch } }
									: event
							)
						}
					: stage
			)
		});
	}

	function removeUnscheduled(id: string) {
		commit({
			...sections,
			unscheduled: sections.unscheduled.filter((event) => event.id !== id)
		});
	}

	function setMinutes(currentSeconds: number | undefined, minutes: string): number {
		const parsed = clampNonNegInt(Number.parseInt(minutes, 10) || 0);
		const seconds = clampNonNegInt(currentSeconds ?? 0) % 60;
		return parsed * 60 + seconds;
	}

	function setSeconds(currentSeconds: number | undefined, seconds: string): number {
		const parsed = Math.min(59, clampNonNegInt(Number.parseInt(seconds, 10) || 0));
		const minutes = Math.floor(clampNonNegInt(currentSeconds ?? 0) / 60);
		return minutes * 60 + parsed;
	}

	function getNextStageStart(stageKey: SimpleStageKey): number | undefined {
		const index = sections.stages.findIndex((stage) => stage.stage === stageKey);
		for (const stage of sections.stages.slice(index + 1)) {
			if (stage.startSeconds != null) return stage.startSeconds;
		}
		return undefined;
	}

	function getStageWarnings(value: SimpleScenarioSections): string[] {
		const warnings: string[] = [];
		let previousStart: number | undefined;
		for (const stage of value.stages) {
			if (stage.startSeconds == null) continue;
			if (previousStart != null && stage.startSeconds < previousStart) {
				warnings.push('Stage start times should increase from Incipient through Decay.');
				break;
			}
			previousStart = stage.startSeconds;
		}
		for (const stage of value.stages) {
			if (stage.startSeconds == null) continue;
			const nextStage = value.stages
				.slice(value.stages.findIndex((item) => item.stage === stage.stage) + 1)
				.find((item) => item.startSeconds != null);
			for (const event of stage.events) {
				if (event.offsetSeconds < stage.startSeconds) {
					warnings.push(`${STAGE_LABELS[stage.stage]} has an event before its stage start.`);
					break;
				}
				if (nextStage?.startSeconds != null && event.offsetSeconds >= nextStage.startSeconds) {
					warnings.push(`${STAGE_LABELS[stage.stage]} has an event after the next stage starts.`);
					break;
				}
			}
		}
		return warnings.filter((warning, index) => warnings.indexOf(warning) === index);
	}
</script>

<div class="space-y-5 rounded-xl border border-border bg-muted/10 p-4 dark:bg-muted/5">
	<div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
		<div>
			<h4 class="text-base font-semibold tracking-tight">Simple scenario builder</h4>
			<p class="mt-0.5 max-w-2xl text-xs text-muted-foreground">
				Set unit arrivals and organize hazards or dispatch updates inside the fire stage where they
				happen.
			</p>
		</div>
		<Badge variant="secondary">{config.timeline.length} timeline events</Badge>
	</div>

	{#if stageWarnings.length > 0}
		<div
			class="rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100"
		>
			<p class="font-medium">Review timing</p>
			<ul class="mt-1 list-disc space-y-0.5 pl-4 text-xs">
				{#each stageWarnings as warning (warning)}
					<li>{warning}</li>
				{/each}
			</ul>
		</div>
	{/if}

	<section class="space-y-3 rounded-xl border bg-background p-4">
		<div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
			<div>
				<h5 class="font-semibold">Arrivals</h5>
				<p class="text-xs text-muted-foreground">
					Choose from this scenario's resources and set when each unit arrives.
				</p>
			</div>
			<Button type="button" size="sm" variant="outline" onclick={() => addArrival()}>
				+ Add arrival
			</Button>
		</div>

		{#if sections.arrivals.length === 0}
			<p
				class="rounded-lg border-2 border-dashed border-muted-foreground/25 px-4 py-5 text-center text-sm text-muted-foreground"
			>
				No arrivals yet. Add your first due company above.
			</p>
		{:else}
			<div class="space-y-2">
				{#each sections.arrivals as arrival (arrival.id)}
					<div
						class="grid gap-2 rounded-lg border bg-muted/15 p-3 sm:grid-cols-[minmax(10rem,1fr)_auto_auto_auto] sm:items-end"
					>
						<div class="space-y-1.5">
							<label class="text-xs font-medium" for={`arrival-unit-${arrival.id}`}>Unit</label>
							<select
								id={`arrival-unit-${arrival.id}`}
								value={arrival.unitName}
								onchange={(event) =>
									updateArrival(arrival.id, {
										unitName: (event.currentTarget as HTMLSelectElement).value
									})}
								class="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
							>
								<option value="">Select unit...</option>
								{#each unitOptions as unitName (unitName)}
									<option value={unitName}>{unitName}</option>
								{/each}
							</select>
						</div>
						<div class="space-y-1.5">
							<label class="text-xs font-medium" for={`arrival-min-${arrival.id}`}>Min</label>
							<Input
								id={`arrival-min-${arrival.id}`}
								type="number"
								min="0"
								step="1"
								class="w-20"
								value={Math.floor(arrival.offsetSeconds / 60)}
								oninput={(event) =>
									updateArrival(arrival.id, {
										offsetSeconds: setMinutes(
											arrival.offsetSeconds,
											(event.currentTarget as HTMLInputElement).value
										)
									})}
							/>
						</div>
						<div class="space-y-1.5">
							<label class="text-xs font-medium" for={`arrival-sec-${arrival.id}`}>Sec</label>
							<Input
								id={`arrival-sec-${arrival.id}`}
								type="number"
								min="0"
								max="59"
								step="1"
								class="w-20"
								value={arrival.offsetSeconds % 60}
								oninput={(event) =>
									updateArrival(arrival.id, {
										offsetSeconds: setSeconds(
											arrival.offsetSeconds,
											(event.currentTarget as HTMLInputElement).value
										)
									})}
							/>
						</div>
						<Button
							type="button"
							size="sm"
							variant="outline"
							onclick={() => removeArrival(arrival.id)}
						>
							Remove
						</Button>
					</div>
				{/each}
			</div>
		{/if}

		<div class="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-end">
			<div class="space-y-1.5 sm:w-64">
				<label class="text-xs font-medium" for="simple-new-unit">Add custom unit to arrivals</label>
				<Input
					id="simple-new-unit"
					bind:value={newUnitName}
					placeholder="e.g., Engine 1"
					onkeydown={(event) => {
						if (event.key !== 'Enter') return;
						event.preventDefault();
						if (newUnitName.trim()) addArrival(newUnitName);
					}}
				/>
			</div>
			<Button
				type="button"
				variant="outline"
				disabled={!newUnitName.trim()}
				onclick={() => addArrival(newUnitName)}
			>
				Add custom arrival
			</Button>
		</div>
	</section>

	{#each SIMPLE_STAGES as stage (stage.key)}
		{@const section = getStage(stage.key)}
		{@const nextStart = getNextStageStart(stage.key)}
		<section class="space-y-3 rounded-xl border bg-background p-4">
			<div class="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
				<div>
					<div class="flex flex-wrap items-center gap-2">
						<h5 class="font-semibold">{stage.label}</h5>
						<Badge variant="outline">{section.events.length} events</Badge>
					</div>
					<p class="mt-1 text-xs text-muted-foreground">
						Stage starts at
						{#if section.startSeconds != null}
							<strong class="font-medium text-foreground"
								>{formatDurationShort(section.startSeconds)}</strong
							>
						{:else}
							<strong class="font-medium text-foreground">not set</strong>
						{/if}
						{#if nextStart != null}
							and runs until {formatDurationShort(nextStart)}.
						{/if}
					</p>
				</div>
				<div class="flex flex-wrap items-end gap-2">
					<div class="space-y-1.5">
						<label class="text-xs font-medium" for={`stage-min-${stage.key}`}>Start min</label>
						<Input
							id={`stage-min-${stage.key}`}
							type="number"
							min="0"
							step="1"
							class="w-20"
							value={section.startSeconds == null ? '' : Math.floor(section.startSeconds / 60)}
							oninput={(event) => {
								const raw = (event.currentTarget as HTMLInputElement).value;
								updateStageStart(
									stage.key,
									raw === '' ? undefined : setMinutes(section.startSeconds, raw)
								);
							}}
						/>
					</div>
					<div class="space-y-1.5">
						<label class="text-xs font-medium" for={`stage-sec-${stage.key}`}>Start sec</label>
						<Input
							id={`stage-sec-${stage.key}`}
							type="number"
							min="0"
							max="59"
							step="1"
							class="w-20"
							value={section.startSeconds == null ? '' : section.startSeconds % 60}
							oninput={(event) => {
								const raw = (event.currentTarget as HTMLInputElement).value;
								updateStageStart(
									stage.key,
									raw === '' ? undefined : setSeconds(section.startSeconds, raw)
								);
							}}
						/>
					</div>
					<Button
						type="button"
						size="sm"
						variant="outline"
						onclick={() => addStageEvent(stage.key, 'event')}
					>
						+ Add event
					</Button>
					<Button
						type="button"
						size="sm"
						variant="outline"
						onclick={() => addStageEvent(stage.key, 'hazard')}
					>
						+ Add hazard
					</Button>
				</div>
			</div>

			{#if section.events.length === 0}
				<p
					class="rounded-lg border-2 border-dashed border-muted-foreground/25 px-4 py-5 text-center text-sm text-muted-foreground"
				>
					No events in this stage yet.
				</p>
			{:else}
				<div class="space-y-2">
					{#each section.events as event (event.id)}
						<div
							class="grid gap-2 rounded-lg border bg-muted/15 p-3 lg:grid-cols-[auto_auto_minmax(8rem,10rem)_minmax(10rem,1fr)_minmax(10rem,1fr)_auto] lg:items-end"
						>
							<div class="space-y-1.5">
								<label class="text-xs font-medium" for={`event-min-${event.id}`}>Min</label>
								<Input
									id={`event-min-${event.id}`}
									type="number"
									min="0"
									step="1"
									class="w-20"
									value={Math.floor(event.offsetSeconds / 60)}
									oninput={(inputEvent) =>
										updateStageEvent(stage.key, event.id, {
											offsetSeconds: setMinutes(
												event.offsetSeconds,
												(inputEvent.currentTarget as HTMLInputElement).value
											)
										})}
								/>
							</div>
							<div class="space-y-1.5">
								<label class="text-xs font-medium" for={`event-sec-${event.id}`}>Sec</label>
								<Input
									id={`event-sec-${event.id}`}
									type="number"
									min="0"
									max="59"
									step="1"
									class="w-20"
									value={event.offsetSeconds % 60}
									oninput={(inputEvent) =>
										updateStageEvent(stage.key, event.id, {
											offsetSeconds: setSeconds(
												event.offsetSeconds,
												(inputEvent.currentTarget as HTMLInputElement).value
											)
										})}
								/>
							</div>
							<div class="space-y-1.5">
								<label class="text-xs font-medium" for={`event-side-${event.id}`}>Side</label>
								<select
									id={`event-side-${event.id}`}
									value={event.dispatch.side}
									onchange={(inputEvent) =>
										updateStageEventDispatch(stage.key, event.id, {
											side: ((inputEvent.currentTarget as HTMLSelectElement).value ||
												undefined) as TimelineEvent['dispatch']['side']
										})}
									class="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
								>
									<option value="">No change</option>
									{#each SIMPLE_SIDES as side (side.key)}
										<option value={side.key}>{side.label}</option>
									{/each}
								</select>
							</div>
							<div class="space-y-1.5">
								<label class="text-xs font-medium" for={`event-hazard-${event.id}`}>Hazard</label>
								<Input
									id={`event-hazard-${event.id}`}
									placeholder="e.g., Collapse hazard"
									value={event.dispatch.hazard ?? ''}
									oninput={(inputEvent) =>
										updateStageEventDispatch(stage.key, event.id, {
											hazard: (inputEvent.currentTarget as HTMLInputElement).value
										})}
								/>
							</div>
							<div class="space-y-1.5">
								<label class="text-xs font-medium" for={`event-update-${event.id}`}>Update</label>
								<Input
									id={`event-update-${event.id}`}
									placeholder="e.g., Heavy fire showing"
									value={event.dispatch.update ?? ''}
									oninput={(inputEvent) =>
										updateStageEventDispatch(stage.key, event.id, {
											update: (inputEvent.currentTarget as HTMLInputElement).value
										})}
								/>
							</div>
							<Button
								type="button"
								size="sm"
								variant="outline"
								onclick={() => removeStageEvent(stage.key, event.id)}
							>
								Remove
							</Button>
						</div>
					{/each}
				</div>
			{/if}
		</section>
	{/each}

	{#if hasUnscheduled}
		<section
			class="space-y-3 rounded-xl border border-amber-300/60 bg-amber-50/70 p-4 dark:border-amber-900/60 dark:bg-amber-950/25"
		>
			<div>
				<h5 class="font-semibold text-amber-950 dark:text-amber-100">Unscheduled</h5>
				<p class="mt-1 text-xs text-amber-900/80 dark:text-amber-100/80">
					These Advanced events could not be assigned to a stage. They will still be saved unless
					you remove them.
				</p>
			</div>
			<div class="space-y-2">
				{#each sections.unscheduled as event (event.id)}
					<div
						class="flex flex-col gap-2 rounded-lg border bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
					>
						<div class="min-w-0">
							<p class="text-sm font-medium">
								{event.label?.trim() ||
									event.dispatch.update?.trim() ||
									event.dispatch.hazard?.trim() ||
									'Untitled event'}
							</p>
							<p class="text-xs text-muted-foreground">
								At {formatDurationShort(event.offsetSeconds ?? 0)}
							</p>
						</div>
						<Button
							type="button"
							size="sm"
							variant="outline"
							onclick={() => removeUnscheduled(event.id)}
						>
							Remove
						</Button>
					</div>
				{/each}
			</div>
		</section>
	{/if}
</div>
