<script lang="ts">
	import { resolve } from '$app/paths';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import type { PageData } from './$types';
	import {
		COMMAND_BOARD_COLUMNS,
		entriesForColumn,
		orphanBoardEntries,
		formatUnitAssignmentLine,
		type BoardEntryLike
	} from '$lib/trainer-command-board';

	let { data }: { data: PageData } = $props();

	/** Load return includes `reviewCaps`; keep accessor so types stay valid if generated PageData lags sync. */
	interface ReviewCaps {
		eventsTruncated: boolean;
		radioTruncated: boolean;
		eventLimit: number;
		radioLimit: number;
	}

	function reviewCapsFromData(d: PageData): ReviewCaps {
		const raw = d as PageData & { reviewCaps?: ReviewCaps };
		return (
			raw.reviewCaps ?? {
				eventsTruncated: false,
				radioTruncated: false,
				eventLimit: 2000,
				radioLimit: 800
			}
		);
	}

	const reviewCaps = $derived(reviewCapsFromData(data));

	const stageLabels: Record<string, string> = { incipient: 'Incipient', growth: 'Growth', fully_developed: 'Fully Developed', decay: 'Decay' };
	const stageBadgeClass: Record<string, string> = { incipient: 'bg-blue-500', growth: 'bg-yellow-500', fully_developed: 'bg-red-500', decay: 'bg-green-500' };

	const radioById = $derived.by(() => {
		const m: Record<string, (typeof data.radioMessages)[number]> = {};
		for (const r of data.radioMessages) m[r.id] = r;
		return m;
	});

	interface GroupedStage {
		stage: string;
		startTime: string;
		events: Array<{
			id: string;
			eventType: string;
			timestamp: Date | string;
			payloadJson: Record<string, unknown>;
		}>;
		radioMessages: Array<{
			id: string;
			transcript: string | null;
			audioUrl: string;
			parsedCommandJson: Record<string, unknown> | null;
			createdAt: Date | string;
		}>;
	}

	const groupedStages = $derived.by(() => {
		const stages: GroupedStage[] = [];
		let currentStage: GroupedStage = { stage: 'incipient', startTime: '', events: [], radioMessages: [] };

		const radios = radioById;
		for (const event of data.events) {
			if (event.eventType === 'state_dispatched' && event.payloadJson?.stage) {
				if (currentStage.events.length > 0 || currentStage.radioMessages.length > 0) {
					stages.push(currentStage);
				}
				currentStage = {
					stage: String(event.payloadJson.stage),
					startTime: new Date(event.timestamp).toLocaleTimeString(),
					events: [event],
					radioMessages: []
				};
			} else if (event.eventType === 'radio_recorded') {
				const mid = event.payloadJson?.messageId;
				const radio = typeof mid === 'string' ? radios[mid] : undefined;
				if (radio) currentStage.radioMessages.push(radio);
				currentStage.events.push(event);
			} else {
				currentStage.events.push(event);
			}
		}
		if (currentStage.events.length > 0 || currentStage.radioMessages.length > 0) {
			stages.push(currentStage);
		}
		return stages;
	});

	function formatTime(ts: string | Date) {
		return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
	}

	const reviewBoardEntries = $derived(
		(data.boardEntries ?? []).map((e) => ({
			id: e.id,
			division: e.division ?? 'Unassigned',
			unitName: e.unitName,
			assignment: e.assignment ?? '',
			status: e.status ?? 'Assigned'
		})) as BoardEntryLike[]
	);
	const reviewLegacyEntries = $derived(orphanBoardEntries(reviewBoardEntries));

	const duration = $derived.by(() => {
		if (!data.session.endedAt) return 'In progress';
		const start = new Date(data.session.startedAt).getTime();
		const end = new Date(data.session.endedAt).getTime();
		const seconds = Math.floor((end - start) / 1000);
		const m = Math.floor(seconds / 60);
		const s = seconds % 60;
		return `${m}m ${s}s`;
	});

	const expectedActions = $derived(
		((data.scenario as { selfPacedConfigJson?: { expectedActions?: unknown } | null })
			.selfPacedConfigJson?.expectedActions ?? []) as Array<{
			id: string;
			label: string;
			critical?: boolean;
			deadlineSeconds?: number;
		}>
	);

	type ActionStatus = { status: 'completed' | 'delayed' | 'missed' | 'pending'; atSeconds?: number };

	const expectedActionStatus = $derived.by(() => {
		const map = new Map<string, ActionStatus>();
		for (const action of expectedActions) map.set(action.id, { status: 'pending' });
		for (const evt of data.events) {
			const id = (evt.payloadJson as { actionId?: unknown })?.actionId;
			if (typeof id !== 'string') continue;
			const at = (evt.payloadJson as { atSeconds?: unknown })?.atSeconds;
			const atSeconds = typeof at === 'number' ? at : undefined;
			if (evt.eventType === 'expected_action_completed') {
				map.set(id, { status: 'completed', atSeconds });
			} else if (evt.eventType === 'expected_action_delayed') {
				map.set(id, { status: 'delayed', atSeconds });
			} else if (evt.eventType === 'expected_action_missed' && map.get(id)?.status === 'pending') {
				map.set(id, { status: 'missed', atSeconds });
			}
		}
		return map;
	});

	const outcomeLabel: Record<string, string> = {
		completed: 'Completed',
		failed: 'Failed',
		timeout: 'Time Expired',
		in_progress: 'In Progress'
	};

	const outcomeColor: Record<string, string> = {
		completed: 'bg-green-600 text-white',
		failed: 'bg-red-600 text-white',
		timeout: 'bg-amber-600 text-white',
		in_progress: 'bg-gray-500 text-white'
	};

	const actionStatusLabel: Record<ActionStatus['status'], string> = {
		completed: 'Completed',
		delayed: 'Late',
		missed: 'Missed',
		pending: 'Not addressed'
	};

	const actionStatusColor: Record<ActionStatus['status'], string> = {
		completed: 'bg-green-100 text-green-900 border-green-300',
		delayed: 'bg-amber-100 text-amber-900 border-amber-300',
		missed: 'bg-red-100 text-red-900 border-red-300',
		pending: 'bg-gray-100 text-gray-700 border-gray-300'
	};

	function formatOffsetSeconds(s?: number) {
		if (typeof s !== 'number') return '—';
		const m = Math.floor(s / 60);
		const sec = s % 60;
		return `${m}:${String(sec).padStart(2, '0')}`;
	}
</script>

<main class="mx-auto w-full max-w-6xl px-5 py-8 pb-safe sm:px-8 sm:py-12">
	{#if reviewCaps.eventsTruncated || reviewCaps.radioTruncated}
		<div
			class="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-5 py-4 text-base text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
			role="status"
		>
			<p class="font-medium">Long session — timeline is partially loaded</p>
			<ul class="mt-1 list-inside list-disc text-amber-900/90 dark:text-amber-200/90">
				{#if reviewCaps.eventsTruncated}
					<li>Showing the most recent {reviewCaps.eventLimit} events (older events are hidden).</li>
				{/if}
				{#if reviewCaps.radioTruncated}
					<li>Showing the most recent {reviewCaps.radioLimit} radio clips (older clips are hidden).</li>
				{/if}
			</ul>
		</div>
	{/if}
	<div class="mb-8 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
		<div class="min-w-0">
			<h1 class="text-3xl font-semibold tracking-tight sm:text-4xl">Session Review</h1>
			<p class="mt-2 text-base text-muted-foreground sm:text-lg">{data.scenario.title}</p>
			<div class="mt-3 flex flex-wrap items-center gap-2.5 text-base text-muted-foreground">
				<span>{new Date(data.session.startedAt).toLocaleDateString()}</span>
				<Badge variant="outline">Duration: {duration}</Badge>
				<Badge variant="outline">{data.session.mode === 'self_practice' ? (expectedActions.length > 0 ? 'Self-Paced' : 'Self Practice') : 'Instructor-Led'}</Badge>
				{#if data.session.endedAt}
					<span class="rounded-full px-3 py-1 text-sm font-semibold {outcomeColor[data.session.simulationOutcome ?? 'completed'] ?? outcomeColor.completed}">
						{outcomeLabel[data.session.simulationOutcome ?? 'completed'] ?? 'Completed'}
					</span>
					{#if data.session.endReason}
						<span class="text-sm text-muted-foreground">{data.session.endReason}</span>
					{/if}
				{/if}
			</div>
		</div>
		<div class="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap">
			<Button variant="outline" class="min-h-11 w-full sm:w-auto" href={resolve('/app/command/reviews')}>Past simulations</Button>
			<Button variant="outline" class="min-h-11 w-full sm:w-auto" href={resolve('/app/command')}>Command home</Button>
		</div>
	</div>

	<div class="space-y-8">
		{#each groupedStages as group, idx (idx)}
			<div class="rounded-xl border shadow-sm">
				<div class="flex items-center gap-3 border-b px-5 py-4 sm:px-6">
					<span class="rounded px-2.5 py-1 text-sm font-bold text-white {stageBadgeClass[group.stage] ?? 'bg-gray-500'}">{stageLabels[group.stage] ?? group.stage}</span>
					{#if group.startTime}
						<span class="text-sm text-muted-foreground">Started at {group.startTime}</span>
					{/if}
				</div>

				<div class="divide-y">
					{#each group.events as event (event.id)}
						<div class="px-5 py-4 sm:px-6">
							<div class="flex items-center gap-2">
								<span class="text-sm font-mono text-muted-foreground">{formatTime(event.timestamp)}</span>
								<Badge
									variant="outline"
									class="text-xs {event.eventType === 'size_up' ? 'border-amber-300 bg-amber-50 text-amber-900' : ''}"
								>{event.eventType.replace(/_/g, ' ')}</Badge>
							</div>
							{#if event.eventType === 'state_dispatched'}
								<div class="mt-2 text-base leading-relaxed">
									{#if event.payloadJson?.stage}Stage changed to {stageLabels[String(event.payloadJson.stage)] ?? event.payloadJson.stage}{/if}
									{#if event.payloadJson?.side} Viewing Side {String(event.payloadJson.side).charAt(0).toUpperCase() + String(event.payloadJson.side).slice(1)}{/if}
									{#if event.payloadJson?.hazard}<span class="text-red-600">Hazard: {event.payloadJson.hazard}</span>{/if}
									{#if event.payloadJson?.update}<span class="text-blue-600">Update: {event.payloadJson.update}</span>{/if}
								</div>
							{:else if event.eventType === 'size_up'}
								<div class="mt-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-base leading-relaxed text-amber-950">
									<p class="text-sm font-semibold uppercase tracking-wide text-amber-800">On-scene size-up</p>
									<p class="mt-2">{String(event.payloadJson?.summary ?? event.payloadJson?.transcript ?? '')}</p>
								</div>
							{/if}
						</div>
					{/each}

					{#each group.radioMessages as radio (radio.id)}
						{@const rmt = String(radio.parsedCommandJson?.messageType ?? '').toLowerCase()}
						{@const rAssign = Array.isArray(radio.parsedCommandJson?.assignments) ? radio.parsedCommandJson.assignments : []}
						{@const rSizeUp = String(radio.parsedCommandJson?.sizeUpSummary ?? '').trim()}
						<div class="px-5 py-4 sm:px-6">
							<div class="flex items-center gap-2">
								<span class="text-sm font-mono text-muted-foreground">{formatTime(radio.createdAt)}</span>
								<Badge variant="outline" class="bg-orange-50 text-xs text-orange-700">RADIO</Badge>
							</div>
							{#if radio.transcript}
								<p class="mt-2 text-base italic leading-relaxed">"{radio.transcript}"</p>
							{/if}
							{#if radio.audioUrl}
								<audio controls class="mt-3 h-11 w-full max-w-2xl" src={radio.audioUrl} preload="none"></audio>
							{/if}
							{#if rSizeUp}
								<div class="mt-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
									<span class="font-semibold">Size-up</span>
									<p class="mt-1 italic">"{rSizeUp}"</p>
								</div>
							{:else if rmt === 'size_up'}
								<div class="mt-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
									<span class="font-semibold">Size-up</span>
									<p class="mt-1 italic">
										"{String(radio.parsedCommandJson?.summary ?? radio.transcript ?? '')}"
									</p>
								</div>
							{/if}
							{#if rAssign.length > 0}
								<div class="mt-3 space-y-2 rounded-md border bg-muted/40 px-4 py-3 text-sm">
									<p class="font-semibold text-muted-foreground">Assignments</p>
									<ul class="list-inside list-disc space-y-1">
										{#each rAssign as a, i (i)}
											<li>
												<span class="font-medium">{(a as Record<string, unknown>).unitName}</span>
												{#if (a as Record<string, unknown>).assignment}
													— {(a as Record<string, unknown>).assignment}
												{/if}
												{#if (a as Record<string, unknown>).boardColumn || (a as Record<string, unknown>).division}
													<span class="text-muted-foreground">
														→ {String((a as Record<string, unknown>).boardColumn ?? (a as Record<string, unknown>).division)}
													</span>
												{/if}
											</li>
										{/each}
									</ul>
								</div>
							{:else if radio.parsedCommandJson?.unitName}
								<div class="mt-3 rounded bg-muted/50 px-4 py-3 text-sm">
									<span class="font-medium">{radio.parsedCommandJson.unitName}</span>
									{#if radio.parsedCommandJson.assignment} — {radio.parsedCommandJson.assignment}{/if}
									{#if radio.parsedCommandJson.boardColumn || radio.parsedCommandJson.division}
										<span class="text-muted-foreground">
											→ {String(radio.parsedCommandJson.boardColumn ?? radio.parsedCommandJson.division)}
										</span>
									{/if}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{:else}
			<div class="rounded-xl border border-dashed p-14 text-center text-base text-muted-foreground">
				No events recorded for this session.
			</div>
		{/each}
	</div>

	{#if expectedActions.length > 0}
		<div class="mt-10 rounded-xl border shadow-sm">
			<div class="border-b px-5 py-4 sm:px-6">
				<h3 class="text-lg font-semibold">Expected Actions</h3>
				<p class="mt-1 text-sm text-muted-foreground">
					Scripted assignments the instructor expected during this scenario.
				</p>
			</div>
			<ul class="divide-y">
				{#each expectedActions as action (action.id)}
					{@const status = expectedActionStatus.get(action.id) ?? { status: 'pending' as const }}
					<li class="flex items-start justify-between gap-4 px-5 py-4 text-base sm:px-6">
						<div class="min-w-0">
							<p class="font-medium">{action.label}</p>
							<p class="mt-1 text-sm text-muted-foreground">
								{#if action.deadlineSeconds != null}
									Deadline: {formatOffsetSeconds(action.deadlineSeconds)}
								{:else}
									No deadline
								{/if}
								{#if action.critical}<span class="ml-2 text-red-600">Critical</span>{/if}
							</p>
						</div>
						<div class="shrink-0 text-right">
							<span class="rounded-full border px-3 py-1 text-sm font-semibold {actionStatusColor[status.status]}">
								{actionStatusLabel[status.status]}
							</span>
							{#if status.atSeconds != null}
								<p class="mt-1 text-xs text-muted-foreground">at {formatOffsetSeconds(status.atSeconds)}</p>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	<div class="mt-10 rounded-xl border shadow-sm">
		<div class="border-b px-5 py-4 sm:px-6"><h3 class="text-lg font-semibold">Final Command Board</h3></div>
		<div class="p-3 sm:p-5">
			<div class="overflow-x-auto pb-2 sm:overflow-x-visible sm:pb-0">
			<div class="flex w-max min-w-full gap-2 sm:w-full sm:min-w-0">
				{#each COMMAND_BOARD_COLUMNS as col (col.key)}
					<div class="flex w-[6.25rem] shrink-0 flex-col border bg-muted/15 sm:w-[7rem] lg:min-w-0 lg:w-0 lg:flex-1">
						<div class="flex min-h-12 items-center justify-center border-b bg-muted/40 px-2 py-2.5 text-center text-xs font-bold uppercase text-muted-foreground">
							{col.header || '\u00a0'}
						</div>
						<div class="flex flex-col gap-2 p-2.5">
							{#each entriesForColumn(reviewBoardEntries, col.key) as entry (entry.id ?? entry.unitName)}
								<div class="rounded border px-2.5 py-2 text-sm">
									<div class="font-medium">{formatUnitAssignmentLine(entry)}</div>
									<Badge variant="outline" class="mt-1.5 text-xs">{entry.status}</Badge>
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
			</div>
		</div>
		{#if reviewLegacyEntries.length > 0}
			<div class="border-t px-5 py-4 text-base sm:px-6">
				<p class="mb-2 text-sm font-medium text-muted-foreground">Other (legacy divisions)</p>
				<ul class="space-y-1.5 text-sm">
					{#each reviewLegacyEntries as entry (entry.id ?? entry.unitName)}
						<li>{entry.division}: {formatUnitAssignmentLine(entry)} — {entry.status}</li>
					{/each}
				</ul>
			</div>
		{/if}
		{#if reviewBoardEntries.length === 0}
			<p class="px-5 pb-5 text-center text-base text-muted-foreground">No units were assigned</p>
		{/if}
	</div>
</main>
