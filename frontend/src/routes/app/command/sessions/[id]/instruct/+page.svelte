<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { getTrainerSocket } from '$lib/stores/socket';
	import OverlayCanvas from '$lib/components/scene-editor/konva-overlay-editor/OverlayCanvas.svelte';
	import {
		normalizeAnimationOverlays,
		type PersistedAnimationOverlay
	} from '$lib/components/scene-editor/konva-overlay-editor/overlay-utils';
	import type { AnimationOverlay } from '$lib/components/scene-editor/konva-overlay-editor/overlay-types';
	import type { PageData } from './$types';
	import {
		COMMAND_BOARD_COLUMNS,
		entriesForColumn,
		orphanBoardEntries,
		formatUnitAssignmentLine,
		type BoardEntryLike
	} from '$lib/trainer-command-board';

	let { data }: { data: PageData } = $props();
	const socket = getTrainerSocket();

	let sessionSeconds = $state(0);
	let clockInterval: ReturnType<typeof setInterval> | null = null;

	let draftStage = $state('incipient');
	let draftSide = $state('alpha');
	const joinCode = $derived(data.session.joinCode ?? '');
	let studentJoined = $state(false);
	let hasStarted = $state(false);
	let hazardText = $state('');
	let updateText = $state('');
	let currentStage = $state('incipient');
	let currentSide = $state('alpha');
	let lastHydratedSessionId = $state<string | null>(null);

	function syncClock(startedAtIso: string) {
		const elapsed = Math.floor((Date.now() - new Date(startedAtIso).getTime()) / 1000);
		sessionSeconds = Math.max(0, elapsed);
	}

	let boardEntries = $state<BoardEntry[]>([]);
	let timelineEvents = $state<Array<{ id: string; type: string; text: string; time: string }>>([
		{ id: '0', type: 'START', text: 'Session started', time: '00:00' }
	]);
	let studentTranscripts = $state<Array<{ id: string; transcript: string; time: string }>>([]);

	const stageLabels: Record<string, string> = { incipient: 'Incipient', growth: 'Growth', fully_developed: 'Fully Developed', decay: 'Decay' };
	const stageBadgeClass: Record<string, string> = { incipient: 'bg-blue-500', growth: 'bg-yellow-500', fully_developed: 'bg-red-500', decay: 'bg-green-500' };
	const sideLabels: Record<string, string> = { alpha: 'Side Alpha', bravo: 'Side Bravo', charlie: 'Side Charlie', delta: 'Side Delta' };
	const sideImageMap = $derived.by(() => ({
		alpha: data.scenario.sideAlphaImageUrl,
		bravo: data.scenario.sideBravoImageUrl,
		charlie: data.scenario.sideCharlieImageUrl,
		delta: data.scenario.sideDeltaImageUrl
	}));
	const currentSideImage = $derived(sideImageMap[currentSide as keyof typeof sideImageMap] ?? null);

	type StageOverlays = Record<string, AnimationOverlay[]>;
	type SideStageOverlays = Record<string, StageOverlays>;

	interface BoardEntry {
		id: string;
		division: string;
		unitName: string;
		assignment: string;
		status: string;
	}

	interface TrainerRadioTranscribedPayload {
		transcript?: string;
		parsedCommand?: Record<string, unknown>;
	}

	const SUGGESTED_ASSIGNMENTS = [
		'Fire Attack',
		'Search & Rescue',
		'Ventilation',
		'Backup Line',
		'Exposure Protection',
		'Rapid Intervention',
		'Water Supply',
		'Salvage & Overhaul',
		'Accountability',
		'EMS/Rehab',
		'Staging'
	];

	const UNIT_STATUSES = ['Assigned', 'En Route', 'On Scene', 'Operating', 'PAR Completed', 'Available', 'Out of Service'];

	let assignUnit = $state('');
	let assignDivision = $state('');
	let assignAssignment = $state('');
	let activeInstructorTab = $state<'controls' | 'board'>('controls');

	const availableUnits = $derived(
		(data.scenario.defaultResources ?? []).filter(
			(r: { unitName: string }) => !boardEntries.some(e => e.unitName === r.unitName)
		)
	);

	const legacyBoardEntries = $derived(orphanBoardEntries(boardEntries as BoardEntryLike[]));

	const STATUS_COLORS: Record<string, string> = {
		'Assigned': 'bg-blue-100 text-blue-700',
		'En Route': 'bg-amber-100 text-amber-700',
		'On Scene': 'bg-purple-100 text-purple-700',
		'Operating': 'bg-green-100 text-green-700',
		'PAR Completed': 'bg-emerald-100 text-emerald-800',
		'Available': 'bg-gray-100 text-gray-600',
		'Out of Service': 'bg-red-100 text-red-700'
	};

	function assignUnitToBoard() {
		const unit = assignUnit;
		const division = assignDivision;
		const assignment = assignAssignment;
		if (!unit || !division) return;

		socket?.emit('trainer:board:assign', {
			sessionId: data.session.id,
			division,
			unitName: unit,
			assignment,
			status: 'Assigned'
		});

		const entry: BoardEntry = {
			id: crypto.randomUUID(),
			division,
			unitName: unit,
			assignment,
			status: 'Assigned'
		};
		boardEntries = [...boardEntries.filter(e => e.unitName !== unit), entry];
		addTimelineEvent('BOARD', `${unit} → ${division}${assignment ? ` — ${assignment}` : ''}`);
		assignUnit = '';
		assignDivision = '';
		assignAssignment = '';
	}

	function changeUnitStatus(unitName: string, status: string) {
		socket?.emit('trainer:board:update-status', { sessionId: data.session.id, unitName, status });
		boardEntries = boardEntries.map(e => e.unitName === unitName ? { ...e, status } : e);
	}

	function removeUnitFromBoard(unitName: string) {
		socket?.emit('trainer:board:remove', { sessionId: data.session.id, unitName });
		boardEntries = boardEntries.filter(e => e.unitName !== unitName);
		addTimelineEvent('BOARD', `${unitName} removed from board`);
	}

	$effect.pre(() => {
		const id = data.session.id;
		if (lastHydratedSessionId === id) return;
		lastHydratedSessionId = id;

		draftStage = data.session.activeStage;
		draftSide = data.session.activeSide;
		currentStage = data.session.activeStage;
		currentSide = data.session.activeSide;
		studentJoined = Boolean(data.session.studentId);
		hasStarted = Boolean(data.session.hasStarted);
		if (hasStarted && data.session.startedAt) {
			syncClock(new Date(data.session.startedAt).toISOString());
		}
		boardEntries = (data.boardEntries ?? []).map((e: typeof data.boardEntries[number]) => ({
			id: e.id,
			division: e.division ?? 'Unassigned',
			unitName: e.unitName,
			assignment: e.assignment ?? '',
			status: e.status ?? 'Assigned'
		}));
	});

	const stageMetadata = $derived((data.scenario.stageMetadataJson ?? {}) as SideStageOverlays);

function parsePersistedOverlays(value: unknown): PersistedAnimationOverlay[] | undefined {
	if (!Array.isArray(value)) return undefined;
	return value as PersistedAnimationOverlay[];
}

	function getOverlaysForSideStage(side: string, stage: string): AnimationOverlay[] {
		const raw = (stageMetadata[side] as StageOverlays)?.[stage];
	return normalizeAnimationOverlays(parsePersistedOverlays(raw));
	}

	const currentOverlays = $derived(getOverlaysForSideStage(currentSide, currentStage));
	const hasOverlays = $derived(currentOverlays.length > 0);

	const draftOverlays = $derived(getOverlaysForSideStage(draftSide, draftStage));
	const draftSideImage = $derived(sideImageMap[draftSide as keyof typeof sideImageMap] ?? null);
	const hasDraftOverlays = $derived(draftOverlays.length > 0);

	const overlayKey = $derived(`${currentSide}-${currentStage}`);
	const draftOverlayKey = $derived(`${draftSide}-${draftStage}`);

	function formatClock(seconds: number) {
		const m = Math.floor(seconds / 60).toString().padStart(2, '0');
		const s = (seconds % 60).toString().padStart(2, '0');
		return `${m}:${s}`;
	}

	function addTimelineEvent(type: string, text: string) {
		timelineEvents = [...timelineEvents, { id: crypto.randomUUID(), type, text, time: formatClock(sessionSeconds) }];
	}

	function dispatch() {
		if (draftStage === currentStage && draftSide === currentSide) return;
		const payload: Record<string, string> = {
			sessionId: data.session.id,
			stage: draftStage,
			side: draftSide
		};
		if (draftStage !== currentStage) addTimelineEvent('STAGE', `Dispatched stage: ${stageLabels[draftStage]}`);
		if (draftSide !== currentSide) addTimelineEvent('SIDE', `Dispatched side: ${sideLabels[draftSide]}`);
		currentStage = draftStage;
		currentSide = draftSide;
		socket?.emit('trainer:state:dispatch', payload);
	}

	const SUGGESTED_HAZARDS = [
		'Collapse reported',
		'Backdraft conditions',
		'Flashover imminent',
		'Downed power lines',
		'Hazmat leak detected',
		'Floor instability',
		'Explosion risk',
		'Victim located',
		'Mayday — firefighter down',
		'Roof sagging / imminent collapse'
	];

	const SUGGESTED_UPDATES = [
		'Additional alarm requested',
		'Water supply established',
		'Primary search complete — all clear',
		'Primary search complete — victims found',
		'Ventilation started',
		'Exposure protection in place',
		'Fire under control',
		'Utilities secured',
		'RIT deployed',
		'EMS staging established'
	];

	let showHazardSuggestions = $state(false);
	let showUpdateSuggestions = $state(false);

	function injectHazard(text?: string) {
		const value = text ?? hazardText.trim();
		if (!value) return;
		socket?.emit('trainer:state:dispatch', { sessionId: data.session.id, hazard: value });
		addTimelineEvent('HAZARD', value);
		hazardText = '';
		showHazardSuggestions = false;
	}

	function sendUpdate(text?: string) {
		const value = text ?? updateText.trim();
		if (!value) return;
		socket?.emit('trainer:state:dispatch', { sessionId: data.session.id, update: value });
		addTimelineEvent('UPDATE', value);
		updateText = '';
		showUpdateSuggestions = false;
	}

	async function copyJoinCode() {
		if (!joinCode) return;
		try {
			await navigator.clipboard.writeText(joinCode);
			addTimelineEvent('INFO', 'Join code copied');
		} catch (error) {
			console.error('Unable to copy join code:', error);
		}
	}

	function startSimulation() {
		socket?.emit('trainer:session:start', { sessionId: data.session.id });
		hasStarted = true;
		sessionSeconds = 0;
		addTimelineEvent('START', 'Simulation started');
	}

	function goToReview() {
		if (!browser) return;
		window.location.href = resolve(`/app/command/sessions/${data.session.id}/review`);
	}

	async function endSession() {
		if (!confirm('End this session?')) return;
		socket?.emit('trainer:session:end', { sessionId: data.session.id });
		goToReview();
	}

	function joinRoom() {
		socket?.emit('trainer:session:join', { sessionId: data.session.id, role: 'instructor' });
	}

	onMount(() => {
		clockInterval = setInterval(() => { sessionSeconds++; }, 1000);

		socket?.on('trainer:session:ended', goToReview);

		socket?.on('trainer:session:started', (payload?: { startedAt?: string }) => {
			hasStarted = true;
			if (payload?.startedAt) syncClock(payload.startedAt);
		});

		socket?.on('trainer:board:updated', (payload: { entry?: Partial<BoardEntry> & { unitName: string } }) => {
			const entry = payload.entry;
			if (!entry) return;
			const mapped: BoardEntry = {
				id: entry.id ?? crypto.randomUUID(),
				division: entry.division ?? 'Unassigned',
				unitName: entry.unitName,
				assignment: entry.assignment ?? '',
				status: entry.status ?? 'Assigned'
			};
			boardEntries = [...boardEntries.filter(e => e.unitName !== mapped.unitName), mapped];
		});

		socket?.on('trainer:board:removed', (payload: { unitName: string }) => {
			boardEntries = boardEntries.filter(e => e.unitName !== payload.unitName);
		});

		socket?.on('trainer:board:status-changed', (payload: { unitName: string; status: string }) => {
			boardEntries = boardEntries.map(e => e.unitName === payload.unitName ? { ...e, status: payload.status } : e);
		});

		socket?.on('trainer:radio:transcribed', (payload: TrainerRadioTranscribedPayload) => {
			if (payload.transcript) {
				studentTranscripts = [
					...studentTranscripts,
					{ id: crypto.randomUUID(), transcript: payload.transcript, time: formatClock(sessionSeconds) }
				];
			}
		});

		socket?.on('trainer:sizeup:recorded', (payload: { summary?: string; transcript?: string }) => {
			const text = String(payload.summary ?? payload.transcript ?? '').trim();
			addTimelineEvent('SIZE-UP', text || 'On-scene size-up');
		});

		socket?.on('trainer:student:joined', () => {
			studentJoined = true;
			addTimelineEvent('JOIN', 'Student joined session');
		});

		socket?.on('connect', joinRoom);
		joinRoom();
	});

	onDestroy(() => {
		if (clockInterval) clearInterval(clockInterval);
		socket?.off('connect', joinRoom);
		socket?.off('trainer:board:updated');
		socket?.off('trainer:board:removed');
		socket?.off('trainer:board:status-changed');
		socket?.off('trainer:radio:transcribed');
		socket?.off('trainer:sizeup:recorded');
		socket?.off('trainer:student:joined');
		socket?.off('trainer:session:started');
		socket?.off('trainer:session:ended', goToReview);
		socket?.emit('trainer:session:leave', { sessionId: data.session.id });
		goToReview();
	});
</script>

<div class="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-background">
	<header class="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
		<div class="flex min-w-0 flex-wrap items-center gap-2 gap-y-1.5">
			<h1 class="max-w-full truncate text-base font-semibold sm:text-lg">{data.scenario.title}</h1>
			<Badge class="shrink-0 bg-green-500 text-white">LIVE</Badge>
			<span class="shrink-0 font-mono text-xs text-muted-foreground sm:text-sm">{formatClock(sessionSeconds)}</span>
			<Badge class="shrink-0" variant="outline">Instructor View</Badge>
		</div>
		<Button variant="destructive" class="min-h-11 w-full shrink-0 sm:w-auto" size="sm" onclick={endSession}>End Session</Button>
	</header>

	{#if !studentJoined}
		<div class="flex flex-1 items-center justify-center p-6">
			<div class="w-full max-w-lg rounded-2xl border bg-card p-8 text-center shadow-sm">
				<p class="text-sm font-medium uppercase tracking-wider text-muted-foreground">Instructor Session</p>
				<h2 class="mt-2 text-2xl font-semibold">Waiting for student to join</h2>
				<p class="mt-2 text-sm text-muted-foreground">Share this 5-character code with a student.</p>
				<div class="mt-6 rounded-xl border bg-muted/40 px-4 py-4 sm:px-6 sm:py-5">
					<p class="text-center font-mono text-2xl font-bold tracking-[0.35em] sm:text-4xl sm:tracking-[0.4em]">{joinCode || '-----'}</p>
				</div>
				<div class="mt-4 flex justify-center gap-2">
					<Button variant="outline" onclick={copyJoinCode} disabled={!joinCode}>Copy Code</Button>
				</div>
			</div>
		</div>
	{:else if !hasStarted}
		<div class="flex flex-1 items-center justify-center p-6">
			<div class="w-full max-w-lg rounded-2xl border bg-card p-8 text-center shadow-sm">
				<div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
					<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
				</div>
				<h2 class="text-2xl font-semibold">Student connected</h2>
				<p class="mt-2 text-sm text-muted-foreground">The student has joined and is waiting for you to begin.</p>
				<Button class="mt-6 px-8" size="lg" onclick={startSimulation}>Start Simulation</Button>
			</div>
		</div>
	{:else}
		<div class="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
		<main class="order-1 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:order-none">
			<div class="flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2 sm:px-4">
				<div class="relative h-16 w-full max-w-[11rem] shrink-0 overflow-hidden rounded-lg border bg-black sm:h-20 sm:max-w-[10rem] sm:w-40">
					{#if currentSideImage && hasOverlays}
						{#key overlayKey}
							<div class="h-full w-full">
								<OverlayCanvas baseImageUrl={currentSideImage} overlays={currentOverlays} selectedOverlayId={null} isInteractive={false} />
							</div>
						{/key}
					{:else if currentSideImage}
						<img src={currentSideImage} alt={sideLabels[currentSide]} class="h-full w-full object-contain" />
					{:else}
						<div class="flex h-full w-full items-center justify-center text-white/40 text-[10px]">No image</div>
					{/if}
				</div>
				<div class="text-xs space-y-0.5">
					<p class="font-medium">{sideLabels[currentSide]}</p>
					<Badge class="text-[10px] {stageBadgeClass[currentStage] ?? 'bg-gray-500'} text-white">{stageLabels[currentStage] ?? currentStage}</Badge>
				</div>
			</div>

			<div class="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
				<div class="rounded-xl border bg-card">
					<div class="flex flex-col gap-1 border-b px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4">
						<h3 class="text-sm font-semibold">Incident Command Board</h3>
						<span class="text-[11px] text-muted-foreground sm:text-xs">{boardEntries.length} assigned &middot; {availableUnits.length} available</span>
					</div>

					<div class="border-b px-3 py-2.5 sm:px-4">
						<p class="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Available</p>
						<div class="flex flex-wrap gap-1.5">
							{#each availableUnits as resource (resource.unitName)}
								<Badge variant="secondary" class="gap-1 text-xs">
									<span class="h-1.5 w-1.5 rounded-full bg-green-500"></span>
									{resource.unitName}
								</Badge>
							{:else}
								<span class="text-xs text-muted-foreground">All units assigned</span>
							{/each}
						</div>
					</div>

					<div class="border-b bg-muted/30 px-3 py-2.5 sm:px-4">
						<div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
							<div class="w-full sm:w-32">
								<label class="mb-1 block text-[10px] text-muted-foreground" for="assign-unit">Unit</label>
								<select id="assign-unit" bind:value={assignUnit} class="h-11 w-full rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring sm:h-8">
									<option value="">Select...</option>
									{#each availableUnits as resource (resource.unitName)}
										<option value={resource.unitName}>{resource.unitName}</option>
									{/each}
								</select>
							</div>
							<div class="w-full sm:w-36">
								<label class="mb-1 block text-[10px] text-muted-foreground" for="assign-division">Column</label>
								<select id="assign-division" bind:value={assignDivision} class="h-11 w-full rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring sm:h-8">
									<option value="">Select...</option>
									{#each COMMAND_BOARD_COLUMNS as col (col.key)}
										<option value={col.key}>{col.header || 'Reserve / staging'}</option>
									{/each}
								</select>
							</div>
							<div class="w-full sm:w-40">
								<label class="mb-1 block text-[10px] text-muted-foreground" for="assign-assignment">Assignment</label>
								<select id="assign-assignment" bind:value={assignAssignment} class="h-11 w-full rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring sm:h-8">
									<option value="">Select...</option>
									{#each SUGGESTED_ASSIGNMENTS as a (a)}
										<option value={a}>{a}</option>
									{/each}
								</select>
							</div>
							<Button size="sm" class="h-11 w-full sm:h-8 sm:w-auto" onclick={assignUnitToBoard} disabled={!assignUnit || !assignDivision}>Assign</Button>
						</div>
					</div>

					<div class="px-1 py-2 sm:px-2 sm:py-3">
						<div class="overflow-x-auto pb-1 lg:overflow-x-hidden lg:pb-0">
						<div class="flex w-max gap-1.5 lg:w-full lg:min-w-0">
							{#each COMMAND_BOARD_COLUMNS as col (col.key)}
								<div class="flex min-h-0 w-[5.25rem] shrink-0 flex-col border bg-muted/15 sm:w-28 lg:min-w-0 lg:w-0 lg:flex-1">
									<div class="flex min-h-[2.25rem] items-center justify-center border-b bg-muted/40 px-1 py-1.5 text-center text-[10px] font-bold uppercase tracking-tight text-muted-foreground">
										{col.header || '\u00a0'}
									</div>
									<div class="flex max-h-56 min-h-0 flex-col gap-1 overflow-y-auto p-1.5">
										{#each entriesForColumn(boardEntries as BoardEntryLike[], col.key) as entry (entry.id ?? entry.unitName)}
											<div class="group rounded-md border px-1.5 py-1 text-[10px] leading-tight {STATUS_COLORS[entry.status] ?? 'bg-gray-50 text-gray-700'}">
												<div class="font-medium">{formatUnitAssignmentLine(entry)}</div>
												<div class="mt-1 flex items-center gap-0.5">
													<select
														value={entry.status}
														onchange={(e) => changeUnitStatus(entry.unitName, (e.target as HTMLSelectElement).value)}
														class="h-5 min-w-0 flex-1 rounded border-0 bg-transparent px-0 text-[9px] font-medium focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
													>
														{#each UNIT_STATUSES as s (s)}
															<option value={s} selected={entry.status === s}>{s}</option>
														{/each}
													</select>
													<button
														type="button"
														onclick={() => removeUnitFromBoard(entry.unitName)}
														class="shrink-0 opacity-60 hover:opacity-100 text-red-600"
														aria-label="Remove"
													>
														<svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
													</button>
												</div>
											</div>
										{/each}
									</div>
								</div>
							{/each}
						</div>
						</div>
					</div>

					{#if legacyBoardEntries.length > 0}
						<div class="border-t px-3 py-2 sm:px-4">
							<p class="mb-1 text-[10px] font-medium text-muted-foreground">Other assignments (legacy)</p>
							<div class="flex flex-wrap gap-1">
								{#each legacyBoardEntries as entry (entry.id ?? entry.unitName)}
									<span class="rounded border px-2 py-0.5 text-[10px] {STATUS_COLORS[entry.status] ?? 'bg-gray-50'}">
										{entry.division}: {formatUnitAssignmentLine(entry)}
									</span>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			</div>
		</main>

		<aside class="order-2 flex max-h-[min(42vh,420px)] min-h-[220px] w-full shrink-0 flex-col overflow-hidden border-t border-border bg-background lg:order-none lg:max-h-none lg:min-h-0 lg:w-80 lg:border-l lg:border-t-0">
			<div class="flex shrink-0 border-b">
				<button type="button" onclick={() => (activeInstructorTab = 'controls')} class="flex-1 px-3 py-2.5 text-xs font-medium transition-colors {activeInstructorTab === 'controls' ? 'bg-background border-b-2 border-primary' : 'bg-muted/30 text-muted-foreground hover:text-foreground'}">
					Controls
				</button>
				<button type="button" onclick={() => (activeInstructorTab = 'board')} class="flex-1 px-3 py-2.5 text-xs font-medium transition-colors {activeInstructorTab === 'board' ? 'bg-background border-b-2 border-primary' : 'bg-muted/30 text-muted-foreground hover:text-foreground'}">
					Comms
				</button>
			</div>

			<div class="flex-1 overflow-y-auto p-3 space-y-3">
				{#if activeInstructorTab === 'controls'}
					<div class="rounded-lg border p-3 space-y-2">
						<h3 class="text-xs font-semibold">Dispatch View</h3>
						{#if draftSideImage}
							<div class="relative w-full overflow-hidden rounded-lg border bg-black" style="aspect-ratio: 16/9;">
								{#if hasDraftOverlays}
									{#key draftOverlayKey}
										<div class="h-full w-full">
											<OverlayCanvas baseImageUrl={draftSideImage} overlays={draftOverlays} selectedOverlayId={null} isInteractive={false} />
										</div>
									{/key}
								{:else}
									<img src={draftSideImage} alt="Draft preview" class="h-full w-full object-contain" />
								{/if}
								<div class="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
									{sideLabels[draftSide]} / {stageLabels[draftStage]}
								</div>
							</div>
						{/if}
						<div class="space-y-1.5">
							<div class="flex flex-wrap gap-1">
								{#each ['incipient', 'growth', 'fully_developed', 'decay'] as stage (stage)}
									<button type="button" onclick={() => (draftStage = stage)} class="rounded px-2 py-0.5 text-[10px] font-medium transition-colors {draftStage === stage ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}">{stageLabels[stage]}</button>
								{/each}
							</div>
							<div class="flex flex-wrap gap-1">
								{#each ['alpha', 'bravo', 'charlie', 'delta'] as side (side)}
									<button type="button" onclick={() => (draftSide = side)} class="rounded px-2 py-0.5 text-[10px] font-medium transition-colors {draftSide === side ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}">{sideLabels[side]}</button>
								{/each}
							</div>
						</div>
						<Button class="w-full" size="sm" onclick={dispatch}>Dispatch to Student</Button>
					</div>

					<div class="rounded-lg border p-3 space-y-2">
						<h3 class="text-xs font-semibold">Inject Hazard</h3>
						<div class="relative">
							<div class="flex flex-col gap-2 sm:flex-row sm:gap-1.5">
								<Input bind:value={hazardText} placeholder="Collapse, backdraft..." class="h-11 min-h-11 text-xs sm:h-8 sm:min-h-0" onfocus={() => (showHazardSuggestions = true)} />
								<Button size="sm" variant="outline" class="h-11 w-full shrink-0 sm:h-8 sm:w-auto" onclick={() => injectHazard()}>Inject</Button>
							</div>
							{#if showHazardSuggestions}
								<div class="absolute left-0 right-0 top-full z-50 mt-1 max-h-40 overflow-y-auto rounded-lg border bg-popover shadow-md">
									{#each SUGGESTED_HAZARDS as suggestion (suggestion)}
										<button type="button" class="w-full px-3 py-1.5 text-left text-xs hover:bg-accent transition-colors" onclick={() => injectHazard(suggestion)}>{suggestion}</button>
									{/each}
								</div>
								<button type="button" class="fixed inset-0 z-40" onclick={() => (showHazardSuggestions = false)} aria-label="Close"></button>
							{/if}
						</div>
					</div>

					<div class="rounded-lg border p-3 space-y-2">
						<h3 class="text-xs font-semibold">Incident Update</h3>
						<div class="relative">
							<div class="flex flex-col gap-2 sm:flex-row sm:gap-1.5">
								<Input bind:value={updateText} placeholder="Water supply, PAR..." class="h-11 min-h-11 text-xs sm:h-8 sm:min-h-0" onfocus={() => (showUpdateSuggestions = true)} />
								<Button size="sm" variant="outline" class="h-11 w-full shrink-0 sm:h-8 sm:w-auto" onclick={() => sendUpdate()}>Send</Button>
							</div>
							{#if showUpdateSuggestions}
								<div class="absolute left-0 right-0 top-full z-50 mt-1 max-h-40 overflow-y-auto rounded-lg border bg-popover shadow-md">
									{#each SUGGESTED_UPDATES as suggestion (suggestion)}
										<button type="button" class="w-full px-3 py-1.5 text-left text-xs hover:bg-accent transition-colors" onclick={() => sendUpdate(suggestion)}>{suggestion}</button>
									{/each}
								</div>
								<button type="button" class="fixed inset-0 z-40" onclick={() => (showUpdateSuggestions = false)} aria-label="Close"></button>
							{/if}
						</div>
					</div>
				{:else}
					<div class="rounded-lg border p-3">
						<h3 class="mb-2 text-xs font-semibold">Student Radio</h3>
						<div class="max-h-40 space-y-1.5 overflow-y-auto">
							{#each studentTranscripts as t (t.id)}
								<div class="flex gap-1.5 text-xs"><span class="font-mono text-muted-foreground">{t.time}</span><span>{t.transcript}</span></div>
							{:else}
								<p class="text-xs text-muted-foreground">No radio messages yet</p>
							{/each}
						</div>
					</div>

					<div>
						<h3 class="mb-2 text-xs font-semibold">Timeline</h3>
						<div class="max-h-96 space-y-1.5 overflow-y-auto">
							{#each timelineEvents as event (event.id)}
								<div class="flex gap-1.5 text-xs"><span class="shrink-0 font-mono text-muted-foreground">{event.time}</span><Badge variant="outline" class="shrink-0 text-[9px] {event.type === 'SIZE-UP' ? 'border-amber-400 bg-amber-50 text-amber-900' : ''}">{event.type}</Badge><span>{event.text}</span></div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</aside>
		</div>
	{/if}
</div>
