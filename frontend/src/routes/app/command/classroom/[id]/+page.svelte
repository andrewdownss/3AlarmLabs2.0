<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { getTrainerSocket } from '$lib/stores/socket';
	import OverlayCanvas from '$lib/components/scene-editor/konva-overlay-editor/OverlayCanvas.svelte';
	import {
		normalizeAnimationOverlays,
		type PersistedAnimationOverlay
	} from '$lib/components/scene-editor/konva-overlay-editor/overlay-utils';
	import type { AnimationOverlay } from '$lib/components/scene-editor/konva-overlay-editor/overlay-types';
	import {
		buildBoardColumns,
		commandBoardHeader,
		entriesForColumn,
		formatUnitAssignmentLine,
		type BoardColumnState,
		type BoardEntryLike
	} from '$lib/trainer-command-board';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	interface Participant {
		id: string;
		displayName: string;
		lastSeenAt: string | Date;
	}

	interface BoardEntry {
		id: string;
		slotIndex?: number | null;
		division: string;
		unitName: string;
		assignment: string | null;
		status: string;
	}

	interface ScenarioSnapshot {
		id: string;
		title: string;
		description?: string | null;
		dispatchNotes?: string | null;
		sideAlphaImageUrl?: string | null;
		sideBravoImageUrl?: string | null;
		sideCharlieImageUrl?: string | null;
		sideDeltaImageUrl?: string | null;
		selfPacedConfigJson?: unknown;
		stageMetadataJson?: unknown;
		defaultResources?: Array<{ unitName: string }> | null;
	}

	interface ClassroomActiveSession {
		id: string;
		scenarioId: string;
		activeStage: string;
		activeSide: string;
		hasStarted: boolean;
		startedAt?: string | Date | null;
	}

	const stageOptions = [
		['incipient', 'Incipient'],
		['growth', 'Growth'],
		['fully_developed', 'Fully Developed'],
		['decay', 'Decay']
	] as const;
	const sideOptions = [
		['alpha', 'Side Alpha'],
		['bravo', 'Side Bravo'],
		['charlie', 'Side Charlie'],
		['delta', 'Side Delta']
	] as const;

	const stageLabels: Record<string, string> = {
		incipient: 'Incipient',
		growth: 'Growth',
		fully_developed: 'Fully Developed',
		decay: 'Decay'
	};
	const stageBadgeClass: Record<string, string> = {
		incipient: 'bg-blue-500',
		growth: 'bg-yellow-500',
		fully_developed: 'bg-red-500',
		decay: 'bg-green-500'
	};
	const sideLabels: Record<string, string> = {
		alpha: 'Side Alpha',
		bravo: 'Side Bravo',
		charlie: 'Side Charlie',
		delta: 'Side Delta'
	};
	const STATUS_COLORS: Record<string, string> = {
		Assigned: 'bg-blue-100 text-blue-700',
		'En Route': 'bg-amber-100 text-amber-700',
		'On Scene': 'bg-purple-100 text-purple-700',
		Operating: 'bg-green-100 text-green-700',
		'PAR Completed': 'bg-emerald-100 text-emerald-800',
		Available: 'bg-gray-100 text-gray-600',
		'Out of Service': 'bg-red-100 text-red-700'
	};

	const socket = getTrainerSocket();

	let selectedScenarioId = $state(data.scenarios[0]?.id ?? '');
	let activeSession = $state<ClassroomActiveSession | null>(
		data.activeSession as ClassroomActiveSession | null
	);
	let activeScenario = $state<ScenarioSnapshot | null>(data.activeScenario ?? null);
	let participants = $state<Participant[]>(data.participants);
	let boardEntries = $state<BoardEntry[]>(data.boardEntries);
	let boardColumns = $state<BoardColumnState[]>(buildBoardColumns(data.boardColumns));
	let calledOnParticipantId = $state<string | null>(data.classroom.calledOnParticipantId);
	let useSelfPacedScript = $state(data.classroom.useSelfPacedScript);
	let savedUseSelfPacedScript = $state(data.classroom.useSelfPacedScript);
	const optionsDirty = $derived(useSelfPacedScript !== savedUseSelfPacedScript);
	let currentStage = $state(data.activeSession?.activeStage ?? 'incipient');
	let currentSide = $state(data.activeSession?.activeSide ?? 'alpha');
	let isLoadingScenario = $state(false);
	let isStartingScenario = $state(false);
	let isEndingClassroom = $state(false);
	let statusMessage = $state('Connecting...');
	let codeCopied = $state(false);
	let sessionSeconds = $state(0);
	let clockInterval: ReturnType<typeof setInterval> | null = null;
	let endClassroomForm: HTMLFormElement | null = null;
	let timelineEvents = $state<Array<{ id: string; type: string; text: string; time: string }>>([]);
	let asideTab = $state<'roster' | 'comms'>('roster');

	const hasStarted = $derived(Boolean(activeSession?.hasStarted));
	const selectedScenario = $derived(data.scenarios.find((scenario) => scenario.id === selectedScenarioId));
	const selectedScenarioHasScript = $derived(Boolean(selectedScenario?.selfPacedConfigJson));
	const isSelfPacedScenario = $derived(Boolean(activeScenario?.selfPacedConfigJson));
	const isSelfPacedScriptActive = $derived(isSelfPacedScenario && useSelfPacedScript);
	const calledOnParticipant = $derived(
		participants.find((participant) => participant.id === calledOnParticipantId) ?? null
	);
	const joinUrl = $derived(
		typeof window === 'undefined' ? data.joinUrl : `${window.location.origin}${data.joinUrl}`
	);
	const currentImage = $derived.by(() => {
		if (!activeScenario) return null;
		const map = {
			alpha: activeScenario.sideAlphaImageUrl,
			bravo: activeScenario.sideBravoImageUrl,
			charlie: activeScenario.sideCharlieImageUrl,
			delta: activeScenario.sideDeltaImageUrl
		};
		return map[currentSide as keyof typeof map] ?? activeScenario.sideAlphaImageUrl ?? null;
	});

	type StageOverlays = Record<string, AnimationOverlay[]>;
	type SideStageOverlays = Record<string, StageOverlays>;

	function parsePersistedOverlays(value: unknown): PersistedAnimationOverlay[] | undefined {
		if (!Array.isArray(value)) return undefined;
		return value as PersistedAnimationOverlay[];
	}

	function getOverlaysForSideStage(side: string, stage: string): AnimationOverlay[] {
		const meta = (activeScenario?.stageMetadataJson ?? {}) as SideStageOverlays;
		const raw = (meta[side] as StageOverlays)?.[stage];
		return normalizeAnimationOverlays(parsePersistedOverlays(raw));
	}

	const currentOverlays = $derived(getOverlaysForSideStage(currentSide, currentStage));
	const hasOverlays = $derived(currentOverlays.length > 0);
	const overlayKey = $derived(`${currentSide}-${currentStage}`);

	const availableUnits = $derived(
		(activeScenario?.defaultResources ?? []).filter(
			(r: { unitName: string }) => !boardEntries.some((entry) => entry.unitName === r.unitName)
		)
	);

	function formatClock(seconds: number) {
		const m = Math.floor(seconds / 60)
			.toString()
			.padStart(2, '0');
		const s = (seconds % 60).toString().padStart(2, '0');
		return `${m}:${s}`;
	}

	function syncClock(startedAtIso: string) {
		const elapsed = Math.floor((Date.now() - new Date(startedAtIso).getTime()) / 1000);
		sessionSeconds = Math.max(0, elapsed);
	}

	function addTimelineEvent(type: string, text: string, atSeconds = sessionSeconds) {
		timelineEvents = [
			...timelineEvents,
			{ id: crypto.randomUUID(), type, text, time: formatClock(atSeconds) }
		];
	}

	function formatBoardTimelineLine(entry: BoardEntry) {
		return formatUnitAssignmentLine({
			...entry,
			assignment: entry.assignment ?? ''
		} as BoardEntryLike);
	}

	function joinClassroom() {
		socket?.emit('classroom:join', { classroomId: data.classroom.id });
	}

	function loadScenario() {
		if (!selectedScenarioId) return;
		isLoadingScenario = true;
		socket?.emit('classroom:load-scenario', {
			classroomId: data.classroom.id,
			scenarioId: selectedScenarioId
		});
	}

	function startScenario() {
		if (!activeSession?.id) return;
		isStartingScenario = true;
		socket?.emit('classroom:start-scenario', { classroomId: data.classroom.id });
	}

	function endScenario() {
		if (!confirm('End the current simulation? Students will return to the waiting room.')) return;
		socket?.emit('classroom:end-scenario', { classroomId: data.classroom.id });
	}

	function saveCurrentSession() {
		if (!activeSession?.id) return;
		socket?.emit('classroom:save-session', { classroomId: data.classroom.id });
	}

	function configureBoardColumn(col: BoardColumnState) {
		if (col.isFixed || !activeSession?.id) return;
		const label = prompt('Division/group label', col.label || '');
		if (label === null) return;
		if (!label.trim()) {
			socket?.emit('board:clear-column', { sessionId: activeSession.id, slotIndex: col.slotIndex });
			return;
		}
		const kind = confirm('Is this a geographic division? Choose Cancel for a task group.')
			? 'division'
			: 'group';
		socket?.emit('board:rename-column', {
			sessionId: activeSession.id,
			slotIndex: col.slotIndex,
			label: label.trim(),
			kind
		});
		const supervisorUnit = prompt('Supervisor unit (optional)', col.supervisorUnit ?? '');
		if (supervisorUnit?.trim()) {
			socket?.emit('board:set-column-supervisor', {
				sessionId: activeSession.id,
				slotIndex: col.slotIndex,
				unitName: supervisorUnit.trim(),
				kind,
				label: label.trim()
			});
		}
	}

	function endClassroom() {
		if (isEndingClassroom) return;
		if (!confirm('End this classroom? Students will be shown that the session has ended.')) return;
		isEndingClassroom = true;
		if (!socket?.connected) {
			endClassroomForm?.requestSubmit();
			return;
		}
		let didFinish = false;
		const finish = () => {
			if (didFinish) return;
			didFinish = true;
			void goto('/app/command/classroom');
		};
		const fallbackTimer = setTimeout(finish, 1500);
		socket.emit('classroom:end', { classroomId: data.classroom.id }, () => {
			clearTimeout(fallbackTimer);
			finish();
		});
	}

	function dispatchState(patch: { stage?: string; side?: string }) {
		if (!activeSession?.id) return;
		socket?.emit('trainer:state:dispatch', { sessionId: activeSession.id, ...patch });
		if (patch.stage) currentStage = patch.stage;
		if (patch.side) currentSide = patch.side;
	}

	function callOn(participantId: string) {
		socket?.emit('classroom:call-on', { classroomId: data.classroom.id, participantId });
	}

	function standDown() {
		socket?.emit('classroom:stand-down', { classroomId: data.classroom.id });
	}

	function kick(participantId: string) {
		if (!confirm('Remove this student from the classroom?')) return;
		socket?.emit('classroom:kick', { classroomId: data.classroom.id, participantId });
		participants = participants.filter((participant) => participant.id !== participantId);
	}

	async function copyJoinUrl() {
		try {
			await navigator.clipboard?.writeText(joinUrl);
			codeCopied = true;
			setTimeout(() => (codeCopied = false), 1500);
		} catch (error) {
			console.error('Could not copy join URL:', error);
		}
	}

	onMount(() => {
		if (!socket) {
			statusMessage = 'Socket unavailable';
			return;
		}

		if (data.activeSession?.startedAt) {
			syncClock(new Date(data.activeSession.startedAt).toISOString());
		}
		clockInterval = setInterval(() => {
			if (hasStarted) sessionSeconds++;
		}, 1000);

		socket.on('connect', joinClassroom);
		socket.on('classroom:snapshot', (payload) => {
			statusMessage = 'Connected';
			activeSession = (payload.activeSession ?? null) as ClassroomActiveSession | null;
			activeScenario = (payload.scenario ?? null) as ScenarioSnapshot | null;
			participants = payload.participants ?? participants;
			boardEntries = payload.boardEntries ?? [];
			boardColumns = buildBoardColumns(payload.boardColumns);
			calledOnParticipantId = payload.calledOnParticipantId ?? null;
			if (payload.useSelfPacedScript !== undefined) {
				useSelfPacedScript = payload.useSelfPacedScript;
				savedUseSelfPacedScript = payload.useSelfPacedScript;
			}
			currentStage = payload.activeSession?.activeStage ?? currentStage;
			currentSide = payload.activeSession?.activeSide ?? currentSide;
			if (payload.activeSession?.hasStarted && payload.activeSession?.startedAt) {
				syncClock(new Date(payload.activeSession.startedAt).toISOString());
			} else {
				sessionSeconds = 0;
			}
			timelineEvents = [];
		});
		socket.on('classroom:scenario-loaded', (payload) => {
			isLoadingScenario = false;
			activeSession = (payload.session ?? null) as ClassroomActiveSession | null;
			activeScenario = (payload.scenario ?? null) as ScenarioSnapshot | null;
			currentStage = payload.session?.activeStage ?? 'incipient';
			currentSide = payload.session?.activeSide ?? 'alpha';
			boardEntries = payload.boardEntries ?? [];
			boardColumns = buildBoardColumns(payload.boardColumns);
			sessionSeconds = 0;
			timelineEvents = [];
			statusMessage = 'Scenario loaded — press Start when ready';
		});
		socket.on(
			'classroom:scenario-started',
			(payload: { sessionId: string; startedAt: string }) => {
				isStartingScenario = false;
				if (activeSession) {
					activeSession = {
						...activeSession,
						hasStarted: true,
						startedAt: payload.startedAt
					};
				}
				if (payload.startedAt) syncClock(payload.startedAt);
				addTimelineEvent('START', 'Simulation started', 0);
				statusMessage = 'Live';
			}
		);
		socket.on('classroom:scenario-ended', () => {
			addTimelineEvent('END', 'Simulation ended');
			activeSession = null;
			activeScenario = null;
			boardEntries = [];
			boardColumns = buildBoardColumns();
			calledOnParticipantId = null;
			sessionSeconds = 0;
			statusMessage = 'Scenario ended';
		});
		socket.on('classroom:ended', () => {
			statusMessage = 'Classroom ended';
			void goto('/app/command/classroom');
		});
		socket.on('classroom:session-saved', () => {
			statusMessage = 'Saved — appears in Past simulations';
		});
		socket.on('classroom:participants', (payload: { participants?: Participant[] }) => {
			participants = payload.participants ?? participants;
		});
		socket.on('classroom:control-changed', (payload: { calledOnParticipantId?: string | null }) => {
			calledOnParticipantId = payload.calledOnParticipantId ?? null;
		});
		socket.on('trainer:state:dispatched', (payload: { stage?: string; side?: string; update?: string; hazard?: string; source?: string; offsetSeconds?: number }) => {
			if (payload.stage) currentStage = payload.stage;
			if (payload.side) currentSide = payload.side;
			const eventSeconds =
				payload.source === 'timeline' && typeof payload.offsetSeconds === 'number'
					? payload.offsetSeconds
					: sessionSeconds;
			if (payload.stage) {
				addTimelineEvent('STAGE', `Stage changed to ${stageLabels[payload.stage] ?? payload.stage}`, eventSeconds);
			}
			if (payload.side) {
				addTimelineEvent('SIDE', `Viewing ${sideLabels[payload.side] ?? payload.side}`, eventSeconds);
			}
			if (payload.hazard) addTimelineEvent('HAZARD', payload.hazard, eventSeconds);
			if (payload.update) addTimelineEvent('UPDATE', payload.update, eventSeconds);
		});
		socket.on('trainer:board:updated', (payload: { entry?: BoardEntry; entries?: BoardEntry[]; boardColumns?: BoardColumnState[] }) => {
			if (payload.entries) {
				boardEntries = payload.entries;
				boardColumns = buildBoardColumns(payload.boardColumns);
				if (payload.entry) addTimelineEvent('BOARD', formatBoardTimelineLine(payload.entry));
				return;
			}
			const entry = payload.entry;
			if (!entry?.unitName) return;
			boardEntries = boardEntries.some((item) => item.unitName === entry.unitName)
				? boardEntries.map((item) =>
						item.unitName === entry.unitName ? { ...item, ...entry } : item
					)
				: [...boardEntries, entry];
			addTimelineEvent('BOARD', formatBoardTimelineLine(entry));
		});
		socket.on('trainer:board:removed', (payload: { unitName: string }) => {
			boardEntries = boardEntries.filter((entry) => entry.unitName !== payload.unitName);
			addTimelineEvent('BOARD', `${payload.unitName} removed`);
		});
		socket.on(
			'trainer:board:status-changed',
			(payload: { unitName: string; status: string }) => {
				boardEntries = boardEntries.map((entry) =>
					entry.unitName === payload.unitName ? { ...entry, status: payload.status } : entry
				);
				addTimelineEvent('STATUS', `${payload.unitName} ${payload.status}`);
			}
		);
		socket.on('trainer:session:ended', (payload?: { reason?: string }) => {
			addTimelineEvent('END', payload?.reason === 'classroom_ended' ? 'Classroom ended' : 'Simulation ended');
		});
		socket.on(
			'trainer:radio:transcribed',
			(payload: { transcript?: string }) => {
				if (!payload.transcript) return;
				addTimelineEvent('RADIO', payload.transcript);
			}
		);

		if (socket.connected) joinClassroom();
	});

	onDestroy(() => {
		if (clockInterval) clearInterval(clockInterval);
		socket?.off('connect', joinClassroom);
		socket?.off('classroom:snapshot');
		socket?.off('classroom:scenario-loaded');
		socket?.off('classroom:scenario-started');
		socket?.off('classroom:scenario-ended');
		socket?.off('classroom:ended');
		socket?.off('classroom:session-saved');
		socket?.off('classroom:participants');
		socket?.off('classroom:control-changed');
		socket?.off('trainer:state:dispatched');
		socket?.off('trainer:board:updated');
		socket?.off('trainer:board:removed');
		socket?.off('trainer:board:status-changed');
		socket?.off('trainer:session:ended');
		socket?.off('trainer:radio:transcribed');
	});
</script>

<svelte:head>
	<title>{data.classroom.name} | Classroom</title>
</svelte:head>

<div class="flex h-dvh max-h-dvh flex-col overflow-hidden bg-background">
	<header
		class="flex shrink-0 flex-col gap-2 border-b px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-3"
	>
		<div class="flex min-w-0 flex-wrap items-center gap-2 gap-y-1.5">
			<h1 class="max-w-full truncate text-base font-semibold sm:text-lg">
				{data.classroom.name}
			</h1>
			<Badge variant="outline" class="shrink-0 font-mono tracking-[0.25em]">
				{data.classroom.code}
			</Badge>
			{#if hasStarted}
				<Badge class="shrink-0 bg-green-500 text-white">LIVE</Badge>
				<span class="shrink-0 font-mono text-xs text-muted-foreground sm:text-sm">
					{formatClock(sessionSeconds)}
				</span>
				{#if isSelfPacedScriptActive}
					<Badge variant="outline" class="shrink-0">Self-paced script</Badge>
				{:else if isSelfPacedScenario}
					<Badge variant="outline" class="shrink-0">Script off</Badge>
				{/if}
			{:else if activeSession}
				<Badge variant="secondary" class="shrink-0">Loaded</Badge>
				{#if isSelfPacedScriptActive}
					<Badge variant="outline" class="shrink-0">Self-paced script</Badge>
				{:else if isSelfPacedScenario}
					<Badge variant="outline" class="shrink-0">Script off</Badge>
				{/if}
			{:else}
				<Badge variant="secondary" class="shrink-0">Idle</Badge>
			{/if}
			<Badge class="shrink-0" variant="outline">Instructor</Badge>
		</div>
		<div class="flex w-full shrink-0 gap-2 sm:w-auto">
			<Button variant="outline" size="sm" class="min-h-9 flex-1 sm:flex-none" onclick={copyJoinUrl}>
				{codeCopied ? 'Copied' : 'Copy join link'}
			</Button>
			<form method="POST" action="?/end" bind:this={endClassroomForm} class="hidden"></form>
			<Button
				type="button"
				variant="destructive"
				size="sm"
				class="min-h-9 flex-1 sm:flex-none"
				onclick={endClassroom}
				disabled={isEndingClassroom}
			>
				{isEndingClassroom ? 'Ending…' : 'End classroom'}
			</Button>
		</div>
	</header>

	<div
		class="flex shrink-0 flex-col gap-2 border-b bg-muted/30 px-3 py-2 sm:px-4 lg:flex-row lg:items-center lg:gap-3"
	>
		<div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
			<label class="flex min-w-0 flex-1 items-center gap-2" for="classroom-scenario">
				<span class="shrink-0 text-xs font-semibold text-muted-foreground">Simulation</span>
				<select
					id="classroom-scenario"
					bind:value={selectedScenarioId}
					class="h-9 min-w-0 flex-1 rounded-md border bg-background px-2 text-xs focus:ring-2 focus:ring-ring focus:outline-none sm:text-sm"
				>
					{#if data.scenarios.length === 0}
						<option value="">No scenarios available</option>
					{/if}
					{#each data.scenarios as scenario (scenario.id)}
						<option value={scenario.id}>
							{scenario.title}{scenario.isLibrary ? ' · Library' : ''}
						</option>
					{/each}
				</select>
			</label>
			<Button
				size="sm"
				class="min-h-9"
				onclick={loadScenario}
				disabled={!selectedScenarioId || isLoadingScenario || optionsDirty}
				title={optionsDirty ? 'Save class options before loading a simulation' : undefined}
			>
				{isLoadingScenario ? 'Loading…' : activeSession ? 'Swap simulation' : 'Load simulation'}
			</Button>
			{#if activeSession && !hasStarted}
				<Button
					size="sm"
					class="min-h-9 bg-green-600 text-white hover:bg-green-600/90"
					onclick={startScenario}
					disabled={isStartingScenario || optionsDirty}
					title={optionsDirty ? 'Save class options before starting' : undefined}
				>
					{isStartingScenario ? 'Starting…' : 'Start simulation'}
				</Button>
			{/if}
			{#if activeSession}
				<Button variant="outline" size="sm" class="min-h-9" onclick={saveCurrentSession}>
					Save sim
				</Button>
				<Button variant="outline" size="sm" class="min-h-9" onclick={endScenario}>
					End sim
				</Button>
			{/if}
		</div>
		<div
			class="flex shrink-0 flex-wrap items-center gap-2 text-xs text-muted-foreground sm:text-sm"
		>
			<span>{participants.length} student{participants.length === 1 ? '' : 's'}</span>
			{#if calledOnParticipant}
				<Badge class="bg-orange-500 text-white">
					On the air: {calledOnParticipant.displayName}
				</Badge>
				<Button variant="outline" size="sm" class="min-h-8" onclick={standDown}>
					Stand down
				</Button>
			{/if}
			<span class="hidden text-xs text-muted-foreground sm:inline">{statusMessage}</span>
		</div>
	</div>

	{#if !hasStarted}
		<form
			method="POST"
			action="?/updateOptions"
			use:enhance={() => {
				return async ({ result, update }) => {
					await update();
					if (result.type === 'success') {
						savedUseSelfPacedScript = useSelfPacedScript;
					}
				};
			}}
			class="shrink-0 border-b bg-background px-3 py-2 sm:px-4"
		>
			<div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
				<div>
					<div class="flex flex-wrap items-center gap-2">
						<p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							Class options
						</p>
						{#if optionsDirty}
							<Badge variant="outline" class="border-amber-300 bg-amber-50 text-amber-800">
								Unsaved changes
							</Badge>
						{:else}
							<Badge variant="outline" class="border-emerald-300 bg-emerald-50 text-emerald-800">
								Saved
							</Badge>
						{/if}
					</div>
					<p class="mt-0.5 text-xs text-muted-foreground">
						Set how this classroom runs before loading or starting the sim.
					</p>
				</div>
				<div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
					<label class="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
						<input
							type="checkbox"
							name="useSelfPacedScript"
							bind:checked={useSelfPacedScript}
							class="h-4 w-4 rounded border-border"
						/>
						<span>
							Use self-paced script
							{#if selectedScenarioHasScript}
								<span class="text-xs text-muted-foreground">(selected sim has script)</span>
							{:else}
								<span class="text-xs text-muted-foreground">(no script on selected sim)</span>
							{/if}
						</span>
					</label>
					<Button
						type="submit"
						variant="outline"
						size="sm"
						class="min-h-9"
						disabled={!optionsDirty}
					>
						Save options
					</Button>
				</div>
			</div>
		</form>
	{/if}

	{#if form?.error}
		<div
			class="shrink-0 border-b border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs text-destructive sm:px-4"
		>
			{form.error}
		</div>
	{/if}

	{#if !activeSession}
		<div class="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
			<main class="order-1 flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto p-4 sm:p-6">
				<div class="mx-auto w-full max-w-2xl rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
					<p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
						Classroom code
					</p>
					<div class="mt-2 flex flex-wrap items-center gap-3">
						<h2 class="font-mono text-3xl font-bold tracking-[0.35em] sm:text-4xl">
							{data.classroom.code}
						</h2>
						<Button variant="outline" size="sm" class="min-h-9" onclick={copyJoinUrl}>
							{codeCopied ? 'Copied' : 'Copy link'}
						</Button>
						<form method="POST" action="?/regenerateCode" use:enhance>
							<Button type="submit" variant="outline" size="sm" class="min-h-9">
								Regenerate
							</Button>
						</form>
					</div>
					<p class="mt-2 break-all text-xs text-muted-foreground">{joinUrl}</p>
					<div class="mt-6 rounded-xl border bg-muted/30 p-4 text-sm leading-6 text-muted-foreground">
						<p class="font-medium text-foreground">Ready to teach?</p>
						<ol class="mt-2 list-decimal space-y-1 pl-5">
							<li>Share the code or link above with your students.</li>
							<li>
								Pick a simulation in the toolbar and click <span class="font-semibold"
									>Load simulation</span
								>.
							</li>
							<li>
								Press <span class="font-semibold">Start simulation</span> when you're ready —
								students will move from the waiting room to the live view.
							</li>
							<li>
								Use <span class="font-semibold">Call on</span> in the roster to give a student radio
								and board control.
							</li>
						</ol>
					</div>
				</div>
			</main>

			{@render rosterAside()}
		</div>
	{:else if !hasStarted}
		<div class="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
			<main class="order-1 flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto p-4 sm:p-6">
				<div class="mx-auto w-full max-w-3xl space-y-4">
					<div class="rounded-2xl border bg-card p-6 shadow-sm">
						<div class="flex flex-wrap items-center justify-between gap-3">
							<div>
								<p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
									Loaded simulation
								</p>
								<h2 class="mt-1 text-2xl font-semibold">{activeScenario?.title}</h2>
							</div>
							<Badge variant="secondary">Waiting to start</Badge>
						</div>
						{#if activeScenario?.sideAlphaImageUrl}
							<img
								src={activeScenario.sideAlphaImageUrl}
								alt="Initial scene"
								class="mt-4 h-48 w-full rounded-lg border object-cover"
							/>
						{/if}
						{#if activeScenario?.dispatchNotes}
							<p class="mt-4 whitespace-pre-line text-sm text-muted-foreground">
								{activeScenario.dispatchNotes}
							</p>
						{/if}
						<div class="mt-6 flex flex-wrap gap-2">
							<Button
								class="min-h-12 px-6 text-base font-semibold"
								onclick={startScenario}
								disabled={isStartingScenario || optionsDirty}
								title={optionsDirty ? 'Save class options before starting' : undefined}
							>
								{isStartingScenario ? 'Starting…' : 'Start simulation'}
							</Button>
							<Button variant="outline" class="min-h-12" onclick={endScenario}>
								Cancel and unload
							</Button>
						</div>
					</div>
					<div class="rounded-2xl border bg-card p-5 shadow-sm">
						<p class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							{participants.length} student{participants.length === 1 ? '' : 's'} waiting
						</p>
						{#if participants.length > 0}
							<div class="mt-2 flex flex-wrap gap-1.5">
								{#each participants as participant (participant.id)}
									<Badge variant="secondary">{participant.displayName}</Badge>
								{/each}
							</div>
						{:else}
							<p class="mt-2 text-sm text-muted-foreground">
								Share code <span class="font-mono font-semibold">{data.classroom.code}</span> to
								have students join.
							</p>
						{/if}
					</div>
				</div>
			</main>

			{@render rosterAside()}
		</div>
	{:else}
		<div class="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
			<main class="order-1 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:order-0">
				<div class="flex shrink-0 justify-center border-b bg-muted/30 px-2 py-2">
					<div class="w-full">
						<div
							class="relative mx-auto h-[min(34vh,320px)] w-full overflow-hidden rounded-lg bg-muted shadow-sm ring-1 ring-border/60 sm:h-[min(38vh,380px)] xl:h-[min(42vh,420px)]"
						>
							{#if currentImage && hasOverlays}
								{#key overlayKey}
									<img
										src={currentImage}
										alt=""
										aria-hidden="true"
										class="absolute inset-0 h-full w-full scale-110 object-contain opacity-60 blur-md"
									/>
									<div class="absolute inset-0 z-10">
										<OverlayCanvas
											baseImageUrl={currentImage}
											overlays={currentOverlays}
											selectedOverlayId={null}
											isInteractive={false}
										/>
									</div>
								{/key}
							{:else if currentImage}
								<img
									src={currentImage}
									alt={sideLabels[currentSide] ?? currentSide}
									class="h-full w-full object-contain"
								/>
							{:else}
								<div class="flex h-full w-full items-center justify-center text-muted-foreground">
									No image for {sideLabels[currentSide] ?? currentSide}
								</div>
							{/if}
							<div class="pointer-events-none absolute bottom-2 left-2 z-20 flex items-center gap-2">
								<span class="rounded bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
									{sideLabels[currentSide] ?? ''}
								</span>
								<span
									class="rounded px-2 py-0.5 text-xs font-bold text-white {stageBadgeClass[
										currentStage
									] ?? 'bg-gray-500'}"
								>
									{stageLabels[currentStage] ?? currentStage}
								</span>
							</div>
						</div>
					</div>
				</div>

				<div class="flex shrink-0 flex-wrap items-center gap-2 border-b bg-muted/10 px-3 py-2 sm:px-4">
					<span class="text-xs font-semibold text-muted-foreground">Stage</span>
					{#each stageOptions as [value, label] (value)}
						<button
							type="button"
							onclick={() => dispatchState({ stage: value })}
							class="rounded-md border px-2 py-1 text-xs font-medium transition-colors {currentStage ===
							value
								? 'border-primary bg-primary text-primary-foreground'
								: 'bg-background hover:bg-muted'}"
						>
							{label}
						</button>
					{/each}
					<span class="ml-2 text-xs font-semibold text-muted-foreground">Side</span>
					{#each sideOptions as [value, label] (value)}
						<button
							type="button"
							onclick={() => dispatchState({ side: value })}
							class="rounded-md border px-2 py-1 text-xs font-medium transition-colors {currentSide ===
							value
								? 'border-primary bg-primary text-primary-foreground'
								: 'bg-background hover:bg-muted'}"
						>
							{label}
						</button>
					{/each}
				</div>

				<div class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
					<div
						class="flex shrink-0 flex-col gap-1 border-b px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
					>
						<h3 class="text-xs font-semibold">Incident Command Board</h3>
						<span class="text-[11px] text-muted-foreground sm:text-xs">
							{boardEntries.length} assigned · {availableUnits.length} available
						</span>
					</div>

					{#if availableUnits.length > 0}
						<div class="shrink-0 border-b px-3 py-2">
							<p
								class="mb-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase"
							>
								Available
							</p>
							<div class="flex flex-wrap gap-1.5">
								{#each availableUnits as resource (resource.unitName)}
									<Badge variant="secondary" class="gap-1 py-0 text-[10px]">
										<span class="h-1 w-1 rounded-full bg-green-500"></span>
										{resource.unitName}
									</Badge>
								{/each}
							</div>
						</div>
					{/if}

					<div class="min-h-0 flex-1 overflow-hidden px-1 py-1.5">
						<div class="-mx-1 overflow-x-auto overflow-y-hidden px-1 pb-1">
							<div class="flex h-full min-h-[120px] w-max gap-0.5">
								{#each boardColumns as col (col.key)}
									<div
										class="flex min-h-0 w-19 shrink-0 flex-col border sm:w-21 {col.colorClass}"
									>
										<button
											type="button"
											onclick={() => configureBoardColumn(col)}
											disabled={col.isFixed}
											class="flex min-h-8 shrink-0 flex-col items-center justify-center border-b border-inherit bg-white/45 px-0.5 py-1 text-center text-[9px] leading-tight font-bold tracking-tight text-muted-foreground uppercase"
										>
											<span>{commandBoardHeader(col) || '\u00a0'}</span>
											{#if col.supervisorUnit}
												<span class="mt-0.5 rounded bg-white/70 px-1 text-[7px] normal-case">
													SUP: {col.supervisorUnit}
												</span>
											{/if}
										</button>
										<div class="min-h-0 flex-1 space-y-1 overflow-y-auto p-1">
											{#each entriesForColumn(boardEntries as BoardEntryLike[], col) as entry (entry.id ?? entry.unitName)}
												<div
													class="w-full rounded border px-1.5 py-1 text-[9px] leading-tight font-medium {STATUS_COLORS[
														entry.status
													] ?? 'bg-gray-50 text-gray-700'}"
												>
													{formatUnitAssignmentLine(entry)}
													<div class="mt-0.5 text-[8px] opacity-70">{entry.status}</div>
												</div>
											{/each}
										</div>
									</div>
								{/each}
							</div>
						</div>
					</div>
				</div>
			</main>

			{@render rosterAside()}
		</div>
	{/if}
</div>

{#snippet rosterAside()}
	<aside
		class="order-2 flex max-h-[min(45vh,420px)] min-h-[200px] w-full shrink-0 flex-col overflow-hidden border-t border-border bg-background lg:max-h-none lg:min-h-0 lg:w-72 lg:border-t-0 lg:border-l"
	>
		<div class="flex shrink-0 border-b">
			<button
				type="button"
				onclick={() => (asideTab = 'roster')}
				class="flex-1 px-3 py-2.5 text-xs font-medium transition-colors {asideTab === 'roster'
					? 'border-b-2 border-primary bg-background'
					: 'bg-muted/30 text-muted-foreground hover:text-foreground'}"
			>
				Roster ({participants.length})
			</button>
			<button
				type="button"
				onclick={() => (asideTab = 'comms')}
				class="flex-1 px-3 py-2.5 text-xs font-medium transition-colors {asideTab === 'comms'
					? 'border-b-2 border-primary bg-background'
					: 'bg-muted/30 text-muted-foreground hover:text-foreground'}"
			>
				Comms ({timelineEvents.length})
			</button>
		</div>
		<div class="min-h-0 flex-1 overflow-y-auto p-3">
			{#if asideTab === 'roster'}
				{#if participants.length === 0}
					<p class="text-sm text-muted-foreground">
						Students will appear here after they enter their display name.
					</p>
				{:else}
					<div class="flex flex-col gap-2">
						{#each participants as participant (participant.id)}
							<div class="rounded-lg border bg-card p-2.5">
								<div class="flex items-center justify-between gap-2">
									<div class="min-w-0 flex-1">
										<p class="truncate text-sm font-medium">{participant.displayName}</p>
										{#if participant.id === calledOnParticipantId}
											<p class="text-[10px] font-semibold text-orange-600">On the air</p>
										{/if}
									</div>
								</div>
								<div class="mt-2 flex gap-1.5">
									{#if participant.id === calledOnParticipantId}
										<Button
											variant="outline"
											size="sm"
											class="min-h-8 flex-1"
											onclick={standDown}
										>
											Stand down
										</Button>
									{:else}
										<Button
											size="sm"
											class="min-h-8 flex-1"
											onclick={() => callOn(participant.id)}
											disabled={!hasStarted}
										>
											Call on
										</Button>
									{/if}
									<Button
										variant="outline"
										size="sm"
										class="min-h-8 text-destructive hover:text-destructive"
										onclick={() => kick(participant.id)}
									>
										Kick
									</Button>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			{:else}
				<h3 class="mb-2 text-xs font-semibold">Timeline & radio</h3>
				{#if timelineEvents.length === 0}
					<p class="text-xs text-muted-foreground">
						{isSelfPacedScenario
							? 'Scripted timeline events will appear here as the sim runs.'
							: calledOnParticipant
								? `${calledOnParticipant.displayName} can hold-to-talk on their device.`
								: 'Call on a student to let them use the radio.'}
					</p>
				{:else}
					<ul class="space-y-1.5">
						{#each timelineEvents as event (event.id)}
							<li class="flex gap-1.5 text-xs">
								<span class="shrink-0 font-mono text-muted-foreground">{event.time}</span>
								<Badge variant="outline" class="shrink-0 text-[9px]">{event.type}</Badge>
								<span>{event.text}</span>
							</li>
						{/each}
					</ul>
				{/if}
			{/if}
		</div>
	</aside>
{/snippet}
