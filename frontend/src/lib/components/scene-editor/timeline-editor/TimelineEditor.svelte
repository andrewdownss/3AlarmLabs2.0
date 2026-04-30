<script lang="ts">
	import { onDestroy } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import type { ExpectedAction, TimelineEvent } from '$lib/self-paced';
	import {
		clampSeconds,
		formatTimelineTime,
		percentToSeconds,
		secondsToPercent,
		snapSeconds
	} from './timeline-utils';

	interface Props {
		timeline: TimelineEvent[];
		expectedActions: ExpectedAction[];
		timeLimitSeconds?: number;
		axisMaxSeconds: number;
	}

	let {
		timeline = $bindable(),
		expectedActions,
		timeLimitSeconds,
		axisMaxSeconds
	}: Props = $props();

	const STAGES = [
		{ key: 'incipient', label: 'Incipient' },
		{ key: 'growth', label: 'Growth' },
		{ key: 'fully_developed', label: 'Fully Developed' },
		{ key: 'decay', label: 'Decay' }
	] as const;
	const SIDES = [
		{ key: 'alpha', label: 'Side Alpha' },
		{ key: 'bravo', label: 'Side Bravo' },
		{ key: 'charlie', label: 'Side Charlie' },
		{ key: 'delta', label: 'Side Delta' }
	] as const;

	let selectedId = $state<string | null>(null);
	let draggingId = $state<string | null>(null);
	let trackElement: HTMLDivElement | null = null;

	const sortedTimeline = $derived.by(() =>
		[...timeline].sort(
			(a, b) =>
				clampSeconds(a.offsetSeconds ?? 0, axisMaxSeconds) -
					clampSeconds(b.offsetSeconds ?? 0, axisMaxSeconds) || a.id.localeCompare(b.id)
		)
	);
	const selectedEvent = $derived(timeline.find((event) => event.id === selectedId) ?? null);
	const minuteMarkers = $derived.by(() => {
		const markers: number[] = [];
		const step = axisMaxSeconds <= 300 ? 60 : 120;
		for (let seconds = 0; seconds <= axisMaxSeconds; seconds += step) markers.push(seconds);
		if (!markers.includes(axisMaxSeconds)) markers.push(axisMaxSeconds);
		return markers;
	});

	function uid(): string {
		return globalThis.crypto?.randomUUID?.() ?? `event-${Math.random().toString(36).slice(2, 10)}`;
	}

	function updateEvent(eventId: string, patch: Partial<TimelineEvent>) {
		timeline = timeline.map((event) => (event.id === eventId ? { ...event, ...patch } : event));
	}

	function updateDispatch(eventId: string, patch: Partial<TimelineEvent['dispatch']>) {
		timeline = timeline.map((event) =>
			event.id === eventId ? { ...event, dispatch: { ...event.dispatch, ...patch } } : event
		);
	}

	function removeEvent(eventId: string) {
		timeline = timeline.filter((event) => event.id !== eventId);
		if (selectedId === eventId) selectedId = null;
	}

	function pointerSeconds(event: PointerEvent): number {
		if (!trackElement) return 0;
		const rect = trackElement.getBoundingClientRect();
		const percent = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
		return clampSeconds(snapSeconds(percentToSeconds(percent, axisMaxSeconds), 5), axisMaxSeconds);
	}

	function addEventAt(event: PointerEvent) {
		if ((event.target as HTMLElement).closest('[data-timeline-dot]')) return;
		const offsetSeconds = pointerSeconds(event);
		const next: TimelineEvent = {
			id: uid(),
			offsetSeconds,
			label: '',
			dispatch: { update: '' }
		};
		timeline = [...timeline, next];
		selectedId = next.id;
	}

	function startDrag(event: PointerEvent, eventId: string) {
		event.preventDefault();
		event.stopPropagation();
		draggingId = eventId;
		selectedId = eventId;
		window.addEventListener('pointermove', handleDrag);
		window.addEventListener('pointerup', stopDrag, { once: true });
	}

	function handleDrag(event: PointerEvent) {
		if (!draggingId) return;
		const offsetSeconds = pointerSeconds(event);
		updateEvent(draggingId, { offsetSeconds });
	}

	function stopDrag() {
		if (!draggingId) return;
		draggingId = null;
		window.removeEventListener('pointermove', handleDrag);
	}

	onDestroy(() => {
		window.removeEventListener('pointermove', handleDrag);
	});

	function nudgeEvent(event: KeyboardEvent, item: TimelineEvent) {
		if (event.key === 'Delete' || event.key === 'Backspace') {
			event.preventDefault();
			removeEvent(item.id);
			return;
		}
		if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
		event.preventDefault();
		const delta = (event.shiftKey ? 10 : 1) * (event.key === 'ArrowRight' ? 1 : -1);
		updateEvent(item.id, {
			offsetSeconds: clampSeconds((item.offsetSeconds ?? 0) + delta, axisMaxSeconds)
		});
	}
</script>

<div class="rounded-xl border border-border bg-muted/10 p-4 dark:bg-muted/5">
	<div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
		<div>
			<h4 class="text-base font-semibold tracking-tight">Visual timeline</h4>
			<p class="mt-0.5 text-xs text-muted-foreground">
				Click the track to add an event. Drag dots to retime. Select a dot to edit details.
			</p>
		</div>
		<p class="text-xs text-muted-foreground">
			Scale: 0 → <span class="font-medium text-foreground"
				>{formatTimelineTime(axisMaxSeconds)}</span
			>
		</p>
	</div>

	<div
		bind:this={trackElement}
		data-timeline-track
		role="button"
		tabindex="0"
		aria-label="Scenario timeline track. Click to add a timeline event."
		class="relative mt-6 min-h-44 rounded-xl border bg-background/80 px-4 py-12"
		onpointerdown={addEventAt}
		onpointermove={handleDrag}
		onpointerup={stopDrag}
		onpointercancel={stopDrag}
	>
		<div
			class="absolute top-1/2 right-4 left-4 h-3 -translate-y-1/2 rounded-full bg-muted shadow-inner"
		></div>

		{#each minuteMarkers as marker (marker)}
			{@const pct = secondsToPercent(marker, axisMaxSeconds)}
			<div
				class="pointer-events-none absolute top-1/2 h-8 w-px -translate-y-1/2 bg-border"
				style={`left: calc(1rem + (100% - 2rem) * ${pct / 100})`}
			></div>
			<span
				class="pointer-events-none absolute top-[calc(50%+28px)] -translate-x-1/2 text-[10px] text-muted-foreground"
				style={`left: calc(1rem + (100% - 2rem) * ${pct / 100})`}
			>
				{formatTimelineTime(marker)}
			</span>
		{/each}

		{#if timeLimitSeconds != null && timeLimitSeconds > 0}
			{@const pct = secondsToPercent(timeLimitSeconds, axisMaxSeconds)}
			<div
				class="pointer-events-none absolute top-1/2 z-10 h-12 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-destructive"
				style={`left: calc(1rem + (100% - 2rem) * ${pct / 100})`}
				title="Time limit"
			></div>
		{/if}

		{#each expectedActions as action (action.id)}
			{#if action.deadlineSeconds != null && action.deadlineSeconds > 0}
				{@const pct = secondsToPercent(action.deadlineSeconds, axisMaxSeconds)}
				<div
					class="pointer-events-none absolute top-[calc(50%+48px)] z-10 -translate-x-1/2"
					style={`left: calc(1rem + (100% - 2rem) * ${pct / 100})`}
					title="Deadline: {action.label}"
				>
					<div
						class="h-0 w-0 border-x-[6px] border-b-8 border-x-transparent border-b-amber-500"
					></div>
				</div>
			{/if}
		{/each}

		{#each sortedTimeline as item, index (item.id)}
			{@const pct = secondsToPercent(item.offsetSeconds ?? 0, axisMaxSeconds)}
			<button
				data-timeline-dot
				type="button"
				class="absolute top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5 outline-none"
				class:scale-110={selectedId === item.id}
				style={`left: calc(1rem + (100% - 2rem) * ${pct / 100})`}
				onpointerdown={(event) => startDrag(event, item.id)}
				onkeydown={(event) => nudgeEvent(event, item)}
				onclick={(event) => {
					event.stopPropagation();
					selectedId = item.id;
				}}
				title="{formatTimelineTime(item.offsetSeconds ?? 0)} — {item.label || `Event ${index + 1}`}"
			>
				<span
					class="flex h-10 w-10 items-center justify-center rounded-full border-2 border-background bg-primary text-sm font-bold text-primary-foreground shadow-md ring-2 ring-primary/25"
				>
					{index + 1}
				</span>
				<span class="max-w-24 truncate text-xs font-semibold text-foreground">
					{formatTimelineTime(item.offsetSeconds ?? 0)}
				</span>
			</button>
		{/each}
	</div>

	{#if selectedEvent}
		<div class="mt-4 rounded-xl border bg-card p-4 shadow-sm">
			<div class="flex items-start justify-between gap-3">
				<div>
					<p class="text-sm font-semibold">Edit event</p>
					<p class="text-xs text-muted-foreground">
						Fires at {formatTimelineTime(selectedEvent.offsetSeconds ?? 0)}
					</p>
				</div>
				<Button variant="outline" size="sm" onclick={() => removeEvent(selectedEvent.id)}
					>Delete</Button
				>
			</div>
			<div class="mt-4 grid gap-3 sm:grid-cols-2">
				<div class="space-y-1.5">
					<label class="text-xs font-semibold" for="timeline-selected-label">Label</label>
					<Input
						id="timeline-selected-label"
						value={selectedEvent.label ?? ''}
						placeholder="e.g., Fire extends to Delta"
						oninput={(event) =>
							updateEvent(selectedEvent.id, {
								label: (event.currentTarget as HTMLInputElement).value
							})}
					/>
				</div>
				<div class="space-y-1.5">
					<label class="text-xs font-semibold" for="timeline-selected-offset">Offset seconds</label>
					<Input
						id="timeline-selected-offset"
						type="number"
						min="0"
						value={selectedEvent.offsetSeconds}
						oninput={(event) =>
							updateEvent(selectedEvent.id, {
								offsetSeconds: clampSeconds(
									Number.parseInt((event.currentTarget as HTMLInputElement).value, 10) || 0,
									axisMaxSeconds
								)
							})}
					/>
				</div>
				<div class="space-y-1.5">
					<label class="text-xs font-semibold" for="timeline-selected-stage">Stage</label>
					<select
						id="timeline-selected-stage"
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
						value={selectedEvent.dispatch.stage ?? ''}
						onchange={(event) =>
							updateDispatch(selectedEvent.id, {
								stage: ((event.currentTarget as HTMLSelectElement).value ||
									undefined) as TimelineEvent['dispatch']['stage']
							})}
					>
						<option value="">No change</option>
						{#each STAGES as stage (stage.key)}
							<option value={stage.key}>{stage.label}</option>
						{/each}
					</select>
				</div>
				<div class="space-y-1.5">
					<label class="text-xs font-semibold" for="timeline-selected-side">View side</label>
					<select
						id="timeline-selected-side"
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
						value={selectedEvent.dispatch.side ?? ''}
						onchange={(event) =>
							updateDispatch(selectedEvent.id, {
								side: ((event.currentTarget as HTMLSelectElement).value ||
									undefined) as TimelineEvent['dispatch']['side']
							})}
					>
						<option value="">No change</option>
						{#each SIDES as side (side.key)}
							<option value={side.key}>{side.label}</option>
						{/each}
					</select>
				</div>
				<div class="space-y-1.5 sm:col-span-2">
					<label class="text-xs font-semibold" for="timeline-selected-update">Dispatch update</label
					>
					<Input
						id="timeline-selected-update"
						value={selectedEvent.dispatch.update ?? ''}
						placeholder="e.g., Reports of extension to exposure Delta-2"
						oninput={(event) =>
							updateDispatch(selectedEvent.id, {
								update: (event.currentTarget as HTMLInputElement).value
							})}
					/>
				</div>
				<div class="space-y-1.5 sm:col-span-2">
					<label class="text-xs font-semibold" for="timeline-selected-hazard">Hazard alert</label>
					<Input
						id="timeline-selected-hazard"
						value={selectedEvent.dispatch.hazard ?? ''}
						placeholder="e.g., Collapse zone — Side Charlie"
						oninput={(event) =>
							updateDispatch(selectedEvent.id, {
								hazard: (event.currentTarget as HTMLInputElement).value
							})}
					/>
				</div>
			</div>
		</div>
	{:else}
		<div
			class="mt-4 rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground"
		>
			Select a dot to edit its stage, side, hazard, and dispatch update.
		</div>
	{/if}
</div>
