<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
	import { Badge } from '$lib/components/ui/badge';

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
	import type { PageData } from './$types';

	type SessionEndedReason = 'classroom_ended' | 'kicked';

	let { data }: { data: PageData } = $props();

	interface BoardEntry {
		id: string;
		slotIndex?: number | null;
		division: string;
		unitName: string;
		assignment: string | null;
		location?: string | null;
		status: string;
	}

	interface ScenarioSnapshot {
		id: string;
		title: string;
		description?: string | null;
		alarmLevel?: string | null;
		dispatchNotes?: string | null;
		sideAlphaImageUrl?: string | null;
		sideBravoImageUrl?: string | null;
		sideCharlieImageUrl?: string | null;
		sideDeltaImageUrl?: string | null;
		stageMetadataJson?: unknown;
		defaultResources?: Array<{ unitName: string; status?: string }> | null;
	}

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

	function readInitialLiveState(pageData: PageData) {
		return {
			activeSessionId: pageData.activeSession?.id ?? null,
			hasStarted: Boolean(pageData.activeSession?.hasStarted),
			scenario: pageData.scenario ?? null,
			currentStage: pageData.activeSession?.activeStage ?? 'incipient',
			currentSide: pageData.activeSession?.activeSide ?? 'alpha',
			startedAt: pageData.activeSession?.startedAt ?? null,
			calledOnParticipantId: pageData.classroom.calledOnParticipantId,
			boardEntries: pageData.boardEntries as BoardEntry[],
			boardColumns: buildBoardColumns(pageData.boardColumns)
		};
	}

	const initialLiveState = untrack(() => readInitialLiveState(data));

	let activeSessionId = $state(initialLiveState.activeSessionId);
	let hasStarted = $state(initialLiveState.hasStarted);
	let scenario = $state<ScenarioSnapshot | null>(initialLiveState.scenario);
	let currentStage = $state(initialLiveState.currentStage);
	let currentSide = $state(initialLiveState.currentSide);
	let calledOnParticipantId = $state(initialLiveState.calledOnParticipantId);
	let boardEntries = $state<BoardEntry[]>(initialLiveState.boardEntries);
	let boardColumns = $state<BoardColumnState[]>(initialLiveState.boardColumns);
	let sessionEndedReason = $state<SessionEndedReason | null>(data.sessionEndedReason);
	let connectionStatus = $state<'connecting' | 'connected' | 'disconnected'>('connecting');
	let radioError = $state<string | null>(null);
	let isRecording = $state(false);
	let isProcessing = $state(false);
	let isArmingMic = $state(false);
	let lastTranscript = $state<string | null>(null);
	let sessionSeconds = $state(0);
	let timelineEvents = $state<Array<{ id: string; type: string; text: string; time: string }>>(
		initialLiveState.hasStarted
			? [{ id: '0', type: 'START', text: 'Session started', time: '00:00' }]
			: []
	);
	let mediaRecorder: MediaRecorder | null = null;
	let audioChunks: Blob[] = [];
	let activeStream: MediaStream | null = null;
	let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
	let clockInterval: ReturnType<typeof setInterval> | null = null;
	let dispatchUnitName = $state('');
	let dispatchDivision = $state(boardColumns[7]?.label ?? 'Working Assignments');
	let dispatchAssignment = $state('');

	const isCalledOn = $derived(calledOnParticipantId === data.participant.id);
	const isLive = $derived(Boolean(activeSessionId && hasStarted && scenario));
	const currentSideImage = $derived.by(() => {
		if (!scenario) return null;
		const map = {
			alpha: scenario.sideAlphaImageUrl,
			bravo: scenario.sideBravoImageUrl,
			charlie: scenario.sideCharlieImageUrl,
			delta: scenario.sideDeltaImageUrl
		};
		return map[currentSide as keyof typeof map] ?? scenario.sideAlphaImageUrl ?? null;
	});

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

	function resetTimeline(started = false) {
		timelineEvents = started
			? [{ id: '0', type: 'START', text: 'Session started', time: '00:00' }]
			: [];
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

	function showSessionEnded(reason: SessionEndedReason) {
		sessionEndedReason = reason;
		activeSessionId = null;
		hasStarted = false;
		scenario = null;
		boardEntries = [];
		boardColumns = buildBoardColumns();
		calledOnParticipantId = null;
		stopRecording();
	}

	type StageOverlays = Record<string, AnimationOverlay[]>;
	type SideStageOverlays = Record<string, StageOverlays>;

	function parsePersistedOverlays(value: unknown): PersistedAnimationOverlay[] | undefined {
		if (!Array.isArray(value)) return undefined;
		return value as PersistedAnimationOverlay[];
	}

	function getOverlaysForSideStage(side: string, stage: string): AnimationOverlay[] {
		const meta = (scenario?.stageMetadataJson ?? {}) as SideStageOverlays;
		const raw = (meta[side] as StageOverlays)?.[stage];
		return normalizeAnimationOverlays(parsePersistedOverlays(raw));
	}

	const currentOverlays = $derived(getOverlaysForSideStage(currentSide, currentStage));
	const hasOverlays = $derived(currentOverlays.length > 0);
	const overlayKey = $derived(`${currentSide}-${currentStage}`);

	const availableUnits = $derived(
		(scenario?.defaultResources ?? []).filter(
			(resource) => !boardEntries.some((entry) => entry.unitName === resource.unitName)
		)
	);

	function joinClassroom() {
		socket?.emit('classroom:join', { classroomId: data.classroom.id });
	}

	function stopMediaTracks() {
		activeStream?.getTracks().forEach((track) => track.stop());
		activeStream = null;
	}

	function pickAudioMimeType(): string | undefined {
		if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return undefined;
		for (const type of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']) {
			if (MediaRecorder.isTypeSupported(type)) return type;
		}
		return undefined;
	}

	async function startRecording() {
		if (!isCalledOn || !activeSessionId || isRecording || isProcessing) return;
		radioError = null;
		isArmingMic = true;
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: { echoCancellation: true, noiseSuppression: true }
			});
			activeStream = stream;
			const mimeType = pickAudioMimeType();
			mediaRecorder = mimeType
				? new MediaRecorder(stream, { mimeType })
				: new MediaRecorder(stream);
			audioChunks = [];
			const recordedType = mediaRecorder.mimeType || 'audio/webm';
			mediaRecorder.ondataavailable = (event) => {
				if (event.data.size > 0) audioChunks = [...audioChunks, event.data];
			};
			mediaRecorder.onstop = async () => {
				stopMediaTracks();
				const chunks = [...audioChunks];
				audioChunks = [];
				if (chunks.length === 0 || !activeSessionId) return;
				isProcessing = true;
				const blob = new Blob(chunks, { type: recordedType });
				const fd = new FormData();
				fd.set('sessionId', activeSessionId);
				fd.set('audio', blob, recordedType.includes('mp4') ? 'radio.m4a' : 'radio.webm');
				try {
					const response = await fetch('/api/classroom/radio', {
						method: 'POST',
						body: fd,
						credentials: 'include'
					});
					const body: { error?: string; transcript?: string } = await response
						.json()
						.catch(() => ({}));
					if (!response.ok) {
						radioError = body.error ?? 'Radio request failed.';
					} else if (body.transcript) {
						lastTranscript = body.transcript;
					}
				} catch (error) {
					radioError = error instanceof Error ? error.message : 'Could not send radio audio.';
				} finally {
					isProcessing = false;
				}
			};
			mediaRecorder.start(250);
			isRecording = true;
		} catch (error) {
			radioError = error instanceof Error ? error.message : 'Could not access microphone.';
			stopMediaTracks();
		} finally {
			isArmingMic = false;
		}
	}

	function stopRecording() {
		if (!isRecording) return;
		isRecording = false;
		if (mediaRecorder?.state === 'recording') mediaRecorder.stop();
	}

	function submitBoardEntry() {
		if (!isCalledOn || !activeSessionId || !dispatchUnitName.trim()) return;
		socket?.emit('trainer:board:correct', {
			sessionId: activeSessionId,
			unitName: dispatchUnitName.trim(),
			division: dispatchDivision,
			assignment: dispatchAssignment.trim(),
			status: 'Assigned'
		});
		dispatchUnitName = '';
		dispatchAssignment = '';
	}

	onMount(() => {
		if (sessionEndedReason) return;

		if (!socket) {
			connectionStatus = 'disconnected';
			return;
		}

		if (initialLiveState.startedAt) syncClock(new Date(initialLiveState.startedAt).toISOString());
		clockInterval = setInterval(() => {
			if (hasStarted) sessionSeconds++;
		}, 1000);

		socket.on('connect', joinClassroom);
		socket.on('disconnect', () => (connectionStatus = 'disconnected'));
		socket.on('classroom:snapshot', (payload) => {
			connectionStatus = 'connected';
			sessionEndedReason = null;
			activeSessionId = payload.activeSession?.id ?? null;
			hasStarted = Boolean(payload.activeSession?.hasStarted);
			scenario = payload.scenario ?? null;
			currentStage = payload.activeSession?.activeStage ?? 'incipient';
			currentSide = payload.activeSession?.activeSide ?? 'alpha';
			calledOnParticipantId = payload.calledOnParticipantId ?? null;
			boardEntries = payload.boardEntries ?? [];
			boardColumns = buildBoardColumns(payload.boardColumns);
			if (payload.activeSession?.hasStarted) {
				resetTimeline(true);
				if (payload.activeSession.startedAt) {
					syncClock(new Date(payload.activeSession.startedAt).toISOString());
				}
			} else {
				sessionSeconds = 0;
				resetTimeline(false);
			}
		});
		socket.on('classroom:scenario-loaded', (payload) => {
			sessionEndedReason = null;
			activeSessionId = payload.session?.id ?? null;
			hasStarted = Boolean(payload.session?.hasStarted);
			scenario = payload.scenario ?? null;
			currentStage = payload.session?.activeStage ?? 'incipient';
			currentSide = payload.session?.activeSide ?? 'alpha';
			boardEntries = payload.boardEntries ?? [];
			boardColumns = buildBoardColumns(payload.boardColumns);
			sessionSeconds = 0;
			resetTimeline(false);
		});
		socket.on('classroom:scenario-started', (payload?: { startedAt?: string }) => {
			hasStarted = true;
			if (payload?.startedAt) syncClock(payload.startedAt);
			resetTimeline(true);
		});
		socket.on('classroom:scenario-ended', () => {
			addTimelineEvent('END', 'Simulation ended');
			activeSessionId = null;
			hasStarted = false;
			scenario = null;
			boardEntries = [];
			boardColumns = buildBoardColumns();
			calledOnParticipantId = null;
			sessionSeconds = 0;
			stopRecording();
		});
		socket.on('classroom:control-changed', (payload: { calledOnParticipantId?: string | null }) => {
			calledOnParticipantId = payload.calledOnParticipantId ?? null;
			if (calledOnParticipantId !== data.participant.id) stopRecording();
		});
		socket.on('classroom:kicked', () => {
			showSessionEnded('kicked');
		});
		socket.on('classroom:ended', () => {
			showSessionEnded('classroom_ended');
		});
		socket.on('trainer:session:ended', (payload?: { reason?: string }) => {
			addTimelineEvent('END', payload?.reason === 'classroom_ended' ? 'Classroom ended' : 'Simulation ended');
		});
		socket.on('trainer:state:dispatched', (payload: { stage?: string; side?: string; hazard?: string; update?: string; source?: string; offsetSeconds?: number }) => {
			const eventSeconds =
				payload.source === 'timeline' && typeof payload.offsetSeconds === 'number'
					? payload.offsetSeconds
					: sessionSeconds;
			if (payload.stage) {
				currentStage = payload.stage;
				addTimelineEvent('STAGE', `Stage changed to ${stageLabels[payload.stage] ?? payload.stage}`, eventSeconds);
			}
			if (payload.side) {
				currentSide = payload.side;
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
			const existing = boardEntries.find((item) => item.unitName === entry.unitName);
			boardEntries = existing
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
		socket.on('trainer:radio:transcribed', (payload: { transcript?: string }) => {
			if (payload.transcript) addTimelineEvent('RADIO', payload.transcript);
		});

		if (socket.connected) joinClassroom();
		heartbeatInterval = setInterval(() => {
			socket.emit('classroom:heartbeat', { classroomId: data.classroom.id });
		}, 20_000);
	});

	onDestroy(() => {
		stopRecording();
		stopMediaTracks();
		socket?.off('connect', joinClassroom);
		socket?.off('disconnect');
		socket?.off('classroom:snapshot');
		socket?.off('classroom:scenario-loaded');
		socket?.off('classroom:scenario-started');
		socket?.off('classroom:scenario-ended');
		socket?.off('classroom:control-changed');
		socket?.off('classroom:kicked');
		socket?.off('classroom:ended');
		socket?.off('trainer:session:ended');
		socket?.off('trainer:state:dispatched');
		socket?.off('trainer:board:updated');
		socket?.off('trainer:board:removed');
		socket?.off('trainer:board:status-changed');
		socket?.off('trainer:radio:transcribed');
		if (heartbeatInterval) clearInterval(heartbeatInterval);
		if (clockInterval) clearInterval(clockInterval);
	});
</script>

<svelte:head>
	<title>{data.classroom.name} | Classroom</title>
</svelte:head>

<div class="flex h-dvh max-h-dvh flex-col overflow-hidden bg-background">
	<header
		class="flex shrink-0 flex-col gap-2 border-b bg-background/95 px-3 py-2.5 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-3"
	>
		<div class="flex min-w-0 flex-wrap items-center gap-2 gap-y-1.5">
			<h1 class="max-w-full truncate text-base font-semibold sm:text-lg">
				{data.classroom.name}
			</h1>
			<Badge variant="outline" class="shrink-0 font-mono tracking-[0.2em]">
				{data.classroom.code}
			</Badge>
			{#if isLive}
				<Badge class="shrink-0 bg-green-500 text-white">LIVE</Badge>
				<span class="shrink-0 font-mono text-xs text-muted-foreground sm:text-sm">
					{formatClock(sessionSeconds)}
				</span>
				{#if currentStage}
					<Badge
						class="shrink-0 text-[10px] {stageBadgeClass[currentStage] ?? 'bg-gray-500'} text-white"
					>
						{stageLabels[currentStage] ?? currentStage}
					</Badge>
				{/if}
			{:else}
				<Badge variant="secondary" class="shrink-0">Waiting</Badge>
			{/if}
		</div>
		<div class="flex items-center gap-2">
			{#if isCalledOn && isLive}
				<Badge class="shrink-0 bg-orange-500 text-white">You're on the air</Badge>
			{/if}
			<span class="shrink-0 text-xs text-muted-foreground">
				{data.participant.displayName}
			</span>
		</div>
	</header>

	{#if sessionEndedReason}
		<div class="flex flex-1 items-center justify-center overflow-y-auto p-4 sm:p-6">
			<div class="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
				<div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
					<span class="text-xs font-semibold tracking-wider">END</span>
				</div>
				<h2 class="text-xl font-semibold">Session has ended</h2>
				<p class="mt-3 text-sm text-muted-foreground">
					{#if sessionEndedReason === 'kicked'}
						You were removed from this classroom by the instructor. You can close this tab.
					{:else}
						Your instructor ended this classroom session. You can close this tab.
					{/if}
				</p>
			</div>
		</div>
	{:else if !isLive}
		<div class="flex flex-1 items-center justify-center overflow-y-auto p-4 sm:p-6">
			<div class="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
				<div class="mx-auto mb-4 h-10 w-10 animate-pulse rounded-full bg-muted"></div>
				{#if scenario && !hasStarted}
					<p
						class="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
					>
						Up next
					</p>
					<h2 class="mt-1 text-xl font-semibold">{scenario.title}</h2>
					<p class="mt-3 text-sm text-muted-foreground">
						Hi {data.participant.displayName}! The instructor has loaded this simulation. It will
						begin once they hit start.
					</p>
				{:else}
					<h2 class="text-xl font-semibold">Waiting for instructor to start</h2>
					<p class="mt-2 text-sm text-muted-foreground">
						Hi {data.participant.displayName}! You're connected. The simulation will begin once
						your instructor loads and starts it.
					</p>
				{/if}
				<p class="mt-4 text-xs text-muted-foreground">
					Keep Zoom open for instructor audio. Controls unlock when the instructor calls on you.
				</p>
				{#if connectionStatus === 'disconnected'}
					<p class="mt-3 text-xs text-destructive">
						Connection lost — reconnecting...
					</p>
				{/if}
			</div>
		</div>
	{:else}
		<div class="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
			<main class="order-1 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:order-0">
				<div class="flex shrink-0 justify-center border-b bg-muted/30 px-2 py-2">
					<div class="w-full">
						<div
							class="relative mx-auto h-[min(48vh,460px)] w-full overflow-hidden rounded-lg bg-muted shadow-sm ring-1 ring-border/60 sm:h-[min(52vh,520px)]"
						>
							{#if currentSideImage && hasOverlays}
								{#key overlayKey}
									<img
										src={currentSideImage}
										alt=""
										aria-hidden="true"
										class="absolute inset-0 h-full w-full object-contain blur-md scale-110 opacity-60"
									/>
									<div class="absolute inset-0 z-10">
										<OverlayCanvas
											baseImageUrl={currentSideImage}
											overlays={currentOverlays}
											selectedOverlayId={null}
											isInteractive={false}
										/>
									</div>
								{/key}
							{:else if currentSideImage}
								<img
									src={currentSideImage}
									alt={sideLabels[currentSide] ?? currentSide}
									class="h-full w-full object-contain"
								/>
							{:else}
								<div class="flex h-full w-full items-center justify-center text-muted-foreground">
									No image for {sideLabels[currentSide] ?? currentSide}
								</div>
							{/if}
							<div class="pointer-events-none absolute bottom-2 left-2 z-20 flex items-center gap-2">
								<span
									class="rounded bg-black/60 px-2 py-0.5 text-xs font-medium text-white"
								>
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

				<div class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-t">
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
										<div
											class="flex min-h-8 shrink-0 flex-col items-center justify-center border-b border-inherit bg-white/45 px-0.5 py-1 text-center text-[9px] leading-tight font-bold tracking-tight text-muted-foreground uppercase"
										>
											<span>{commandBoardHeader(col) || '\u00a0'}</span>
											{#if col.supervisorUnit}
												<span class="mt-0.5 rounded bg-white/70 px-1 text-[7px] normal-case">
													SUP: {col.supervisorUnit}
												</span>
											{/if}
										</div>
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

			<aside
				class="order-2 flex max-h-[min(40vh,360px)] min-h-[180px] w-full shrink-0 flex-col overflow-hidden border-t border-border bg-background lg:order-0 lg:max-h-none lg:min-h-0 lg:w-72 lg:border-t-0 lg:border-l"
			>
				<div class="flex flex-col items-center gap-2 border-b p-3">
					<h3 class="text-xs font-semibold">Radio — Push to Talk</h3>
					{#if isCalledOn}
						<button
							type="button"
							onpointerdown={startRecording}
							onpointerup={stopRecording}
							onpointercancel={stopRecording}
							onlostpointercapture={stopRecording}
							disabled={isProcessing}
							class="flex h-16 w-16 touch-none items-center justify-center rounded-full border-4 transition-all select-none disabled:cursor-not-allowed disabled:opacity-50 {isRecording
								? 'scale-110 border-red-500 bg-red-500'
								: 'border-red-400 bg-red-500/80 hover:bg-red-500'}"
							aria-label="Push to talk"
							aria-pressed={isRecording}
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-5 w-5 text-white"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path
									d="M19 10v2a7 7 0 0 1-14 0v-2"
								/><line x1="12" x2="12" y1="19" y2="22" /></svg
							>
						</button>
						<span class="text-[10px] text-muted-foreground">
							{isArmingMic
								? 'Starting mic…'
								: isRecording
									? 'Recording…'
									: isProcessing
										? 'Processing…'
										: 'Hold to talk'}
						</span>
					{:else}
						<div
							class="flex h-16 w-16 items-center justify-center rounded-full border-4 border-dashed border-muted-foreground/30 bg-muted/30"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="h-5 w-5 text-muted-foreground/50"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path
									d="M19 10v2a7 7 0 0 1-14 0v-2"
								/><line x1="12" x2="12" y1="19" y2="22" /></svg
							>
						</div>
						<span class="text-center text-[10px] leading-snug text-muted-foreground">
							Watch only — your instructor must call on you to use the radio.
						</span>
					{/if}
					{#if radioError}
						<p class="w-full text-center text-[10px] text-destructive" role="alert">
							{radioError}
						</p>
					{/if}
					{#if lastTranscript}
						<div class="w-full rounded-lg border bg-muted/50 p-2">
							<p class="text-[10px] font-medium text-muted-foreground">AI Parsed:</p>
							<p class="mt-0.5 text-xs">{lastTranscript}</p>
						</div>
					{/if}
					{#if isCalledOn}
						<div class="w-full rounded-lg border bg-card p-2">
							<p class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
								Assign a box
							</p>
							<div class="mt-2 grid gap-2">
								<input
									bind:value={dispatchUnitName}
									placeholder="Unit name"
									class="h-9 rounded-md border bg-background px-2 text-xs focus:ring-2 focus:ring-ring focus:outline-none"
								/>
								<select
									bind:value={dispatchDivision}
									class="h-9 rounded-md border bg-background px-2 text-xs focus:ring-2 focus:ring-ring focus:outline-none"
								>
									{#each boardColumns as col (col.key)}
										<option value={col.label || col.header}>{col.header}</option>
									{/each}
								</select>
								<input
									bind:value={dispatchAssignment}
									placeholder="Task, e.g. Fire attack"
									class="h-9 rounded-md border bg-background px-2 text-xs focus:ring-2 focus:ring-ring focus:outline-none"
								/>
								<button
									type="button"
									onclick={submitBoardEntry}
									disabled={!dispatchUnitName.trim()}
									class="h-9 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50"
								>
									Add to board
								</button>
							</div>
						</div>
					{/if}
				</div>

				<div class="min-h-0 flex-1 overflow-y-auto p-3">
					<div class="mb-2 flex items-center justify-between gap-2">
						<h3 class="text-xs font-semibold">Timeline</h3>
						<span class="font-mono text-[10px] text-muted-foreground">
							{formatClock(sessionSeconds)}
						</span>
					</div>
					{#if timelineEvents.length === 0}
						<p class="text-xs leading-5 text-muted-foreground">
							Scripted hazards, updates, radio traffic, and board changes will appear here as
							the simulation runs.
						</p>
					{:else}
						<ul class="space-y-2">
							{#each timelineEvents as event (event.id)}
								<li class="flex gap-1.5 text-xs">
									<span class="shrink-0 font-mono text-muted-foreground">{event.time}</span>
									<Badge variant="outline" class="shrink-0 text-[9px]">{event.type}</Badge>
									<span class="min-w-0 leading-4">{event.text}</span>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			</aside>
		</div>
	{/if}
</div>
