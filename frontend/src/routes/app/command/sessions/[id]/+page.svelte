<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Sheet from '$lib/components/ui/sheet';
	import BoardColumnEditSheet from '$lib/components/trainer/board-column-edit-sheet.svelte';
	import BoardEntryEditSheet from '$lib/components/trainer/board-entry-edit-sheet.svelte';
	import { Input } from '$lib/components/ui/input';
	import { getTrainerSocket } from '$lib/stores/socket';
	import OverlayCanvas from '$lib/components/scene-editor/konva-overlay-editor/OverlayCanvas.svelte';
	import { preloadImages } from '$lib/components/scene-editor/konva-overlay-editor/image-preload';
	import {
		normalizeAnimationOverlays,
		type PersistedAnimationOverlay
	} from '$lib/components/scene-editor/konva-overlay-editor/overlay-utils';
	import { preloadSpritesheetPacks } from '$lib/components/scene-editor/konva-overlay-editor/spritesheet-cache';
	import type { AnimationOverlay } from '$lib/components/scene-editor/konva-overlay-editor/overlay-types';
	import type { PageData } from './$types';
	import {
		buildBoardColumns,
		entriesForColumn,
		orphanBoardEntries,
		formatUnitAssignmentLine,
		type BoardColumnState,
		type BoardEntryLike
	} from '$lib/trainer-command-board';
	import { parseArrivalUnit } from '$lib/components/scene-editor/simple-scenario-editor/stage-mapping';
	import PauseIcon from '@lucide/svelte/icons/pause';
	import PlayIcon from '@lucide/svelte/icons/play';
	import MicIcon from '@lucide/svelte/icons/mic';
	import LayoutGridIcon from '@lucide/svelte/icons/layout-grid';
	import TruckIcon from '@lucide/svelte/icons/truck';
	import ListIcon from '@lucide/svelte/icons/list';
	import ExpandIcon from '@lucide/svelte/icons/maximize-2';
	import PlusIcon from '@lucide/svelte/icons/plus';

	let { data }: { data: PageData } = $props();

	const socket = getTrainerSocket();

	let sessionSeconds = $state(0);
	let clockInterval: ReturnType<typeof setInterval> | null = null;
	let tickInterval: ReturnType<typeof setInterval> | null = null;
	let currentStage = $state('');
	let currentSide = $state('');
	let hasStarted = $state(false);
	let isPaused = $state(false);
	let isStarting = $state(false);
	let startStatus = $state<'idle' | 'loading-media' | 'starting'>('idle');
	let lastRadioMessageId = $state<string | null>(null);
	let isRecording = $state(false);
	let isArmingMic = $state(false);
	let isProcessing = $state(false);
	let lastTranscript = $state('');
	let radioError = $state<string | null>(null);

	const isSelfPaced = $derived(Boolean(data.isSelfPaced));

	type MobileTab = 'board' | 'units' | 'timeline';
	let activeMobileTab = $state<MobileTab>('board');
	let boardHasNew = $state(false);
	let timelineHasNew = $state(false);

	let editSheetOpen = $state(false);
	let columnSheetOpen = $state(false);
	let endSheetOpen = $state(false);
	let dispatchSheetOpen = $state(false);
	let sceneSheetOpen = $state(false);
	let addDivisionSheetOpen = $state(false);

	let dispatchUnitName = $state('');
	let dispatchDivision = $state('Working Assignments');
	let dispatchAssignment = $state('');

	const ASSIGNMENT_SUGGESTIONS = [
		'search',
		'vent',
		'RIC',
		'water supply',
		'pump operations',
		'attack line',
		'overhaul',
		'rehab'
	];

	/** Backdrop blur for overlay previews and full-sheet; plain desktop/mobile photos use SCENE_FOREGROUND_FILL_CLASS */
	const SCENE_BACKDROP_IMG_CLASS =
		'pointer-events-none absolute inset-0 z-0 h-full w-full scale-110 object-cover opacity-35 blur-xl';
	const SCENE_FOREGROUND_IMG_CLASS =
		'pointer-events-none absolute inset-0 z-10 h-full w-full object-contain';
	const SCENE_FOREGROUND_FILL_CLASS =
		'pointer-events-none absolute inset-0 z-10 h-full w-full object-cover';

	let stageBannerText = $state('');
	let stageBannerVisible = $state(false);
	let stageBannerTimer: ReturnType<typeof setTimeout> | null = null;

	let transcriptCaptionVisible = $state(false);
	let transcriptCaptionTimer: ReturnType<typeof setTimeout> | null = null;
	let lastSeenTranscript = '';

	let timelineFilter = $state<'all' | 'RADIO' | 'STAGE' | 'HAZARD'>('all');
	let timelineScrollEls: HTMLDivElement[] = [];

	const STATUS_CYCLE = [
		'Assigned',
		'En Route',
		'On Scene',
		'Operating',
		'PAR Completed'
	] as const;

	function nextStatus(current: string): string {
		const idx = (STATUS_CYCLE as readonly string[]).indexOf(current);
		if (idx === -1 || idx >= STATUS_CYCLE.length - 1) return STATUS_CYCLE[0];
		return STATUS_CYCLE[idx + 1];
	}

	function vibrateLight() {
		if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
			try {
				navigator.vibrate(10);
			} catch {
				/* ignore */
			}
		}
	}

	function showStageBanner(text: string) {
		stageBannerText = text;
		stageBannerVisible = true;
		if (stageBannerTimer) clearTimeout(stageBannerTimer);
		stageBannerTimer = setTimeout(() => {
			stageBannerVisible = false;
		}, 1500);
	}

	function selectMobileTab(tab: MobileTab) {
		activeMobileTab = tab;
		if (tab === 'board') boardHasNew = false;
		if (tab === 'timeline') {
			timelineHasNew = false;
			scrollTimelineToBottom();
		}
	}

	/**
	 * Plain-English list of how this scenario ends and progresses, built from
	 * the saved self-paced config. Rendered on the pre-start card so the
	 * student knows what to expect (especially that saying "under control"
	 * on the radio will end the session when that condition is enabled).
	 */
	const selfPacedRunHints = $derived.by<string[]>(() => {
		if (!isSelfPaced) return [];
		const cfg = data.scenario.selfPacedConfigJson as
			| {
					timeLimitSeconds?: number | null;
					endConditions?: {
						onUnderControl?: boolean;
						onTimelineComplete?: boolean;
						onTimeExpired?: boolean;
					} | null;
			  }
			| null
			| undefined;
		const hints: string[] = [
			'Hold the red mic button to talk on the radio. Assignments update the command board automatically — tap an entry to fix mistakes.'
		];
		const ec = cfg?.endConditions ?? {};
		const ending: string[] = [];
		if (ec.onUnderControl) {
			ending.push('say "fire under control" on the radio');
		}
		if (ec.onTimeExpired && typeof cfg?.timeLimitSeconds === 'number' && cfg.timeLimitSeconds > 0) {
			const mins = Math.floor(cfg.timeLimitSeconds / 60);
			const secs = cfg.timeLimitSeconds % 60;
			const label = secs === 0 ? `${mins}:00` : `${mins}:${String(secs).padStart(2, '0')}`;
			ending.push(`the ${label} time limit is reached`);
		}
		ending.push('you tap End Session in the header');
		hints.push(`The session ends when ${ending.join(', or when ')}.`);
		return hints;
	});

	interface BoardEntry {
		id: string;
		slotIndex?: number | null;
		division: string;
		unitName: string;
		assignment: string;
		status: string;
	}

	interface ScenarioResource {
		unitName: string;
		status?: string;
	}

	interface ScriptedArrivalResource extends ScenarioResource {
		offsetSeconds: number;
	}

	function hasArrivalOffset(resource: ScenarioResource): resource is ScriptedArrivalResource {
		return 'offsetSeconds' in resource && typeof resource.offsetSeconds === 'number';
	}

	let boardEntries = $state<BoardEntry[]>([]);
	let boardColumns = $state<BoardColumnState[]>(buildBoardColumns(data.boardColumns));

	let lastHydratedSessionId = $state<string | null>(null);

	function syncClock(
		startedAt: Date | string,
		pausedAt: Date | string | null = null,
		accumulatedPauseMs = 0
	) {
		const now = Date.now();
		const started = new Date(startedAt).getTime();
		const openPauseMs = pausedAt ? Math.max(0, now - new Date(pausedAt).getTime()) : 0;
		const elapsedMs = Math.max(0, now - started - accumulatedPauseMs - openPauseMs);
		sessionSeconds = Math.floor(elapsedMs / 1000);
	}

	$effect.pre(() => {
		const id = data.session.id;
		if (lastHydratedSessionId === id) return;
		lastHydratedSessionId = id;
		currentStage = data.session.activeStage;
		currentSide = data.session.activeSide;
		// Free-form self-practice has no scripted start gate; scripted self-paced
		// and instructor-led both require an explicit start.
		hasStarted =
			(data.session.mode === 'self_practice' && !data.isSelfPaced) ||
			Boolean(data.session.hasStarted);
		isPaused = Boolean(data.session.pausedAt);
		if (hasStarted && data.session.startedAt) {
			syncClock(
				data.session.startedAt,
				data.session.pausedAt,
				data.session.accumulatedPauseMs ?? 0
			);
		}
		boardEntries = (data.boardEntries ?? []).map((e: (typeof data.boardEntries)[number]) => ({
			id: e.id,
			slotIndex: e.slotIndex ?? null,
			division: e.division ?? 'Unassigned',
			unitName: e.unitName,
			assignment: e.assignment ?? '',
			status: e.status ?? 'Assigned'
		}));
		boardColumns = buildBoardColumns(data.boardColumns);
		activeMobileTab = boardEntries.length === 0 ? 'units' : 'board';
		boardHasNew = false;
		timelineHasNew = false;
	});

	const scriptedArrivalResources = $derived.by<ScriptedArrivalResource[]>(() => {
		if (!isSelfPaced) return [];
		const arrivals: ScriptedArrivalResource[] = [];
		const config = data.scenario.selfPacedConfigJson as
			| { timeline?: Array<{ label?: string | null; offsetSeconds?: number | null }> }
			| null
			| undefined;
		for (const event of config?.timeline ?? []) {
			const unitName = parseArrivalUnit(event.label);
			if (!unitName) continue;
			const offsetSeconds =
				typeof event.offsetSeconds === 'number' && Number.isFinite(event.offsetSeconds)
					? Math.max(0, Math.floor(event.offsetSeconds))
					: 0;
			const existing = arrivals.find((arrival) => arrival.unitName === unitName);
			if (existing && existing.offsetSeconds <= offsetSeconds) continue;
			const nextArrival = { unitName, status: 'available', offsetSeconds };
			if (existing) {
				arrivals.splice(arrivals.indexOf(existing), 1, nextArrival);
			} else {
				arrivals.push(nextArrival);
			}
		}
		return arrivals.sort(
			(a, b) => a.offsetSeconds - b.offsetSeconds || a.unitName.localeCompare(b.unitName)
		);
	});

	const visibleScenarioResources = $derived<ScenarioResource[]>(
		isSelfPaced ? scriptedArrivalResources : (data.scenario.defaultResources ?? [])
	);

	const availableUnits = $derived(
		visibleScenarioResources.filter((resource) => {
			if (isSelfPaced && hasArrivalOffset(resource) && resource.offsetSeconds > sessionSeconds) {
				return false;
			}
			return !boardEntries.some((entry) => entry.unitName === resource.unitName);
		})
	);
	const hasPendingScriptedArrivals = $derived(
		isSelfPaced &&
			scriptedArrivalResources.some(
				(resource) =>
					resource.offsetSeconds > sessionSeconds &&
					!boardEntries.some((entry) => entry.unitName === resource.unitName)
			)
	);

	const boardColumnChoices = $derived(boardColumns.map((column) => column.label || column.header));
	const legacyBoardEntries = $derived(orphanBoardEntries(boardEntries as BoardEntryLike[]));

	const STATUS_COLORS: Record<string, string> = {
		Assigned: 'bg-blue-100 text-blue-700',
		'En Route': 'bg-amber-100 text-amber-700',
		'On Scene': 'bg-purple-100 text-purple-700',
		Operating: 'bg-green-100 text-green-700',
		'PAR Completed': 'bg-emerald-100 text-emerald-800',
		Available: 'bg-gray-100 text-gray-600',
		'Out of Service': 'bg-red-100 text-red-700'
	};
	let timelineEvents = $state<Array<{ id: string; type: string; text: string; time: string }>>([
		{ id: '0', type: 'START', text: 'Session started', time: '00:00' }
	]);

	const filteredTimelineEvents = $derived(
		timelineFilter === 'all'
			? timelineEvents
			: timelineEvents.filter((e) =>
					timelineFilter === 'STAGE'
						? e.type === 'STAGE' || e.type === 'SIDE'
						: e.type === timelineFilter
				)
	);

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

	function getOverlaysForSideStage(
		meta: SideStageOverlays,
		side: string,
		stage: string
	): AnimationOverlay[] {
		const raw = (meta[side] as StageOverlays | undefined)?.[stage];
		return normalizeAnimationOverlays(parsePersistedOverlays(raw));
	}

	const currentOverlays = $derived(
		getOverlaysForSideStage(stageMetadata, currentSide, currentStage)
	);
	const hasOverlays = $derived(currentOverlays.length > 0);

	interface SceneImageIntrinsics {
		url: string;
		width: number;
		height: number;
	}

	/** Largest box with image aspect contained in (availableWidthPx × maxHeightPx). */
	function fitSceneAspectBox(
		availableWidthPx: number,
		intrinsic: { width: number; height: number },
		maxHeightPx: number
	): { width: number; height: number } | null {
		if (!(availableWidthPx > 0) || !(maxHeightPx > 0)) return null;
		const iw = intrinsic.width;
		const ih = intrinsic.height;
		if (!(iw > 0) || !(ih > 0)) return null;
		const ratio = iw / ih;
		let bw = availableWidthPx;
		let bh = bw / ratio;
		if (bh > maxHeightPx) {
			bh = maxHeightPx;
			bw = bh * ratio;
		}
		return { width: Math.floor(bw), height: Math.floor(bh) };
	}

	let sceneImageIntrinsics = $state<SceneImageIntrinsics | null>(null);
	let desktopSceneShelfW = $state(0);
	let mobileSceneShelfW = $state(0);
	let sceneSheetShelfW = $state(0);
	let viewportInnerHeight = $state(0);

	const intrinsicSceneActive = $derived(
		currentSideImage && sceneImageIntrinsics?.url === currentSideImage
			? sceneImageIntrinsics
			: null
	);

	const desktopSceneMaxH = $derived(
		viewportInnerHeight > 0
			? Math.min(viewportInnerHeight * 0.52, 520)
			: 520
	);

	const desktopSceneSizedBox = $derived(
		intrinsicSceneActive && desktopSceneShelfW > 0
			? fitSceneAspectBox(desktopSceneShelfW, intrinsicSceneActive, desktopSceneMaxH)
			: null
	);

	const desktopSceneSizedStyle = $derived(
		desktopSceneSizedBox
			? `width:${desktopSceneSizedBox.width}px;height:${desktopSceneSizedBox.height}px;max-width:100%`
			: undefined
	);

	const mobileSceneMaxH = $derived(
		viewportInnerHeight > 0
			? Math.min(viewportInnerHeight * 0.38, 420)
			: 400
	);

	const mobileSceneSizedBox = $derived(
		intrinsicSceneActive && mobileSceneShelfW > 0
			? fitSceneAspectBox(mobileSceneShelfW, intrinsicSceneActive, mobileSceneMaxH)
			: null
	);

	const mobileSceneSizedStyle = $derived(
		mobileSceneSizedBox
			? `width:${mobileSceneSizedBox.width}px;height:${mobileSceneSizedBox.height}px;max-width:100%`
			: undefined
	);

	const sheetSceneMaxH = $derived(
		viewportInnerHeight > 0
			? Math.min(Math.max(viewportInnerHeight * 0.92 - 120, 240), viewportInnerHeight * 0.78)
			: 560
	);

	const sheetSceneSizedBox = $derived(
		intrinsicSceneActive && sceneSheetShelfW > 0
			? fitSceneAspectBox(sceneSheetShelfW, intrinsicSceneActive, sheetSceneMaxH)
			: null
	);

	const sheetSceneSizedStyle = $derived(
		sheetSceneSizedBox
			? `width:${sheetSceneSizedBox.width}px;height:${sheetSceneSizedBox.height}px;max-width:100%`
			: undefined
	);

	function sideImageUrls(): string[] {
		return Object.values(sideImageMap).filter((url): url is string => Boolean(url));
	}

	function allOverlayPackIds(): string[] {
		const packIds: string[] = [];
		for (const side of Object.values(stageMetadata)) {
			for (const stage of Object.values(side ?? {})) {
				for (const overlay of normalizeAnimationOverlays(parsePersistedOverlays(stage))) {
					if (!packIds.includes(overlay.packId)) packIds.push(overlay.packId);
				}
			}
		}
		return packIds;
	}

	async function warmScenarioMedia() {
		if (!browser) return;
		await Promise.allSettled([
			preloadImages(sideImageUrls()),
			preloadSpritesheetPacks(allOverlayPackIds())
		]);
	}

	function formatClock(seconds: number) {
		const m = Math.floor(seconds / 60)
			.toString()
			.padStart(2, '0');
		const s = (seconds % 60).toString().padStart(2, '0');
		return `${m}:${s}`;
	}

	function scrollTimelineToBottom() {
		void tick().then(() => {
			for (const el of timelineScrollEls) el.scrollTop = el.scrollHeight;
		});
	}

	function timelineScrollContainer(node: HTMLDivElement) {
		timelineScrollEls = [...timelineScrollEls, node];
		return {
			destroy() {
				timelineScrollEls = timelineScrollEls.filter((el) => el !== node);
			}
		};
	}

	function addTimelineEvent(type: string, text: string, atSeconds = sessionSeconds) {
		timelineEvents = [
			...timelineEvents,
			{ id: crypto.randomUUID(), type, text, time: formatClock(atSeconds) }
		];
		if (activeMobileTab !== 'timeline') {
			timelineHasNew = true;
		}
		scrollTimelineToBottom();
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
			mediaRecorder = mimeType
				? new MediaRecorder(stream, { mimeType })
				: new MediaRecorder(stream);
			const recordedType =
				mediaRecorder.mimeType && mediaRecorder.mimeType !== ''
					? mediaRecorder.mimeType
					: 'audio/webm';

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
					const resp = await fetch('/api/trainer/radio', {
						method: 'POST',
						body: fd,
						credentials: 'include'
					});
					let result: {
						messageId?: string;
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
							typeof result.error === 'string'
								? result.error
								: `Radio request failed (${resp.status})`;
						return;
					}
					if (result.messageId) lastRadioMessageId = result.messageId;
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
							? rawList.filter(
									(x): x is Record<string, unknown> => x !== null && typeof x === 'object'
								)
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
		source?: string;
		offsetSeconds?: number;
	}

	function goToReview() {
		if (!browser) return;
		window.location.href = resolve(`/app/command/sessions/${data.session.id}/review`);
	}

	function endSession() {
		endSheetOpen = true;
	}

	async function confirmEndSession() {
		endSheetOpen = false;
		addTimelineEvent('END', 'Session ended');
		const sessionId = data.session.id;
		if (isSelfPaced) {
			try {
				await fetch(`/api/trainer/sessions/${sessionId}/end`, {
					method: 'POST',
					credentials: 'include',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ outcome: 'completed', reason: 'ended_by_user' })
				});
			} catch (err) {
				console.error('End session failed:', err);
			}
		} else {
			socket?.emit('trainer:session:end', { sessionId });
		}
		goToReview();
	}

	async function startSelfPaced() {
		if (isStarting) return;
		isStarting = true;
		startStatus = 'loading-media';
		radioError = null;
		try {
			await warmScenarioMedia();
			startStatus = 'starting';
			const resp = await fetch(`/api/trainer/sessions/${data.session.id}/start`, {
				method: 'POST',
				credentials: 'include'
			});
			if (!resp.ok) {
				const err = await resp.json().catch(() => ({}));
				radioError = typeof err.error === 'string' ? err.error : 'Could not start scenario';
				return;
			}
			const body: { startedAt?: string } = await resp.json();
			if (body.startedAt) syncClock(body.startedAt);
			hasStarted = true;
			isPaused = false;
		} finally {
			isStarting = false;
			startStatus = 'idle';
		}
	}

	async function pauseSelfPaced() {
		const resp = await fetch(`/api/trainer/sessions/${data.session.id}/pause`, {
			method: 'POST',
			credentials: 'include'
		});
		if (resp.ok) isPaused = true;
	}

	async function resumeSelfPaced() {
		const resp = await fetch(`/api/trainer/sessions/${data.session.id}/resume`, {
			method: 'POST',
			credentials: 'include'
		});
		if (resp.ok) {
			isPaused = false;
			await tickSelfPaced();
		}
	}

	async function tickSelfPaced() {
		try {
			const resp = await fetch(`/api/trainer/sessions/${data.session.id}/tick`, {
				method: 'POST',
				credentials: 'include'
			});
			if (resp.ok) {
				const body: { elapsedMs?: number; paused?: boolean } = await resp.json().catch(() => ({}));
				if (typeof body.elapsedMs === 'number') {
					sessionSeconds = Math.floor(Math.max(0, body.elapsedMs) / 1000);
				}
				if (typeof body.paused === 'boolean') isPaused = body.paused;
			}
		} catch (err) {
			console.error('tick failed', err);
		}
	}

	async function correctBoardEntry(entry: BoardEntry, patch: Partial<BoardEntry>) {
		const body = {
			sessionId: data.session.id,
			unitName: entry.unitName,
			division: patch.division ?? entry.division,
			assignment: patch.assignment ?? entry.assignment,
			status: patch.status ?? entry.status,
			radioMessageId: lastRadioMessageId ?? undefined
		};
		socket?.emit('trainer:board:correct', body);
		addTimelineEvent('FIX', `Corrected ${entry.unitName}`);
	}

	let editingEntry = $state<BoardEntry | null>(null);
	let editingColumn = $state<BoardColumnState | null>(null);

	const STATUS_CHOICES = [
		'Assigned',
		'En Route',
		'On Scene',
		'Operating',
		'PAR Completed',
		'Available',
		'Out of Service'
	];
	function openEdit(entry: BoardEntry) {
		editingEntry = entry;
		editSheetOpen = true;
	}

	function closeEdit() {
		editSheetOpen = false;
		setTimeout(() => {
			editingEntry = null;
		}, 250);
	}

	async function saveBoardEntry(patch: { division: string; assignment: string; status: string }) {
		if (!editingEntry) return;
		await correctBoardEntry(editingEntry, patch);
		closeEdit();
	}

	function removeBoardEntry() {
		if (!editingEntry) return;
		socket?.emit('trainer:board:remove', {
			sessionId: data.session.id,
			unitName: editingEntry.unitName
		});
		addTimelineEvent('BOARD', `${editingEntry.unitName} removed`);
		closeEdit();
	}

	function openColumnEdit(col: BoardColumnState) {
		if (col.isFixed) return;
		editingColumn = col;
		columnSheetOpen = true;
	}

	function closeColumnEdit() {
		columnSheetOpen = false;
		editingColumn = null;
	}

	function saveBoardColumn(values: {
		label: string;
		kind: 'division' | 'group';
		supervisorUnit: string;
	}) {
		if (!editingColumn) return;
		if (!values.label) {
			clearBoardColumn();
			return;
		}
		socket?.emit('board:rename-column', {
			sessionId: data.session.id,
			slotIndex: editingColumn.slotIndex,
			label: values.label,
			kind: values.kind
		});
		socket?.emit('board:set-column-supervisor', {
			sessionId: data.session.id,
			slotIndex: editingColumn.slotIndex,
			unitName: values.supervisorUnit,
			kind: values.kind,
			label: values.label
		});
		addTimelineEvent('BOARD', `Updated box: ${values.label}`);
		closeColumnEdit();
	}

	function clearBoardColumn() {
		if (!editingColumn) return;
		socket?.emit('board:clear-column', {
			sessionId: data.session.id,
			slotIndex: editingColumn.slotIndex
		});
		addTimelineEvent('BOARD', `Cleared box ${editingColumn.label || editingColumn.header}`);
		closeColumnEdit();
	}

	async function cycleEntryStatus(entry: BoardEntry) {
		vibrateLight();
		const status = nextStatus(entry.status);
		addTimelineEvent('STATUS', `${entry.unitName} ${status}`);
		await correctBoardEntry(entry, { status });
	}

	function openDispatchSheet(unitName: string, division = boardColumnChoices[0] ?? 'Working Assignments') {
		dispatchUnitName = unitName;
		dispatchDivision = division;
		dispatchAssignment = '';
		dispatchSheetOpen = true;
	}

	async function submitDispatch() {
		if (!dispatchUnitName) return;
		const unitName = dispatchUnitName;
		const division = dispatchDivision;
		const assignment = dispatchAssignment.trim();
		const synthetic: BoardEntry = {
			id: 'pending',
			unitName,
			division,
			assignment,
			status: 'Assigned'
		};
		dispatchSheetOpen = false;
		await correctBoardEntry(synthetic, { division, assignment, status: 'Assigned' });
		addTimelineEvent('DISPATCH', `${unitName} → ${division}${assignment ? ` (${assignment})` : ''}`);
	}

	function joinRoom() {
		socket?.emit('trainer:session:join', { sessionId: data.session.id, role: 'student' });
	}

	let teardownViewportResize: (() => void) | null = null;

	$effect(() => {
		if (!browser) return;
		const url = currentSideImage;
		if (!url) {
			sceneImageIntrinsics = null;
			return;
		}
		let cancelled = false;
		const img = new Image();
		img.crossOrigin = 'anonymous';
		img.onload = () => {
			if (cancelled) return;
			const nw = img.naturalWidth || img.width;
			const nh = img.naturalHeight || img.height;
			if (!(nw > 0) || !(nh > 0)) return;
			sceneImageIntrinsics = { url, width: nw, height: nh };
		};
		img.onerror = () => {
			if (!cancelled) sceneImageIntrinsics = null;
		};
		img.src = url;
		return () => {
			cancelled = true;
		};
	});

	onMount(() => {
		if (typeof window !== 'undefined') {
			viewportInnerHeight = window.innerHeight;
			const onResize = () => {
				viewportInnerHeight = window.innerHeight;
			};
			window.addEventListener('resize', onResize);
			teardownViewportResize = () => window.removeEventListener('resize', onResize);
		}
		clockInterval = setInterval(() => {
			if (hasStarted && !isPaused) sessionSeconds++;
		}, 1000);
		void warmScenarioMedia();

		if (isSelfPaced) {
			tickInterval = setInterval(() => {
				if (hasStarted && !isPaused) void tickSelfPaced();
			}, 2000);
		}

		socket?.on('trainer:session:paused', () => {
			isPaused = true;
			addTimelineEvent('PAUSE', 'Session paused');
		});

		socket?.on('trainer:session:resumed', () => {
			isPaused = false;
			addTimelineEvent('RESUME', 'Session resumed');
		});

		socket?.on('trainer:state:dispatched', (payload: TrainerStateDispatchedPayload) => {
			const eventSeconds =
				payload.source === 'timeline' && typeof payload.offsetSeconds === 'number'
					? payload.offsetSeconds
					: sessionSeconds;
			if (payload.stage) {
				currentStage = payload.stage;
				const label = stageLabels[payload.stage] ?? payload.stage;
				showStageBanner(`Stage: ${label}`);
				addTimelineEvent('STAGE', `Stage changed to ${label}`, eventSeconds);
			}
			if (payload.side) {
				currentSide = payload.side;
				const label = sideLabels[payload.side] ?? payload.side;
				showStageBanner(label);
				addTimelineEvent('SIDE', `Viewing ${label}`, eventSeconds);
			}
			if (payload.hazard) addTimelineEvent('HAZARD', payload.hazard, eventSeconds);
			if (payload.update) addTimelineEvent('UPDATE', payload.update, eventSeconds);
		});

		socket?.on('trainer:session:started', (payload?: { startedAt?: string }) => {
			hasStarted = true;
			if (payload?.startedAt) syncClock(payload.startedAt);
			addTimelineEvent('START', 'Simulation started');
		});

		socket?.on('trainer:session:ended', goToReview);

		socket?.on(
			'trainer:board:updated',
			(payload: { entry?: Partial<BoardEntry> & { unitName: string }; entries?: BoardEntry[]; boardColumns?: BoardColumnState[] }) => {
				if (payload.entries) {
					boardEntries = payload.entries;
					boardColumns = buildBoardColumns(payload.boardColumns);
					if (activeMobileTab !== 'board') boardHasNew = true;
					return;
				}
				const entry = payload.entry;
				if (!entry) return;
				const mapped: BoardEntry = {
					id: entry.id ?? crypto.randomUUID(),
					slotIndex: entry.slotIndex ?? null,
					division: entry.division ?? 'Unassigned',
					unitName: entry.unitName,
					assignment: entry.assignment ?? '',
					status: entry.status ?? 'Assigned'
				};
				boardEntries = [...boardEntries.filter((e) => e.unitName !== mapped.unitName), mapped];
				if (activeMobileTab !== 'board') boardHasNew = true;
			}
		);
		socket?.on(
			'trainer:board:snapshot',
			(payload: { boardEntries?: BoardEntry[]; boardColumns?: BoardColumnState[] }) => {
				boardEntries = payload.boardEntries ?? boardEntries;
				boardColumns = buildBoardColumns(payload.boardColumns);
			}
		);

		socket?.on('trainer:board:removed', (payload: { unitName: string }) => {
			boardEntries = boardEntries.filter((e) => e.unitName !== payload.unitName);
			if (activeMobileTab !== 'board') boardHasNew = true;
		});

		socket?.on('trainer:board:status-changed', (payload: { unitName: string; status: string }) => {
			boardEntries = boardEntries.map((e) =>
				e.unitName === payload.unitName ? { ...e, status: payload.status } : e
			);
			if (activeMobileTab !== 'board') boardHasNew = true;
		});

		socket?.on('connect', joinRoom);
		joinRoom();
	});

	$effect(() => {
		const tx = lastTranscript;
		if (!tx || tx === lastSeenTranscript) return;
		lastSeenTranscript = tx;
		transcriptCaptionVisible = true;
		if (transcriptCaptionTimer) clearTimeout(transcriptCaptionTimer);
		transcriptCaptionTimer = setTimeout(() => {
			transcriptCaptionVisible = false;
		}, 4000);
	});

	onDestroy(() => {
		if (typeof window !== 'undefined' && teardownViewportResize) teardownViewportResize();
		pttDestroyed = true;
		pttHeld = false;
		if (mediaRecorder?.state === 'recording') {
			mediaRecorder.stop();
		} else {
			stopMediaTracks();
		}

		if (clockInterval) clearInterval(clockInterval);
		if (tickInterval) clearInterval(tickInterval);
		if (stageBannerTimer) clearTimeout(stageBannerTimer);
		if (transcriptCaptionTimer) clearTimeout(transcriptCaptionTimer);
		socket?.off('connect', joinRoom);
		socket?.off('trainer:state:dispatched');
		socket?.off('trainer:session:started');
		socket?.off('trainer:session:paused');
		socket?.off('trainer:session:resumed');
		socket?.off('trainer:board:updated');
		socket?.off('trainer:board:snapshot');
		socket?.off('trainer:board:removed');
		socket?.off('trainer:board:status-changed');
		socket?.off('trainer:session:ended', goToReview);
		const sessionId = data.session.id;
		const instructorLed = data.session.mode === 'instructor_led';
		socket?.emit('trainer:session:leave', { sessionId });
		if (instructorLed) goToReview();
	});
</script>

<div class="flex h-dvh max-h-dvh flex-col overflow-hidden bg-background">
	<header
		class="hidden flex-col gap-3 border-b px-4 py-3 lg:flex lg:flex-row lg:items-center lg:justify-between"
	>
		<div class="flex min-w-0 flex-wrap items-center gap-2 gap-y-1.5">
			<h1 class="max-w-full truncate text-base font-semibold sm:text-lg">{data.scenario.title}</h1>
			<Badge class="shrink-0 bg-green-500 text-white">{isPaused ? 'PAUSED' : 'LIVE'}</Badge>
			<span class="shrink-0 font-mono text-xs text-muted-foreground sm:text-sm"
				>{formatClock(sessionSeconds)}</span
			>
			<Badge class="shrink-0" variant="outline">
				{isSelfPaced
					? 'Self-Paced'
					: data.session.mode === 'self_practice'
						? 'Self Practice'
						: 'Instructor-Led'}
			</Badge>
		</div>
		<div class="flex w-full shrink-0 gap-2 sm:w-auto">
			{#if isSelfPaced && hasStarted}
				{#if isPaused}
					<Button
						variant="outline"
						class="min-h-11 flex-1 sm:flex-none"
						size="sm"
						onclick={resumeSelfPaced}>Resume</Button
					>
				{:else}
					<Button
						variant="outline"
						class="min-h-11 flex-1 sm:flex-none"
						size="sm"
						onclick={pauseSelfPaced}>Pause</Button
					>
				{/if}
			{/if}
			<Button
				variant="destructive"
				class="min-h-11 flex-1 sm:flex-none"
				size="sm"
				onclick={endSession}>End Session</Button
			>
		</div>
	</header>

	{#if hasStarted}
		<header
			class="flex shrink-0 items-center gap-2 border-b bg-background/95 px-3 py-2 backdrop-blur-sm lg:hidden"
		>
			<div class="flex min-w-0 flex-1 flex-col gap-0.5">
				<h1 class="truncate text-sm font-semibold leading-tight">{data.scenario.title}</h1>
				<div class="flex items-center gap-1.5">
					<span
						class="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide {isPaused
							? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
							: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'}"
					>
						<span
							class="h-1.5 w-1.5 rounded-full {isPaused
								? 'bg-amber-500'
								: 'animate-pulse bg-green-500 motion-reduce:animate-none'}"
						></span>
						{isPaused ? 'Paused' : 'Live'}
					</span>
					<span class="font-mono text-xs tabular-nums text-muted-foreground"
						>{formatClock(sessionSeconds)}</span
					>
					{#if currentStage}
						<span
							class="rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white {stageBadgeClass[
								currentStage
							] ?? 'bg-gray-500'}"
						>
							{stageLabels[currentStage] ?? currentStage}
						</span>
					{/if}
				</div>
			</div>
			{#if isSelfPaced}
				{#if isPaused}
					<button
						type="button"
						onclick={resumeSelfPaced}
						class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						aria-label="Resume session"
					>
						<PlayIcon class="h-5 w-5" />
					</button>
				{:else}
					<button
						type="button"
						onclick={pauseSelfPaced}
						class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						aria-label="Pause session"
					>
						<PauseIcon class="h-5 w-5" />
					</button>
				{/if}
			{/if}
		</header>
	{/if}

	{#if !hasStarted}
		{#if isSelfPaced}
			<div class="flex flex-1 items-start justify-center overflow-y-auto p-4 sm:p-6">
				<div class="w-full max-w-2xl space-y-4">
					<div class="rounded-2xl border bg-card p-4 shadow-sm sm:p-6">
						<h2 class="text-lg font-semibold sm:text-xl">{data.scenario.title}</h2>
						{#if data.scenario.description}
							<p class="mt-1 text-sm text-muted-foreground">{data.scenario.description}</p>
						{/if}
						{#if data.scenario.sideAlphaImageUrl}
							<img
								src={data.scenario.sideAlphaImageUrl}
								alt="Initial scene"
								class="mt-3 h-40 w-full rounded-lg object-cover sm:h-48"
							/>
						{/if}
						{#if visibleScenarioResources.length > 0}
							<div class="mt-3">
								<p class="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
									{isSelfPaced ? 'Scripted arrivals' : 'Available resources'}
								</p>
								<div class="mt-1.5 flex flex-wrap gap-1.5">
									{#each visibleScenarioResources as resource (resource.unitName)}
										<Badge variant="secondary">{resource.unitName}</Badge>
									{/each}
								</div>
							</div>
						{/if}

						{#if isStarting}
							<div
								class="mt-5 rounded-xl border border-primary/20 bg-primary/5 px-4 py-5 text-center dark:bg-primary/10"
								role="status"
								aria-live="polite"
							>
								<div
									class="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-muted-foreground/30 border-t-primary"
								></div>
								<p class="mt-3 text-sm font-semibold text-foreground">
									{startStatus === 'loading-media'
										? 'Loading simulation...'
										: 'Starting simulation...'}
								</p>
								<p class="mt-1 text-xs text-muted-foreground">
									{startStatus === 'loading-media'
										? 'Loading scene images and fire/smoke effects so side changes are ready.'
										: 'Opening the scenario now.'}
								</p>
							</div>
						{:else}
							<Button class="mt-5 min-h-12 w-full text-base font-semibold" onclick={startSelfPaced}>
								Start Scenario
							</Button>
						{/if}
						{#if radioError}
							<p class="mt-2 text-center text-xs text-destructive">{radioError}</p>
						{/if}

						<div class="mt-4 space-y-2">
							{#if data.scenario.dispatchNotes}
								<details
									class="group rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40"
								>
									<summary
										class="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-xs font-semibold tracking-wide text-amber-800 uppercase dark:text-amber-200 [&::-webkit-details-marker]:hidden"
									>
										<span>Dispatch notes</span>
										<span
											class="text-base text-amber-700 transition-transform group-open:rotate-45 dark:text-amber-300"
											aria-hidden="true">+</span
										>
									</summary>
									<p
										class="whitespace-pre-line border-t border-amber-200 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:text-amber-100"
									>
										{data.scenario.dispatchNotes}
									</p>
								</details>
							{/if}
							{#if selfPacedRunHints.length > 0}
								<details class="group rounded-lg border border-border bg-muted/30">
									<summary
										class="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase [&::-webkit-details-marker]:hidden"
									>
										<span>How this runs</span>
										<span
											class="text-base transition-transform group-open:rotate-45"
											aria-hidden="true">+</span
										>
									</summary>
									<ul class="space-y-1 border-t px-4 py-3 text-sm text-foreground">
										{#each selfPacedRunHints as hint (hint)}
											<li class="flex gap-2">
												<span class="text-muted-foreground" aria-hidden="true">•</span><span
													>{hint}</span
												>
											</li>
										{/each}
									</ul>
								</details>
							{/if}
						</div>
					</div>
				</div>
			</div>
		{:else}
			<div class="flex flex-1 items-center justify-center p-6">
				<div class="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
					<div class="mx-auto mb-4 h-10 w-10 animate-pulse rounded-full bg-muted"></div>
					<h2 class="text-xl font-semibold">Waiting for instructor to start</h2>
					<p class="mt-2 text-sm text-muted-foreground">
						You're connected. The simulation will begin once your instructor starts it.
					</p>
				</div>
			</div>
		{/if}
	{:else}
		<div class="hidden min-h-0 flex-1 overflow-hidden lg:flex lg:flex-row">
			<main class="order-1 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:order-0">
				<!-- Scene: intrinsic aspect when known so overlay/cover fill the viewport without letterboxing -->
				<div class="flex shrink-0 justify-center border-b bg-muted/30 px-2 py-2">
					<div bind:clientWidth={desktopSceneShelfW} class="w-full shrink-0">
						<div
							class="relative mx-auto overflow-hidden rounded-lg bg-muted shadow-sm ring-1 ring-border/60 {desktopSceneSizedStyle
								? ''
								: 'h-[min(48vh,460px)] w-full sm:h-[min(52vh,520px)]'}"
							style={desktopSceneSizedStyle}
						>
						{#if currentSideImage && hasOverlays}
							<img
								src={currentSideImage}
								alt=""
								aria-hidden="true"
								class={SCENE_BACKDROP_IMG_CLASS}
							/>
							<div class="absolute inset-0 z-10">
								<OverlayCanvas
									baseImageUrl={currentSideImage}
									overlays={currentOverlays}
									selectedOverlayId={null}
									isInteractive={false}
								/>
							</div>
						{:else if currentSideImage}
							<img
								src={currentSideImage}
								alt={sideLabels[currentSide] ?? currentSide}
								class={SCENE_FOREGROUND_FILL_CLASS}
							/>
						{:else}
							<div class="flex h-full w-full items-center justify-center text-muted-foreground">
								No image for {sideLabels[currentSide] ?? currentSide}
							</div>
						{/if}
						<div class="pointer-events-none absolute bottom-2 left-2 z-20 flex items-center gap-2">
							<span class="text-xs font-medium text-white/80">{sideLabels[currentSide] ?? ''}</span>
							<span
								class="rounded px-2 py-0.5 text-xs font-bold text-white {stageBadgeClass[
									currentStage
								] ?? 'bg-gray-500'}">{stageLabels[currentStage] ?? currentStage}</span
							>
						</div>
						</div>
					</div>
				</div>

				<div class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-t">
					<div
						class="flex shrink-0 flex-col gap-1 border-b px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
					>
						<h3 class="text-xs font-semibold">Incident Command Board</h3>
						<span class="text-[11px] text-muted-foreground sm:text-xs"
							>{boardEntries.length} assigned &middot; {availableUnits.length} available</span
						>
					</div>

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
							{:else}
								<span class="text-[10px] text-muted-foreground">
									{hasPendingScriptedArrivals ? 'Waiting on scripted arrivals' : 'All units assigned'}
								</span>
							{/each}
						</div>
					</div>

					<div class="min-h-0 flex-1 overflow-hidden px-1 py-1.5">
						<div class="-mx-1 overflow-x-auto overflow-y-hidden px-1 pb-1">
							<div class="flex h-full min-h-[120px] w-max gap-0.5">
								{#each boardColumns as col (col.key)}
									<div
										class="flex min-h-0 w-19 shrink-0 flex-col border sm:w-21 {col.colorClass}"
									>
										<button
											type="button"
											onclick={() => openColumnEdit(col)}
											disabled={col.isFixed}
											class="flex min-h-8 shrink-0 flex-col items-center justify-center border-b bg-white/45 px-0.5 py-1 text-center text-[9px] leading-tight font-bold tracking-tight text-muted-foreground uppercase"
										>
											<span>{col.header || '\u00a0'}</span>
											{#if col.supervisorUnit}
												<span class="mt-0.5 rounded bg-white/70 px-1 text-[7px] normal-case">
													SUP: {col.supervisorUnit}
												</span>
											{/if}
										</button>
										<div class="min-h-0 flex-1 space-y-1 overflow-y-auto p-1">
											{#each entriesForColumn(boardEntries as BoardEntryLike[], col) as entry (entry.id ?? entry.unitName)}
												<button
													type="button"
													onclick={() => openEdit(entry as BoardEntry)}
													class="w-full rounded border px-1.5 py-1 text-left text-[9px] leading-tight font-medium transition-colors hover:ring-1 hover:ring-primary {STATUS_COLORS[
														entry.status
													] ?? 'bg-gray-50 text-gray-700'}"
													title="Click to edit or remove"
												>
													{formatUnitAssignmentLine(entry)}
													<div class="mt-0.5 text-[8px] opacity-70">{entry.status}</div>
												</button>
											{/each}
										</div>
									</div>
								{/each}
							</div>
						</div>
					</div>

					{#if legacyBoardEntries.length > 0}
						<div class="max-h-20 shrink-0 overflow-y-auto border-t px-3 py-2">
							<p class="mb-1 text-[10px] font-medium text-muted-foreground">
								Other assignments (legacy)
							</p>
							<div class="flex flex-wrap gap-1">
								{#each legacyBoardEntries as entry (entry.id ?? entry.unitName)}
									<span
										class="rounded border px-2 py-0.5 text-[9px] {STATUS_COLORS[entry.status] ??
											'bg-gray-50'}"
									>
										{entry.division}: {formatUnitAssignmentLine(entry)}
									</span>
								{/each}
							</div>
						</div>
					{/if}
				</div>
			</main>

			<aside
				class="order-2 flex max-h-[min(40vh,360px)] min-h-[180px] w-full shrink-0 flex-col overflow-hidden border-t border-border bg-background lg:order-0 lg:max-h-none lg:min-h-0 lg:w-64 lg:border-t-0 lg:border-l"
			>
				<div class="flex flex-col items-center gap-2 border-b p-3">
					<h3 class="text-xs font-semibold">Radio — Push to Talk</h3>
					<button
						type="button"
						onpointerdown={onPttPointerDown}
						onpointerup={onPttPointerUp}
						onpointercancel={onPttPointerUp}
						onlostpointercapture={onPttPointerUp}
						disabled={isProcessing}
						class="flex h-16 w-16 touch-none items-center justify-center rounded-full border-4 transition-all select-none disabled:cursor-not-allowed disabled:opacity-50 sm:h-14 sm:w-14 {isRecording
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
					{#if radioError}
						<p class="w-full text-center text-[10px] text-destructive" role="alert">{radioError}</p>
					{/if}
					{#if lastTranscript}
						<div class="w-full rounded-lg border bg-muted/50 p-2">
							<p class="text-[10px] font-medium text-muted-foreground">AI Parsed:</p>
							<p class="mt-0.5 text-xs">{lastTranscript}</p>
						</div>
					{/if}
				</div>

				<div use:timelineScrollContainer class="min-h-0 flex-1 overflow-y-auto p-3">
					<h3 class="mb-2 text-xs font-semibold">Timeline</h3>
					<div class="space-y-1.5">
						{#each timelineEvents as event (event.id)}
							<div class="flex gap-1.5 text-[11px]">
								<span class="shrink-0 font-mono text-muted-foreground">{event.time}</span>
								<Badge
									variant="outline"
									class="shrink-0 text-[9px] {event.type === 'SIZE-UP'
										? 'border-amber-400 bg-amber-50 text-amber-900'
										: ''}">{event.type}</Badge
								>
								<span class="overflow-wrap-anywhere">{event.text}</span>
							</div>
						{/each}
					</div>
				</div>
			</aside>
		</div>

		<!-- Mobile-only post-start layout -->
		<div class="flex min-h-0 flex-1 flex-col overflow-hidden lg:hidden">
			<!-- Scene viewport -->
			<div
				class="shrink-0 border-b bg-muted/30 px-2 pb-2 pt-2"
				bind:clientWidth={mobileSceneShelfW}
			>
				<button
					type="button"
					onclick={() => (sceneSheetOpen = true)}
					class="relative block overflow-hidden rounded-lg bg-muted shadow-sm ring-1 ring-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring {mobileSceneSizedStyle
						? 'mx-auto'
						: 'aspect-4/3 w-full'}"
					style={mobileSceneSizedStyle}
					aria-label="Expand scene"
				>
					{#if currentSideImage && hasOverlays}
						<img src={currentSideImage} alt="" aria-hidden="true" class={SCENE_BACKDROP_IMG_CLASS} />
						<div class="pointer-events-none absolute inset-0 z-10">
							<OverlayCanvas
								baseImageUrl={currentSideImage}
								overlays={currentOverlays}
								selectedOverlayId={null}
								isInteractive={false}
							/>
						</div>
					{:else if currentSideImage}
						<img
							src={currentSideImage}
							alt={sideLabels[currentSide] ?? currentSide}
							class={SCENE_FOREGROUND_FILL_CLASS}
						/>
					{:else}
						<div class="flex h-full w-full items-center justify-center text-muted-foreground">
							No image for {sideLabels[currentSide] ?? currentSide}
						</div>
					{/if}

					{#if currentStage}
						<span
							class="pointer-events-none absolute right-2 top-2 z-20 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow {stageBadgeClass[
								currentStage
							] ?? 'bg-gray-500'}"
						>
							{stageLabels[currentStage] ?? currentStage}
						</span>
					{/if}

					<span
						class="pointer-events-none absolute bottom-2 left-2 z-20 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white"
					>
						{sideLabels[currentSide] ?? currentSide}
					</span>

					<span
						class="pointer-events-none absolute right-2 bottom-2 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white"
						aria-hidden="true"
					>
						<ExpandIcon class="h-3.5 w-3.5" />
					</span>

					{#if stageBannerVisible && stageBannerText}
						<div
							class="pointer-events-none absolute inset-x-0 top-1/2 z-30 flex -translate-y-1/2 justify-center px-4"
							aria-live="polite"
						>
							<span
								class="rounded-full bg-black/70 px-4 py-1.5 text-sm font-bold text-white shadow-lg motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95"
							>
								{stageBannerText}
							</span>
						</div>
					{/if}
				</button>
			</div>

			<!-- Tab control -->
			<div class="shrink-0 border-b bg-background px-2 py-1.5">
				<div class="flex w-full gap-1 rounded-full bg-muted p-1" role="tablist">
					<button
						type="button"
						role="tab"
						aria-selected={activeMobileTab === 'board'}
						onclick={() => selectMobileTab('board')}
						class="relative flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors {activeMobileTab ===
						'board'
							? 'bg-background text-foreground shadow-sm'
							: 'text-muted-foreground hover:text-foreground'}"
					>
						<LayoutGridIcon class="h-3.5 w-3.5" />
						Board
						{#if boardEntries.length > 0}
							<span class="text-[10px] text-muted-foreground">({boardEntries.length})</span>
						{/if}
						{#if boardHasNew && activeMobileTab !== 'board'}
							<span
								class="absolute right-2 top-1.5 h-1.5 w-1.5 rounded-full bg-primary"
								aria-label="New activity"
							></span>
						{/if}
					</button>
					<button
						type="button"
						role="tab"
						aria-selected={activeMobileTab === 'units'}
						onclick={() => selectMobileTab('units')}
						class="relative flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors {activeMobileTab ===
						'units'
							? 'bg-background text-foreground shadow-sm'
							: 'text-muted-foreground hover:text-foreground'}"
					>
						<TruckIcon class="h-3.5 w-3.5" />
						Units
						{#if availableUnits.length > 0}
							<span class="text-[10px] text-muted-foreground">({availableUnits.length})</span>
						{/if}
					</button>
					<button
						type="button"
						role="tab"
						aria-selected={activeMobileTab === 'timeline'}
						onclick={() => selectMobileTab('timeline')}
						class="relative flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors {activeMobileTab ===
						'timeline'
							? 'bg-background text-foreground shadow-sm'
							: 'text-muted-foreground hover:text-foreground'}"
					>
						<ListIcon class="h-3.5 w-3.5" />
						Timeline
						{#if timelineHasNew && activeMobileTab !== 'timeline'}
							<span
								class="absolute right-2 top-1.5 h-1.5 w-1.5 rounded-full bg-primary"
								aria-label="New activity"
							></span>
						{/if}
					</button>
				</div>
			</div>

			<!-- Tab content -->
			<div class="min-h-0 flex-1 overflow-hidden">
				<!-- Board tab -->
				<div
					role="tabpanel"
					aria-label="Command board"
					class="h-full overflow-y-auto px-3 py-3 {activeMobileTab === 'board' ? '' : 'hidden'}"
				>
					{#if boardEntries.length === 0}
						<div
							class="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center"
						>
							<TruckIcon class="h-8 w-8 text-muted-foreground" />
							<p class="mt-3 text-sm font-medium text-foreground">No units assigned yet</p>
							<p class="mt-1 text-xs text-muted-foreground">
								Use the radio to dispatch units, or assign one manually.
							</p>
							<Button
								size="sm"
								class="mt-4 min-h-10"
								onclick={() => selectMobileTab('units')}
							>
								<TruckIcon class="h-4 w-4" /> Go to units
							</Button>
						</div>
					{:else}
						<div class="space-y-3">
							{#each boardColumns as col (col.key)}
								{@const colEntries = entriesForColumn(boardEntries as BoardEntryLike[], col)}
								{#if colEntries.length > 0}
									<div class="overflow-hidden rounded-xl border bg-card">
										<div
											class="flex items-center justify-between border-b bg-muted/40 px-3 py-1.5"
										>
											<span
												class="text-[11px] font-bold uppercase tracking-wider text-muted-foreground"
											>
												{col.header}
												{#if col.supervisorUnit}
													<span class="normal-case"> · SUP: {col.supervisorUnit}</span>
												{/if}
											</span>
											<span class="text-[10px] text-muted-foreground"
												>{colEntries.length} unit{colEntries.length === 1 ? '' : 's'}</span
											>
										</div>
										<ul class="divide-y">
											{#each colEntries as entry (entry.id ?? entry.unitName)}
												<li class="flex items-stretch">
													<button
														type="button"
														onclick={() => openEdit(entry as BoardEntry)}
														class="flex min-h-12 flex-1 items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
														aria-label="Fix {entry.unitName}"
													>
														<div class="min-w-0 flex-1">
															<p class="truncate text-sm font-medium">{entry.unitName}</p>
															{#if entry.assignment}
																<p class="truncate text-xs text-muted-foreground">
																	{entry.assignment}
																</p>
															{/if}
														</div>
													</button>
													<button
														type="button"
														onclick={() => cycleEntryStatus(entry as BoardEntry)}
														class="m-1.5 flex min-h-9 items-center rounded-full px-2.5 text-[11px] font-semibold transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring {STATUS_COLORS[
															entry.status
														] ?? 'bg-gray-50 text-gray-700'}"
														aria-label="Change status (currently {entry.status})"
													>
														{entry.status}
													</button>
												</li>
											{/each}
										</ul>
									</div>
								{/if}
							{/each}

							<button
								type="button"
								onclick={() => (addDivisionSheetOpen = true)}
								class="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-background px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							>
								<PlusIcon class="h-4 w-4" /> Add to a board box
							</button>

							{#if legacyBoardEntries.length > 0}
								<div class="rounded-xl border bg-muted/20 p-3">
									<p class="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
										Other assignments
									</p>
									<div class="flex flex-wrap gap-1.5">
										{#each legacyBoardEntries as entry (entry.id ?? entry.unitName)}
											<span
												class="rounded-full border px-2 py-0.5 text-[10px] {STATUS_COLORS[
													entry.status
												] ?? 'bg-gray-50'}"
											>
												{entry.division}: {formatUnitAssignmentLine(entry)}
											</span>
										{/each}
									</div>
								</div>
							{/if}
						</div>
					{/if}
				</div>

				<!-- Units tab -->
				<div
					role="tabpanel"
					aria-label="Available units"
					class="h-full overflow-y-auto px-3 py-3 {activeMobileTab === 'units' ? '' : 'hidden'}"
				>
					<div class="mb-3">
						<p class="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
							Available ({availableUnits.length})
						</p>
						{#if availableUnits.length === 0}
							<div
								class="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground"
							>
								{hasPendingScriptedArrivals
									? 'No scripted units have arrived yet.'
									: 'All units are assigned.'}
							</div>
						{:else}
							<div class="grid grid-cols-2 gap-2">
								{#each availableUnits as resource (resource.unitName)}
									<button
										type="button"
										onclick={() => openDispatchSheet(resource.unitName)}
										class="flex min-h-14 items-center gap-2 rounded-xl border bg-card px-3 py-2 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
									>
										<span class="h-2 w-2 rounded-full bg-green-500" aria-hidden="true"></span>
										<span class="flex-1 truncate text-sm font-medium">{resource.unitName}</span>
										<PlusIcon class="h-4 w-4 text-muted-foreground" />
									</button>
								{/each}
							</div>
						{/if}
					</div>

					{#if boardEntries.length > 0}
						<div>
							<p
								class="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
							>
								Assigned ({boardEntries.length})
							</p>
							<div class="grid grid-cols-2 gap-2">
								{#each boardEntries as entry (entry.id)}
									<button
										type="button"
										onclick={() => openEdit(entry)}
										class="flex min-h-14 flex-col items-start gap-0.5 rounded-xl border bg-card px-3 py-2 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
									>
										<div class="flex w-full items-center gap-1.5">
											<span class="flex-1 truncate text-sm font-medium">{entry.unitName}</span>
										</div>
										<span class="truncate text-[10px] text-muted-foreground">
											{entry.division}{entry.assignment ? ` · ${entry.assignment}` : ''}
										</span>
										<span
											class="mt-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold {STATUS_COLORS[
												entry.status
											] ?? 'bg-gray-50 text-gray-700'}"
										>
											{entry.status}
										</span>
									</button>
								{/each}
							</div>
						</div>
					{/if}
				</div>

				<!-- Timeline tab -->
				<div
					role="tabpanel"
					aria-label="Timeline"
					class="flex h-full flex-col {activeMobileTab === 'timeline' ? '' : 'hidden'}"
				>
					<div class="flex shrink-0 gap-1.5 border-b bg-background px-3 py-2">
						{#each [{ id: 'all', label: 'All' }, { id: 'RADIO', label: 'Radio' }, { id: 'STAGE', label: 'Stage' }, { id: 'HAZARD', label: 'Hazard' }] as f (f.id)}
							<button
								type="button"
								onclick={() => (timelineFilter = f.id as typeof timelineFilter)}
								class="rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors {timelineFilter ===
								f.id
									? 'bg-foreground text-background'
									: 'bg-muted text-muted-foreground hover:bg-muted/70'}"
							>
								{f.label}
							</button>
						{/each}
					</div>
					<div use:timelineScrollContainer class="min-h-0 flex-1 overflow-y-auto px-3 py-2">
						{#if filteredTimelineEvents.length === 0}
							<p class="py-8 text-center text-xs text-muted-foreground">No events to show.</p>
						{:else}
							<ul class="space-y-1.5">
								{#each filteredTimelineEvents as event, i (event.id)}
									<li
										class="flex gap-2 rounded-lg border-l-2 px-2 py-1.5 text-xs {i ===
										filteredTimelineEvents.length - 1
											? 'border-primary bg-primary/5'
											: 'border-transparent'}"
									>
										<span class="shrink-0 pt-0.5 font-mono text-[10px] text-muted-foreground"
											>{event.time}</span
										>
										<Badge
											variant="outline"
											class="shrink-0 text-[9px] {event.type === 'SIZE-UP'
												? 'border-amber-400 bg-amber-50 text-amber-900'
												: ''}"
										>
											{event.type}
										</Badge>
										<span class="wrap-break-word text-[12px] leading-snug">{event.text}</span>
									</li>
								{/each}
							</ul>
						{/if}
					</div>
				</div>
			</div>

			<!-- Sticky PTT footer -->
			<div
				class="shrink-0 border-t bg-background/95 px-3 pt-2 backdrop-blur-sm"
				style="padding-bottom: max(env(safe-area-inset-bottom), 0.5rem);"
			>
				{#if radioError}
					<div
						role="alert"
						class="mb-2 rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-[11px] text-destructive"
					>
						{radioError}
					</div>
				{/if}

				{#if transcriptCaptionVisible && lastTranscript}
					<p
						class="mb-1.5 truncate text-center text-[11px] text-muted-foreground transition-opacity"
						aria-live="polite"
					>
						<span class="font-medium text-foreground">Heard:</span>
						"{lastTranscript}"
					</p>
				{/if}

				<div class="flex items-center justify-between gap-3">
					<div class="w-16 shrink-0"></div>
					<div class="flex flex-col items-center">
						<button
							type="button"
							onpointerdown={onPttPointerDown}
							onpointerup={onPttPointerUp}
							onpointercancel={onPttPointerUp}
							onlostpointercapture={onPttPointerUp}
							disabled={isProcessing}
							class="relative flex h-[72px] w-[72px] touch-none items-center justify-center rounded-full text-white transition-all select-none disabled:cursor-not-allowed disabled:opacity-60 {isRecording
								? 'scale-105 bg-red-600 ring-4 ring-red-300 motion-safe:animate-pulse'
								: 'bg-red-500 ring-2 ring-red-200 hover:bg-red-600 active:scale-95'}"
							aria-label="Push to talk"
							aria-pressed={isRecording}
						>
							{#if isProcessing}
								<span
									class="h-6 w-6 animate-spin rounded-full border-2 border-white/40 border-t-white"
									aria-hidden="true"
								></span>
							{:else}
								<MicIcon class="h-7 w-7" />
							{/if}
						</button>
						<span class="mt-0.5 text-[10px] font-medium text-muted-foreground">
							{isArmingMic
								? 'Starting…'
								: isRecording
									? 'Recording…'
									: isProcessing
										? 'Processing…'
										: 'Hold to talk'}
						</span>
					</div>
					<div class="flex w-16 shrink-0 justify-end">
						<Button
							variant="destructive"
							size="sm"
							class="min-h-11"
							onclick={endSession}
						>
							End
						</Button>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Edit board entry sheet -->
	<BoardEntryEditSheet
		bind:open={editSheetOpen}
		entry={editingEntry
			? {
					unitName: editingEntry.unitName,
					division: editingEntry.division,
					assignment: editingEntry.assignment ?? '',
					status: editingEntry.status
				}
			: null}
		boxChoices={boardColumnChoices}
		statusChoices={[...STATUS_CHOICES]}
		statusColors={STATUS_COLORS}
		onClose={closeEdit}
		onSave={saveBoardEntry}
		onRemove={removeBoardEntry}
	/>

	<BoardColumnEditSheet
		bind:open={columnSheetOpen}
		column={editingColumn}
		onClose={closeColumnEdit}
		onSave={saveBoardColumn}
		onClear={clearBoardColumn}
	/>

	<!-- End session confirmation sheet -->
	<Sheet.Root bind:open={endSheetOpen}>
		<Sheet.Content side="bottom" class="rounded-t-2xl pb-[max(env(safe-area-inset-bottom),1rem)]">
			<Sheet.Header class="text-left">
				<Sheet.Title class="text-base">End this session?</Sheet.Title>
				<Sheet.Description class="text-xs">
					You'll be taken to the review page. You can't restart this run.
				</Sheet.Description>
			</Sheet.Header>
			<Sheet.Footer class="flex flex-row justify-end gap-2 px-4 pb-2 pt-0">
				<Button
					variant="outline"
					size="sm"
					class="min-h-10"
					onclick={() => (endSheetOpen = false)}
				>
					Keep going
				</Button>
				<Button variant="destructive" size="sm" class="min-h-10" onclick={confirmEndSession}>
					End session
				</Button>
			</Sheet.Footer>
		</Sheet.Content>
	</Sheet.Root>

	<!-- Quick dispatch sheet -->
	<Sheet.Root bind:open={dispatchSheetOpen}>
		<Sheet.Content side="bottom" class="rounded-t-2xl pb-[max(env(safe-area-inset-bottom),1rem)]">
			<Sheet.Header class="text-left">
				<Sheet.Title class="text-base">Dispatch {dispatchUnitName}</Sheet.Title>
				<Sheet.Description class="text-xs">
					Pick a board box and assignment.
				</Sheet.Description>
			</Sheet.Header>
			<div class="space-y-3 px-4">
				<div>
					<p class="mb-1 text-xs font-medium">Board box</p>
					<div class="flex flex-wrap gap-1.5">
						{#each boardColumnChoices as d (d)}
							<button
								type="button"
								onclick={() => (dispatchDivision = d)}
								class="min-h-9 rounded-full border px-3 text-xs font-medium transition-colors {dispatchDivision ===
								d
									? 'border-primary bg-primary text-primary-foreground'
									: 'bg-background hover:bg-muted'}"
							>
								{d}
							</button>
						{/each}
					</div>
				</div>
				<div>
					<label for="dispatch-assignment" class="mb-1 block text-xs font-medium">Assignment</label
					>
					<Input
						id="dispatch-assignment"
						bind:value={dispatchAssignment}
						placeholder="e.g., search, vent, RIC"
						class="h-11"
					/>
					<div class="mt-1.5 flex flex-wrap gap-1.5">
						{#each ASSIGNMENT_SUGGESTIONS as s (s)}
							<button
								type="button"
								onclick={() => (dispatchAssignment = s)}
								class="min-h-8 rounded-full border bg-background px-2.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted"
							>
								{s}
							</button>
						{/each}
					</div>
				</div>
			</div>
			<Sheet.Footer class="flex flex-row justify-end gap-2 px-4 pb-2 pt-0">
				<Button
					variant="outline"
					size="sm"
					class="min-h-10"
					onclick={() => (dispatchSheetOpen = false)}>Cancel</Button
				>
				<Button size="sm" class="min-h-10" onclick={submitDispatch}>Dispatch</Button>
			</Sheet.Footer>
		</Sheet.Content>
	</Sheet.Root>

	<!-- Add to board box sheet (mobile board "+ Add board box") -->
	<Sheet.Root bind:open={addDivisionSheetOpen}>
		<Sheet.Content side="bottom" class="rounded-t-2xl pb-[max(env(safe-area-inset-bottom),1rem)]">
			<Sheet.Header class="text-left">
				<Sheet.Title class="text-base">Add a unit to a board box</Sheet.Title>
				<Sheet.Description class="text-xs">
					Pick a board box, then choose an available unit to dispatch.
				</Sheet.Description>
			</Sheet.Header>
			<div class="space-y-3 px-4">
				{#if availableUnits.length === 0}
					<p class="rounded-md border bg-muted/30 px-3 py-4 text-center text-xs text-muted-foreground">
						{hasPendingScriptedArrivals
							? 'No scripted units are available yet.'
							: 'All units are already assigned.'}
					</p>
				{:else}
					<div>
						<p class="mb-1 text-xs font-medium">Board box</p>
						<div class="flex flex-wrap gap-1.5">
							{#each boardColumnChoices as d (d)}
								<button
									type="button"
									onclick={() => (dispatchDivision = d)}
									class="min-h-9 rounded-full border px-3 text-xs font-medium transition-colors {dispatchDivision ===
									d
										? 'border-primary bg-primary text-primary-foreground'
										: 'bg-background hover:bg-muted'}"
								>
									{d}
								</button>
							{/each}
						</div>
					</div>
					<div>
						<p class="mb-1 text-xs font-medium">Available units</p>
						<div class="grid grid-cols-2 gap-2">
							{#each availableUnits as resource (resource.unitName)}
								<button
									type="button"
									onclick={() => {
										addDivisionSheetOpen = false;
										openDispatchSheet(resource.unitName, dispatchDivision);
									}}
									class="flex min-h-12 items-center gap-2 rounded-lg border bg-background px-3 text-left text-sm transition-colors hover:bg-muted"
								>
									<span class="h-2 w-2 rounded-full bg-green-500" aria-hidden="true"></span>
									<span class="truncate">{resource.unitName}</span>
								</button>
							{/each}
						</div>
					</div>
				{/if}
			</div>
			<Sheet.Footer class="flex flex-row justify-end gap-2 px-4 pb-2 pt-0">
				<Button
					variant="outline"
					size="sm"
					class="min-h-10"
					onclick={() => (addDivisionSheetOpen = false)}>Close</Button
				>
			</Sheet.Footer>
		</Sheet.Content>
	</Sheet.Root>

	<!-- Full-scene viewer sheet -->
	<Sheet.Root bind:open={sceneSheetOpen}>
		<Sheet.Content
			side="bottom"
			class="flex h-[92dvh] flex-col rounded-t-2xl pb-[max(env(safe-area-inset-bottom),1rem)]"
		>
			<Sheet.Header class="text-left">
				<Sheet.Title class="text-base">
					{sideLabels[currentSide] ?? currentSide}
					{#if currentStage}
						<span
							class="ml-2 rounded-full px-2 py-0.5 align-middle text-[10px] font-bold uppercase text-white {stageBadgeClass[
								currentStage
							] ?? 'bg-gray-500'}"
						>
							{stageLabels[currentStage] ?? currentStage}
						</span>
					{/if}
				</Sheet.Title>
			</Sheet.Header>
			<div class="flex min-h-0 flex-1 shrink-0 flex-col overflow-hidden px-3 pb-3">
				<div
					bind:clientWidth={sceneSheetShelfW}
					class="flex min-h-[min(50dvh,360px)] flex-1 items-center justify-center overflow-hidden"
				>
					<div
						class="relative mx-auto overflow-hidden rounded-lg bg-muted shadow-sm ring-1 ring-border/60 {sheetSceneSizedStyle
							? ''
							: 'h-full min-h-[min(48dvh,420px)] w-full'}"
						style={sheetSceneSizedStyle}
					>
					{#if currentSideImage && hasOverlays}
						<img
							src={currentSideImage}
							alt=""
							aria-hidden="true"
							class={SCENE_BACKDROP_IMG_CLASS}
						/>
						<div class="absolute inset-0 z-10">
							<OverlayCanvas
								baseImageUrl={currentSideImage}
								overlays={currentOverlays}
								selectedOverlayId={null}
								isInteractive={false}
							/>
						</div>
					{:else if currentSideImage}
						<img
							src={currentSideImage}
							alt=""
							aria-hidden="true"
							class={SCENE_BACKDROP_IMG_CLASS}
						/>
						<img
							src={currentSideImage}
							alt={sideLabels[currentSide] ?? currentSide}
							class={SCENE_FOREGROUND_IMG_CLASS}
						/>
					{:else}
						<div class="flex h-full items-center justify-center text-muted-foreground">
							No image available
						</div>
					{/if}
					</div>
				</div>
			</div>
		</Sheet.Content>
	</Sheet.Root>
</div>
