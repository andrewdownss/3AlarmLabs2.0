<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
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
	let currentStage = $state('');
	let currentSide = $state('');
	let hasStarted = $state(false);
	let isRecording = $state(false);
	let isArmingMic = $state(false);
	let isProcessing = $state(false);
	let lastTranscript = $state('');
	let radioError = $state<string | null>(null);

	interface BoardEntry {
		id: string;
		division: string;
		unitName: string;
		assignment: string;
		status: string;
	}

	let boardEntries = $state<BoardEntry[]>([]);

	let lastHydratedSessionId = $state<string | null>(null);

	function syncClock(startedAtIso: string) {
		const elapsed = Math.floor((Date.now() - new Date(startedAtIso).getTime()) / 1000);
		sessionSeconds = Math.max(0, elapsed);
	}

	$effect.pre(() => {
		const id = data.session.id;
		if (lastHydratedSessionId === id) return;
		lastHydratedSessionId = id;
		currentStage = data.session.activeStage;
		currentSide = data.session.activeSide;
		hasStarted = data.session.mode === 'self_practice' || Boolean(data.session.hasStarted);
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
	let timelineEvents = $state<Array<{ id: string; type: string; text: string; time: string }>>([
		{ id: '0', type: 'START', text: 'Session started', time: '00:00' }
	]);

	let mediaRecorder: MediaRecorder | null = null;
	let activeStream: MediaStream | null = null;
	let audioChunks: Blob[] = [];
	/** User still holding PTT — false if they released before mic finished arming */
	let pttHeld = false;
	/** Skip upload when tearing down (navigate away) */
	let pttDestroyed = false;

	const PTT_TIMESLICE_MS = 250;

	function pickAudioMimeType(): string | undefined {
		if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return undefined;
		for (const t of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']) {
			if (MediaRecorder.isTypeSupported(t)) return t;
		}
		return undefined;
	}

	function stopMediaTracks() {
		activeStream?.getTracks().forEach((t) => t.stop());
		activeStream = null;
	}

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

	const stageMetadata = $derived((data.scenario.stageMetadataJson ?? {}) as SideStageOverlays);

	function parsePersistedOverlays(value: unknown): PersistedAnimationOverlay[] | undefined {
		if (!Array.isArray(value)) return undefined;
		return value as PersistedAnimationOverlay[];
	}

	function getOverlaysForSideStage(meta: SideStageOverlays, side: string, stage: string): AnimationOverlay[] {
		const raw = (meta[side] as StageOverlays | undefined)?.[stage];
		return normalizeAnimationOverlays(parsePersistedOverlays(raw));
	}

	const currentOverlays = $derived(getOverlaysForSideStage(stageMetadata, currentSide, currentStage));
	const hasOverlays = $derived(currentOverlays.length > 0);

	const overlayKey = $derived(`${currentSide}-${currentStage}`);

	function formatClock(seconds: number) {
		const m = Math.floor(seconds / 60).toString().padStart(2, '0');
		const s = (seconds % 60).toString().padStart(2, '0');
		return `${m}:${s}`;
	}

	function addTimelineEvent(type: string, text: string) {
		timelineEvents = [...timelineEvents, { id: crypto.randomUUID(), type, text, time: formatClock(sessionSeconds) }];
	}

	async function startRecording() {
		radioError = null;
		if (isProcessing || isArmingMic) return;
		if (mediaRecorder?.state === 'recording') return;

		pttHeld = true;
		isArmingMic = true;

		try {
			if (!navigator.mediaDevices?.getUserMedia) {
				radioError = 'Microphone is not supported in this browser.';
				return;
			}

			const stream = await navigator.mediaDevices.getUserMedia({
				audio: { echoCancellation: true, noiseSuppression: true }
			});

			if (!pttHeld) {
				stream.getTracks().forEach((t) => t.stop());
				return;
			}

			activeStream = stream;
			const mimeType = pickAudioMimeType();
			mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
			const recordedType =
				mediaRecorder.mimeType && mediaRecorder.mimeType !== '' ? mediaRecorder.mimeType : 'audio/webm';

			audioChunks = [];
			mediaRecorder.ondataavailable = (e) => {
				if (e.data.size > 0) audioChunks.push(e.data);
			};

			mediaRecorder.onstop = async () => {
				stopMediaTracks();
				const chunks = [...audioChunks];
				audioChunks = [];
				const blobType = recordedType;
				mediaRecorder = null;

				if (pttDestroyed || chunks.length === 0) return;

				isProcessing = true;
				const blob = new Blob(chunks, { type: blobType });
				const ext = blobType.includes('mp4') ? 'radio.m4a' : 'radio.webm';
				const fd = new FormData();
				fd.set('sessionId', data.session.id);
				fd.set('audio', blob, ext);

				try {
					const resp = await fetch('/api/trainer/radio', { method: 'POST', body: fd, credentials: 'include' });
					let result: {
						transcript?: string;
						command?: Record<string, unknown>;
						error?: string;
					};
					try {
						result = await resp.json();
					} catch {
						radioError = 'Server returned an invalid response.';
						return;
					}
					if (!resp.ok) {
						radioError =
							typeof result.error === 'string' ? result.error : `Radio request failed (${resp.status})`;
						return;
					}
					if (result.transcript) lastTranscript = result.transcript;
					const cmd = result.command;
					if (cmd) {
						const mt = String(cmd.messageType ?? '').toLowerCase();
						const sizeText = String(cmd.sizeUpSummary ?? '').trim();
						if (sizeText) {
							addTimelineEvent('SIZE-UP', sizeText);
						} else if (mt === 'size_up') {
							addTimelineEvent(
								'SIZE-UP',
								String(cmd.summary ?? result.transcript ?? '').trim() || 'On-scene size-up'
							);
						}

						const rawList = cmd.assignments;
						const actions = Array.isArray(rawList)
							? rawList.filter((x): x is Record<string, unknown> => x !== null && typeof x === 'object')
							: [];
						if (actions.length > 0) {
							for (const a of actions) {
								const u = String(a.unitName ?? '').trim();
								const asg = String(a.assignment ?? '').trim();
								if (u && asg) addTimelineEvent('RADIO', `${u} — ${asg}`);
							}
						} else if (actions.length === 0 && mt !== 'size_up') {
							if (String(cmd.summary ?? '').trim()) {
								addTimelineEvent('RADIO', String(cmd.summary));
							} else if (cmd.unitName && cmd.assignment) {
								addTimelineEvent('RADIO', `${cmd.unitName} — ${cmd.assignment}`);
							}
						}
					}
				} catch (err) {
					console.error('Radio processing failed:', err);
					radioError = err instanceof Error ? err.message : 'Could not send radio audio.';
				} finally {
					isProcessing = false;
				}
			};

			mediaRecorder.start(PTT_TIMESLICE_MS);
			isRecording = true;
		} catch (err) {
			console.error('Microphone error:', err);
			const name = err instanceof Error ? err.name : '';
			if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
				radioError = 'Microphone access denied. Allow the mic in your browser settings.';
			} else if (name === 'NotFoundError') {
				radioError = 'No microphone found.';
			} else {
				radioError = err instanceof Error ? err.message : 'Could not access microphone.';
			}
			stopMediaTracks();
			mediaRecorder = null;
		} finally {
			isArmingMic = false;
			if (!mediaRecorder || mediaRecorder.state !== 'recording') isRecording = false;
		}
	}

	function stopRecording() {
		pttHeld = false;
		isRecording = false;
		if (mediaRecorder && mediaRecorder.state === 'recording') {
			mediaRecorder.stop();
		}
	}

	function onPttPointerDown(e: PointerEvent) {
		if (isProcessing) return;
		const el = e.currentTarget;
		if (el instanceof HTMLButtonElement) {
			try {
				el.setPointerCapture(e.pointerId);
			} catch {
				/* already captured or unsupported */
			}
		}
		e.preventDefault();
		startRecording();
	}

	function onPttPointerUp(e: PointerEvent) {
		const el = e.currentTarget;
		if (el instanceof HTMLButtonElement) {
			try {
				el.releasePointerCapture(e.pointerId);
			} catch {
				/* not captured */
			}
		}
		stopRecording();
	}

	interface TrainerStateDispatchedPayload {
		stage?: string;
		side?: string;
		hazard?: string;
		update?: string;
	}

	function goToReview() {
		if (!browser) return;
		window.location.href = resolve(`/app/command/sessions/${data.session.id}/review`);
	}

	async function endSession() {
		if (!confirm('End this session?')) return;
		addTimelineEvent('END', 'Session ended');
		const sessionId = data.session.id;
		socket?.emit('trainer:session:end', { sessionId });
		goToReview();
	}

	function joinRoom() {
		socket?.emit('trainer:session:join', { sessionId: data.session.id, role: 'student' });
	}

	onMount(() => {
		clockInterval = setInterval(() => { sessionSeconds++; }, 1000);

		socket?.on('trainer:state:dispatched', (payload: TrainerStateDispatchedPayload) => {
			if (payload.stage) { currentStage = payload.stage; addTimelineEvent('STAGE', `Stage changed to ${stageLabels[payload.stage] ?? payload.stage}`); }
			if (payload.side) { currentSide = payload.side; addTimelineEvent('SIDE', `Viewing ${sideLabels[payload.side] ?? payload.side}`); }
			if (payload.hazard) addTimelineEvent('HAZARD', payload.hazard);
			if (payload.update) addTimelineEvent('UPDATE', payload.update);
		});

		socket?.on('trainer:session:started', (payload?: { startedAt?: string }) => {
			hasStarted = true;
			if (payload?.startedAt) syncClock(payload.startedAt);
			addTimelineEvent('START', 'Simulation started');
		});

		socket?.on('trainer:session:ended', goToReview);

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

		socket?.on('connect', joinRoom);
		joinRoom();
	});

	onDestroy(() => {
		pttDestroyed = true;
		pttHeld = false;
		if (mediaRecorder?.state === 'recording') {
			mediaRecorder.stop();
		} else {
			stopMediaTracks();
		}

		if (clockInterval) clearInterval(clockInterval);
		socket?.off('connect', joinRoom);
		socket?.off('trainer:state:dispatched');
		socket?.off('trainer:session:started');
		socket?.off('trainer:board:updated');
		socket?.off('trainer:board:removed');
		socket?.off('trainer:board:status-changed');
		socket?.off('trainer:session:ended', goToReview);
		const sessionId = data.session.id;
		const instructorLed = data.session.mode === 'instructor_led';
		socket?.emit('trainer:session:leave', { sessionId });
		if (instructorLed) goToReview();
	});
</script>

<div class="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-background">
	<header class="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
		<div class="flex min-w-0 flex-wrap items-center gap-2 gap-y-1.5">
			<h1 class="max-w-full truncate text-base font-semibold sm:text-lg">{data.scenario.title}</h1>
			<Badge class="shrink-0 bg-green-500 text-white">LIVE</Badge>
			<span class="shrink-0 font-mono text-xs text-muted-foreground sm:text-sm">{formatClock(sessionSeconds)}</span>
			<Badge class="shrink-0" variant="outline">{data.session.mode === 'self_practice' ? 'Self Practice' : 'Instructor-Led'}</Badge>
		</div>
		<Button variant="destructive" class="min-h-11 w-full shrink-0 sm:w-auto" size="sm" onclick={endSession}>End Session</Button>
	</header>

	{#if !hasStarted}
		<div class="flex flex-1 items-center justify-center p-6">
			<div class="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
				<div class="mx-auto mb-4 h-10 w-10 animate-pulse rounded-full bg-muted"></div>
				<h2 class="text-xl font-semibold">Waiting for instructor to start</h2>
				<p class="mt-2 text-sm text-muted-foreground">You're connected. The simulation will begin once your instructor starts it.</p>
			</div>
		</div>
	{:else}
	<div class="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
		<main class="order-1 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:order-none">
			<!-- Narrower canvas + page background on sides reduces wide black letterboxing (object-contain). -->
			<div class="flex shrink-0 justify-center border-b bg-muted/30 px-2 py-2">
				<div
					class="relative h-[min(36vh,340px)] w-full max-w-xl overflow-hidden rounded-lg bg-black shadow-sm ring-1 ring-border/60 sm:h-[min(38vh,380px)] sm:max-w-2xl md:max-w-3xl"
				>
					{#if currentSideImage && hasOverlays}
						{#key overlayKey}
							<div class="absolute inset-0">
								<OverlayCanvas baseImageUrl={currentSideImage} overlays={currentOverlays} selectedOverlayId={null} isInteractive={false} />
							</div>
						{/key}
					{:else if currentSideImage}
						<img src={currentSideImage} alt={sideLabels[currentSide] ?? currentSide} class="absolute inset-0 h-full w-full object-contain" />
					{:else}
						<div class="flex h-full w-full items-center justify-center text-white/40">No image for {sideLabels[currentSide] ?? currentSide}</div>
					{/if}
					<div class="absolute bottom-2 left-2 flex items-center gap-2">
						<span class="text-xs font-medium text-white/80">{sideLabels[currentSide] ?? ''}</span>
						<span class="rounded px-2 py-0.5 text-xs font-bold text-white {stageBadgeClass[currentStage] ?? 'bg-gray-500'}">{stageLabels[currentStage] ?? currentStage}</span>
					</div>
				</div>
			</div>

			<div class="flex min-h-0 min-w-0 flex-1 flex-col border-t overflow-hidden">
				<div class="flex shrink-0 flex-col gap-1 border-b px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
					<h3 class="text-xs font-semibold">Incident Command Board</h3>
					<span class="text-[11px] text-muted-foreground sm:text-xs">{boardEntries.length} assigned &middot; {availableUnits.length} available</span>
				</div>

				<div class="shrink-0 border-b px-3 py-2">
					<p class="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Available</p>
					<div class="flex flex-wrap gap-1.5">
						{#each availableUnits as resource (resource.unitName)}
							<Badge variant="secondary" class="gap-1 text-[10px] py-0">
								<span class="h-1 w-1 rounded-full bg-green-500"></span>
								{resource.unitName}
							</Badge>
						{:else}
							<span class="text-[10px] text-muted-foreground">All units assigned</span>
						{/each}
					</div>
				</div>

				<div class="min-h-0 flex-1 overflow-hidden px-1 py-1.5">
					<div class="-mx-1 overflow-x-auto overflow-y-hidden px-1 pb-1 lg:mx-0 lg:overflow-x-hidden lg:pb-0">
						<div class="flex h-full min-h-[120px] w-max gap-0.5 lg:w-full lg:min-w-0">
						{#each COMMAND_BOARD_COLUMNS as col (col.key)}
							<div class="flex min-h-0 w-[4.75rem] shrink-0 flex-col border bg-muted/20 sm:w-[5.25rem] lg:min-w-0 lg:w-0 lg:flex-1">
								<div class="flex min-h-[2rem] shrink-0 items-center justify-center border-b bg-muted/50 px-0.5 py-1 text-center text-[9px] font-bold uppercase leading-tight tracking-tight text-muted-foreground">
									{col.header || '\u00a0'}
								</div>
								<div class="min-h-0 flex-1 space-y-1 overflow-y-auto p-1">
									{#each entriesForColumn(boardEntries as BoardEntryLike[], col.key) as entry (entry.id ?? entry.unitName)}
										<div
											class="rounded border px-1.5 py-1 text-[9px] font-medium leading-tight {STATUS_COLORS[entry.status] ?? 'bg-gray-50 text-gray-700'}"
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

				{#if legacyBoardEntries.length > 0}
					<div class="max-h-20 shrink-0 overflow-y-auto border-t px-3 py-2">
						<p class="mb-1 text-[10px] font-medium text-muted-foreground">Other assignments (legacy)</p>
						<div class="flex flex-wrap gap-1">
							{#each legacyBoardEntries as entry (entry.id ?? entry.unitName)}
								<span class="rounded border px-2 py-0.5 text-[9px] {STATUS_COLORS[entry.status] ?? 'bg-gray-50'}">
									{entry.division}: {formatUnitAssignmentLine(entry)}
								</span>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</main>

		<aside class="order-2 flex max-h-[min(40vh,360px)] min-h-[180px] w-full shrink-0 flex-col overflow-hidden border-t border-border bg-background lg:order-none lg:max-h-none lg:min-h-0 lg:w-64 lg:border-l lg:border-t-0">
			<div class="flex flex-col items-center gap-2 border-b p-3">
				<h3 class="text-xs font-semibold">Radio — Push to Talk</h3>
				<button
					type="button"
					onpointerdown={onPttPointerDown}
					onpointerup={onPttPointerUp}
					onpointercancel={onPttPointerUp}
					onlostpointercapture={onPttPointerUp}
					disabled={isProcessing}
					class="touch-none flex h-16 w-16 select-none items-center justify-center rounded-full border-4 transition-all disabled:cursor-not-allowed disabled:opacity-50 sm:h-14 sm:w-14 {isRecording ? 'border-red-500 bg-red-500 scale-110' : 'border-red-400 bg-red-500/80 hover:bg-red-500'}"
					aria-label="Push to talk"
					aria-pressed={isRecording}
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
				</button>
				<span class="text-[10px] text-muted-foreground">
					{isArmingMic ? 'Starting mic…' : isRecording ? 'Recording…' : isProcessing ? 'Processing…' : 'Hold to talk'}
				</span>
				{#if radioError}
					<p class="w-full text-center text-[10px] text-destructive" role="alert">{radioError}</p>
				{/if}
				{#if lastTranscript}
					<div class="w-full rounded-lg border bg-muted/50 p-2"><p class="text-[10px] font-medium text-muted-foreground">AI Parsed:</p><p class="mt-0.5 text-xs">{lastTranscript}</p></div>
				{/if}
			</div>

			<div class="min-h-0 flex-1 overflow-y-auto p-3">
				<h3 class="mb-2 text-xs font-semibold">Timeline</h3>
				<div class="space-y-1.5">
					{#each timelineEvents as event (event.id)}
						<div class="flex gap-1.5 text-[11px]">
							<span class="shrink-0 font-mono text-muted-foreground">{event.time}</span>
							<Badge
								variant="outline"
								class="shrink-0 text-[9px] {event.type === 'SIZE-UP' ? 'border-amber-400 bg-amber-50 text-amber-900' : ''}"
							>{event.type}</Badge>
							<span class="overflow-wrap-anywhere">{event.text}</span>
						</div>
					{/each}
				</div>
			</div>
		</aside>
	</div>
	{/if}
</div>
