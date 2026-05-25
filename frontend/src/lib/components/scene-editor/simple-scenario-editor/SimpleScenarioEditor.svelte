<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import type {
		AssignmentMatch,
		AssignmentCompletionRule,
		SelfPacedConfig,
		TimelineEvent
	} from '$lib/self-paced';
	import {
		bucketSimpleScenario,
		rebuildTimelineFromSimpleSections,
		SIMPLE_SIDES,
		SIMPLE_STAGES,
		STAGE_THEME,
		type SimpleArrival,
		type SimpleScenarioSections,
		type SimpleStageEvent,
		type SimpleStageKey
	} from './stage-mapping';
	import {
		ACTION_PRESET_GROUPS,
		createRuleFromPreset,
		presetsForGroup,
		type ActionPresetGroup
	} from './action-presets';
	import { resetArrivalStagger, scrambleArrivalOffsets } from './arrival-utils';

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
	let newActionPhraseByRule = $state<Record<string, string>>({});

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
			for (const unitName of action.match.unitNames ?? []) addName(unitName);
		}
		for (const rule of config.assignmentCompletions) {
			addName(rule.trigger.unitName);
			for (const unitName of rule.trigger.unitNames ?? []) addName(unitName);
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

	function updateActionRules(rules: AssignmentCompletionRule[]) {
		config = {
			...config,
			assignmentCompletions: rules
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

	function addActionUpdate() {
		const next: AssignmentCompletionRule = {
			id: uid('action-update'),
			label: '',
			trigger: { unitName: unitOptions[0] ?? '', assignmentContains: '' },
			delaySeconds: 60,
			dispatch: { update: '' }
		};
		updateActionRules([...config.assignmentCompletions, next]);
	}

	function addPresetRules(group: ActionPresetGroup) {
		const presets = presetsForGroup(group);
		const rules = presets.map((preset) => createRuleFromPreset(preset, unitOptions));
		updateActionRules([...config.assignmentCompletions, ...rules]);
	}

	function scrambleArrivals() {
		if (sections.arrivals.length < 2) return;
		commit({
			...sections,
			arrivals: scrambleArrivalOffsets(sections.arrivals)
		});
	}

	function resetArrivalsStagger() {
		if (sections.arrivals.length === 0) return;
		commit({
			...sections,
			arrivals: resetArrivalStagger(sections.arrivals)
		});
	}

	function removeActionUpdate(id: string) {
		updateActionRules(config.assignmentCompletions.filter((rule) => rule.id !== id));
	}

	function updateActionUpdate(id: string, patch: Partial<AssignmentCompletionRule>) {
		updateActionRules(
			config.assignmentCompletions.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule))
		);
	}

	function updateActionTrigger(id: string, patch: Partial<AssignmentCompletionRule['trigger']>) {
		updateActionRules(
			config.assignmentCompletions.map((rule) =>
				rule.id === id ? { ...rule, trigger: { ...rule.trigger, ...patch } } : rule
			)
		);
	}

	function updateActionDispatch(id: string, patch: Partial<AssignmentCompletionRule['dispatch']>) {
		updateActionRules(
			config.assignmentCompletions.map((rule) =>
				rule.id === id ? { ...rule, dispatch: { ...rule.dispatch, ...patch } } : rule
			)
		);
	}

	function compactStrings(values: Array<string | undefined> | undefined): string[] {
		const out: string[] = [];
		for (const value of values ?? []) {
			const trimmed = value?.trim();
			if (trimmed && !out.includes(trimmed)) out.push(trimmed);
		}
		return out;
	}

	function matchUnitNames(match: AssignmentMatch): string[] {
		return compactStrings([match.unitName, ...(match.unitNames ?? [])]);
	}

	function matchAssignmentPhrases(match: AssignmentMatch): string[] {
		return compactStrings([match.assignmentContains, ...(match.assignmentContainsAny ?? [])]);
	}

	function toggleActionUnit(id: string, unitName: string, isSelected: boolean) {
		const rule = config.assignmentCompletions.find((item) => item.id === id);
		if (!rule) return;
		const current = matchUnitNames(rule.trigger);
		const unitNames = isSelected
			? compactStrings([...current, unitName])
			: current.filter((name) => name !== unitName);
		updateActionTrigger(id, {
			unitName: undefined,
			unitNames: unitNames.length > 0 ? unitNames : undefined
		});
	}

	function setNewActionPhrase(id: string, value: string) {
		newActionPhraseByRule = { ...newActionPhraseByRule, [id]: value };
	}

	function addActionPhrase(id: string) {
		const phrase = newActionPhraseByRule[id]?.trim();
		if (!phrase) return;
		const rule = config.assignmentCompletions.find((item) => item.id === id);
		if (!rule) return;
		const assignmentContainsAny = compactStrings([...matchAssignmentPhrases(rule.trigger), phrase]);
		updateActionTrigger(id, {
			assignmentContains: undefined,
			assignmentContainsAny
		});
		setNewActionPhrase(id, '');
	}

	function removeActionPhrase(id: string, phrase: string) {
		const rule = config.assignmentCompletions.find((item) => item.id === id);
		if (!rule) return;
		const assignmentContainsAny = matchAssignmentPhrases(rule.trigger).filter((item) => item !== phrase);
		updateActionTrigger(id, {
			assignmentContains: undefined,
			assignmentContainsAny: assignmentContainsAny.length > 0 ? assignmentContainsAny : undefined
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
			<div class="flex flex-wrap gap-2">
				{#if sections.arrivals.length >= 2}
					<Button type="button" size="sm" variant="outline" onclick={scrambleArrivals}>
						Scramble times
					</Button>
				{/if}
				{#if sections.arrivals.length > 0}
					<Button type="button" size="sm" variant="outline" onclick={resetArrivalsStagger}>
						Reset stagger
					</Button>
				{/if}
				<Button type="button" size="sm" variant="outline" onclick={() => addArrival()}>
					+ Add arrival
				</Button>
			</div>
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

	<section class="space-y-3 rounded-xl border bg-background p-4">
		<div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
			<div>
				<div class="flex flex-wrap items-center gap-2">
					<h5 class="font-semibold">Action updates</h5>
					<Badge variant="outline">{config.assignmentCompletions.length} rules</Badge>
				</div>
				<p class="mt-1 text-xs text-muted-foreground">
					Trigger a delayed update after a student assigns any selected unit to any selected task.
					The triggering unit name is added automatically (e.g. engine 2: grabbed a supply line).
				</p>
			</div>
			<Button type="button" size="sm" variant="outline" onclick={addActionUpdate}>
				+ Add action update
			</Button>
		</div>

		<div class="rounded-lg border border-dashed border-muted-foreground/25 bg-muted/10 p-3">
			<p class="text-xs font-medium text-foreground">Quick presets</p>
			<p class="mt-0.5 text-[11px] text-muted-foreground">
				Add a full set of common company work rules. Units are matched by name (Engine, Truck,
				Ladder, Rescue, etc.).
			</p>
			<div class="mt-2 flex flex-wrap gap-2">
				{#each ACTION_PRESET_GROUPS as group (group.key)}
					<Button
						type="button"
						size="sm"
						variant="secondary"
						onclick={() => addPresetRules(group.key)}
					>
						+ {group.label} work
					</Button>
				{/each}
			</div>
		</div>

		{#if config.assignmentCompletions.length === 0}
			<p
				class="rounded-lg border-2 border-dashed border-muted-foreground/25 px-4 py-5 text-center text-sm text-muted-foreground"
			>
				No action updates yet. Add one for delayed feedback after a unit gets assigned.
			</p>
		{:else}
			<div class="space-y-2">
				{#each config.assignmentCompletions as rule (rule.id)}
					<div
						class="grid gap-3 rounded-lg border bg-muted/15 p-3 xl:grid-cols-[minmax(14rem,1fr)_minmax(14rem,1fr)_auto_auto_minmax(14rem,1.4fr)_auto] xl:items-start"
					>
						<div class="space-y-2">
							<p class="text-xs font-medium">When unit</p>
							<div class="rounded-md border border-input bg-background p-2">
								{#if unitOptions.length === 0}
									<p class="text-xs text-muted-foreground">Any unit</p>
								{:else}
									<div class="max-h-32 space-y-1 overflow-auto">
										{#each unitOptions as unitName (unitName)}
											<label class="flex items-center gap-2 text-sm">
												<input
													type="checkbox"
													checked={matchUnitNames(rule.trigger).includes(unitName)}
													onchange={(event) =>
														toggleActionUnit(
															rule.id,
															unitName,
															(event.currentTarget as HTMLInputElement).checked
														)}
												/>
												<span>{unitName}</span>
											</label>
										{/each}
									</div>
									{#if matchUnitNames(rule.trigger).length === 0}
										<p class="mt-2 text-[11px] text-muted-foreground">Any unit can trigger this.</p>
									{/if}
								{/if}
							</div>
						</div>
						<div class="space-y-2">
							<label class="text-xs font-medium" for={`action-assignment-${rule.id}`}>
								Assignment phrases
							</label>
							<div class="flex gap-2">
								<Input
									id={`action-assignment-${rule.id}`}
									placeholder="e.g., primary search"
									value={newActionPhraseByRule[rule.id] ?? ''}
									oninput={(event) =>
										setNewActionPhrase(rule.id, (event.currentTarget as HTMLInputElement).value)}
									onkeydown={(event) => {
										if (event.key !== 'Enter') return;
										event.preventDefault();
										addActionPhrase(rule.id);
									}}
								/>
								<Button type="button" size="sm" variant="outline" onclick={() => addActionPhrase(rule.id)}>
									Add
								</Button>
							</div>
							{#if matchAssignmentPhrases(rule.trigger).length === 0}
								<p class="text-[11px] text-muted-foreground">
									Add at least one phrase, like primary search or cut the roof.
								</p>
							{:else}
								<div class="flex flex-wrap gap-1.5">
									{#each matchAssignmentPhrases(rule.trigger) as phrase (phrase)}
										<button
											type="button"
											class="rounded-full border bg-background px-2 py-1 text-xs hover:bg-muted"
											onclick={() => removeActionPhrase(rule.id, phrase)}
											aria-label={`Remove ${phrase}`}
										>
											{phrase} ×
										</button>
									{/each}
								</div>
							{/if}
						</div>
						<div class="space-y-1.5">
							<label class="text-xs font-medium" for={`action-delay-min-${rule.id}`}
								>After min</label
							>
							<Input
								id={`action-delay-min-${rule.id}`}
								type="number"
								min="0"
								step="1"
								class="w-20"
								value={Math.floor((rule.delaySeconds ?? 0) / 60)}
								oninput={(event) =>
									updateActionUpdate(rule.id, {
										delaySeconds: setMinutes(
											rule.delaySeconds ?? 0,
											(event.currentTarget as HTMLInputElement).value
										)
									})}
							/>
						</div>
						<div class="space-y-1.5">
							<label class="text-xs font-medium" for={`action-delay-sec-${rule.id}`}>Sec</label>
							<Input
								id={`action-delay-sec-${rule.id}`}
								type="number"
								min="0"
								max="59"
								step="1"
								class="w-20"
								value={(rule.delaySeconds ?? 0) % 60}
								oninput={(event) =>
									updateActionUpdate(rule.id, {
										delaySeconds: setSeconds(
											rule.delaySeconds ?? 0,
											(event.currentTarget as HTMLInputElement).value
										)
									})}
							/>
						</div>
						<div class="space-y-1.5">
							<label class="text-xs font-medium" for={`action-update-${rule.id}`}>Send update</label
							>
							<Input
								id={`action-update-${rule.id}`}
								placeholder="e.g., grabbed a supply line"
								value={rule.dispatch.update ?? ''}
								oninput={(event) =>
									updateActionDispatch(rule.id, {
										update: (event.currentTarget as HTMLInputElement).value
									})}
							/>
						</div>
						<Button
							type="button"
							size="sm"
							variant="outline"
							onclick={() => removeActionUpdate(rule.id)}
						>
							Remove
						</Button>
					</div>
				{/each}
			</div>
		{/if}
	</section>

	{#each SIMPLE_STAGES as stage (stage.key)}
		{@const section = getStage(stage.key)}
		{@const nextStart = getNextStageStart(stage.key)}
		{@const theme = STAGE_THEME[stage.key]}
		<section class="relative space-y-3 overflow-hidden rounded-xl border p-4 {theme.section}">
			<div class="absolute top-0 left-0 h-full w-1.5 {theme.rail}" aria-hidden="true"></div>
			<div class="pl-2">
			<div class="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
				<div>
					<div class="flex flex-wrap items-center gap-2">
						<h5 class="font-semibold">{stage.label}</h5>
						<Badge variant="outline" class={theme.badge}>{section.events.length} events</Badge>
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
			</div>
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
