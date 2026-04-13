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
</script>

<main class="mx-auto w-full max-w-4xl px-4 py-6 pb-safe sm:py-10">
	{#if reviewCaps.eventsTruncated || reviewCaps.radioTruncated}
		<div
			class="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
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
	<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
		<div class="min-w-0">
			<h1 class="text-2xl font-semibold tracking-tight sm:text-3xl">Session Review</h1>
			<p class="mt-1 text-sm text-muted-foreground">{data.scenario.title}</p>
			<div class="mt-2 flex items-center gap-3 text-sm text-muted-foreground">
				<span>{new Date(data.session.startedAt).toLocaleDateString()}</span>
				<Badge variant="outline">Duration: {duration}</Badge>
				<Badge variant="outline">{data.session.mode === 'self_practice' ? 'Self Practice' : 'Instructor-Led'}</Badge>
			</div>
		</div>
		<div class="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap">
			<Button variant="outline" class="min-h-11 w-full sm:w-auto" href={resolve('/app/command/reviews')}>Past simulations</Button>
			<Button variant="outline" class="min-h-11 w-full sm:w-auto" href={resolve('/app/command')}>Command home</Button>
		</div>
	</div>

	<div class="space-y-6">
		{#each groupedStages as group, idx (idx)}
			<div class="rounded-xl border">
				<div class="flex items-center gap-3 border-b px-4 py-3">
					<span class="rounded px-2 py-0.5 text-xs font-bold text-white {stageBadgeClass[group.stage] ?? 'bg-gray-500'}">{stageLabels[group.stage] ?? group.stage}</span>
					{#if group.startTime}
						<span class="text-xs text-muted-foreground">Started at {group.startTime}</span>
					{/if}
				</div>

				<div class="divide-y">
					{#each group.events as event (event.id)}
						<div class="px-4 py-3">
							<div class="flex items-center gap-2">
								<span class="text-xs font-mono text-muted-foreground">{formatTime(event.timestamp)}</span>
								<Badge
									variant="outline"
									class="text-[10px] {event.eventType === 'size_up' ? 'border-amber-300 bg-amber-50 text-amber-900' : ''}"
								>{event.eventType.replace(/_/g, ' ')}</Badge>
							</div>
							{#if event.eventType === 'state_dispatched'}
								<div class="mt-1 text-sm">
									{#if event.payloadJson?.stage}Stage changed to {stageLabels[String(event.payloadJson.stage)] ?? event.payloadJson.stage}{/if}
									{#if event.payloadJson?.side} Viewing Side {String(event.payloadJson.side).charAt(0).toUpperCase() + String(event.payloadJson.side).slice(1)}{/if}
									{#if event.payloadJson?.hazard}<span class="text-red-600">Hazard: {event.payloadJson.hazard}</span>{/if}
									{#if event.payloadJson?.update}<span class="text-blue-600">Update: {event.payloadJson.update}</span>{/if}
								</div>
							{:else if event.eventType === 'size_up'}
								<div class="mt-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
									<p class="text-xs font-semibold uppercase tracking-wide text-amber-800">On-scene size-up</p>
									<p class="mt-1">{String(event.payloadJson?.summary ?? event.payloadJson?.transcript ?? '')}</p>
								</div>
							{/if}
						</div>
					{/each}

					{#each group.radioMessages as radio (radio.id)}
						{@const rmt = String(radio.parsedCommandJson?.messageType ?? '').toLowerCase()}
						{@const rAssign = Array.isArray(radio.parsedCommandJson?.assignments) ? radio.parsedCommandJson.assignments : []}
						{@const rSizeUp = String(radio.parsedCommandJson?.sizeUpSummary ?? '').trim()}
						<div class="px-4 py-3">
							<div class="flex items-center gap-2">
								<span class="text-xs font-mono text-muted-foreground">{formatTime(radio.createdAt)}</span>
								<Badge variant="outline" class="bg-orange-50 text-[10px] text-orange-700">RADIO</Badge>
							</div>
							{#if radio.transcript}
								<p class="mt-1 text-sm italic">"{radio.transcript}"</p>
							{/if}
							{#if radio.audioUrl}
								<audio controls class="mt-2 h-8 w-full" src={radio.audioUrl} preload="none"></audio>
							{/if}
							{#if rSizeUp}
								<div class="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
									<span class="font-semibold">Size-up</span>
									<p class="mt-1 italic">"{rSizeUp}"</p>
								</div>
							{:else if rmt === 'size_up'}
								<div class="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
									<span class="font-semibold">Size-up</span>
									<p class="mt-1 italic">
										"{String(radio.parsedCommandJson?.summary ?? radio.transcript ?? '')}"
									</p>
								</div>
							{/if}
							{#if rAssign.length > 0}
								<div class="mt-2 space-y-1.5 rounded-md border bg-muted/40 px-3 py-2 text-xs">
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
								<div class="mt-2 rounded bg-muted/50 px-3 py-2 text-xs">
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
			<div class="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
				No events recorded for this session.
			</div>
		{/each}
	</div>

	<div class="mt-8 rounded-xl border">
		<div class="border-b px-4 py-3"><h3 class="text-sm font-semibold">Final Command Board</h3></div>
		<div class="p-2 sm:p-3">
			<div class="overflow-x-auto pb-2 sm:overflow-x-visible sm:pb-0">
			<div class="flex w-max min-w-full gap-1.5 sm:w-full sm:min-w-0">
				{#each COMMAND_BOARD_COLUMNS as col (col.key)}
					<div class="flex w-[4.75rem] shrink-0 flex-col border bg-muted/15 sm:w-[5.25rem] lg:min-w-0 lg:w-0 lg:flex-1">
						<div class="flex min-h-10 items-center justify-center border-b bg-muted/40 px-2 py-2 text-center text-[10px] font-bold uppercase text-muted-foreground">
							{col.header || '\u00a0'}
						</div>
						<div class="flex flex-col gap-1.5 p-2">
							{#each entriesForColumn(reviewBoardEntries, col.key) as entry (entry.id ?? entry.unitName)}
								<div class="rounded border px-2 py-1.5 text-xs">
									<div class="font-medium">{formatUnitAssignmentLine(entry)}</div>
									<Badge variant="outline" class="mt-1 text-[10px]">{entry.status}</Badge>
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
			</div>
		</div>
		{#if reviewLegacyEntries.length > 0}
			<div class="border-t px-4 py-3 text-sm">
				<p class="mb-2 text-xs font-medium text-muted-foreground">Other (legacy divisions)</p>
				<ul class="space-y-1 text-xs">
					{#each reviewLegacyEntries as entry (entry.id ?? entry.unitName)}
						<li>{entry.division}: {formatUnitAssignmentLine(entry)} — {entry.status}</li>
					{/each}
				</ul>
			</div>
		{/if}
		{#if reviewBoardEntries.length === 0}
			<p class="px-4 pb-4 text-center text-sm text-muted-foreground">No units were assigned</p>
		{/if}
	</div>
</main>
