<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import { browser } from '$app/environment';
	import { LandingFooter, LandingHeader } from '$lib/components/landing';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Sheet from '$lib/components/ui/sheet';
	import { PLANS } from '$lib/plans';
	import { parseArrivalUnit } from '$lib/components/scene-editor/simple-scenario-editor/stage-mapping';
	import OverlayCanvas from '$lib/components/scene-editor/konva-overlay-editor/OverlayCanvas.svelte';
	import { preloadImages } from '$lib/components/scene-editor/konva-overlay-editor/image-preload';
	import {
		normalizeAnimationOverlays,
		type PersistedAnimationOverlay
	} from '$lib/components/scene-editor/konva-overlay-editor/overlay-utils';
	import { preloadSpritesheetPacks } from '$lib/components/scene-editor/konva-overlay-editor/spritesheet-cache';
	import type { AnimationOverlay } from '$lib/components/scene-editor/konva-overlay-editor/overlay-types';
	import {
		buildBoardColumns,
		entriesForColumn,
		formatUnitAssignmentLine,
		type BoardColumnState
	} from '$lib/trainer-command-board';
	import { defaultOgImageUrl, toCanonicalUrl, toJsonLd } from '$lib/seo';
	import {
		INDIVIDUAL_SIGNUP_HREF,
		SAVE_REPLAY_SIGNUP_HREF,
		TEAM_ACCESS_HREF
	} from '$lib/landing/landing-content';
	import {
		DEMO_MAX_CLIP_SECONDS
	} from '$lib/demo/constants';
	import { saveDemoReplay } from '$lib/demo/replay-storage';
	import MicIcon from '@lucide/svelte/icons/mic';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	interface DemoTimelineEvent {
		id: string;
		type: string;
		text: string;
		time: string;
	}

	interface DemoBoardEntry {
		id: string;
		slotIndex?: number | null;
		division: string;
		unitName: string;
		assignment: string;
		status: string;
	}

	interface DemoScenarioResource {
		unitName: string;
		status?: string;
		offsetSeconds?: number;
	}

	interface DemoScriptEvent {
		id: string;
		atSecond: number;
		type: string;
		text: string;
		stage?: StageKey;
		side?: SideKey;
		addBoardEntry?: DemoBoardEntry;
		removeAvailableUnit?: string;
		addAvailableUnit?: string;
	}

	type StageKey = 'incipient' | 'growth' | 'fully_developed' | 'decay';
	type SideKey = 'alpha' | 'bravo' | 'charlie' | 'delta';

	const monthlyPrice = PLANS.individual.monthlyPrice ?? 14.99;
	const pageTitle = 'Free Fire Command Scenario | 3AlarmLabs';
	const pageDescription =
		'Run a free self-paced fire command scenario with radio traffic, unit assignments, changing conditions, and after-action review.';
	const canonicalUrl = toCanonicalUrl('/demo');
	const demoJsonLd = {
		'@context': 'https://schema.org',
		'@type': 'WebPage',
		name: pageTitle,
		description: pageDescription,
		url: canonicalUrl,
		mainEntity: {
			'@type': 'SoftwareApplication',
			name: '3AlarmLabs',
			applicationCategory: 'EducationalApplication',
			operatingSystem: 'Web'
		}
	};
	const demoJsonLdScript =
		'<scr' + `ipt type="application/ld+json">${toJsonLd(demoJsonLd)}</scr` + 'ipt>';

	const FALLBACK_AVAILABLE_UNITS = ['E1', 'E2', 'T1', 'R1', 'BC1', 'MED1'];
	const DEFAULT_SCENARIO_SECONDS = 20 * 60;

	const stageLabels: Record<StageKey, string> = {
		incipient: 'Incipient',
		growth: 'Growth',
		fully_developed: 'Fully Developed',
		decay: 'Decay'
	};

	const sideLabels: Record<SideKey, string> = {
		alpha: 'Side Alpha',
		bravo: 'Side Bravo',
		charlie: 'Side Charlie',
		delta: 'Side Delta'
	};

	const stageBadgeClass: Record<StageKey, string> = {
		incipient: 'bg-blue-500',
		growth: 'bg-amber-500',
		fully_developed: 'bg-red-500',
		decay: 'bg-emerald-600'
	};

	const STATUS_CYCLE = ['Assigned', 'En Route', 'On Scene', 'Operating', 'PAR Completed'] as const;
	const STATUS_CHOICES = [
		'Assigned',
		'En Route',
		'On Scene',
		'Operating',
		'PAR Completed',
		'Available',
		'Out of Service'
	];
	const STATUS_COLORS: Record<string, string> = {
		Assigned: 'bg-blue-100 text-blue-700',
		'En Route': 'bg-amber-100 text-amber-700',
		'On Scene': 'bg-purple-100 text-purple-700',
		Operating: 'bg-green-100 text-green-700',
		'PAR Completed': 'bg-emerald-100 text-emerald-800',
		Available: 'bg-gray-100 text-gray-600',
		'Out of Service': 'bg-red-100 text-red-700'
	};
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
	const SCENE_BACKDROP_IMG_CLASS =
		'pointer-events-none absolute inset-0 z-0 h-full w-full scale-110 object-cover opacity-35 blur-xl';
	const SCENE_FOREGROUND_FILL_CLASS =
		'pointer-events-none absolute inset-0 z-10 h-full w-full object-cover';

	const fallbackDemoScript: DemoScriptEvent[] = [
		{
			id: 'arrival',
			atSecond: 15,
			type: 'ARRIVAL',
			text: 'E1 arrives. Two-story residential with smoke showing from Side Alpha.'
		},
		{
			id: 'sizeup',
			atSecond: 32,
			type: 'SIZE-UP',
			text: 'Initial radio report: working fire, primary search in progress.',
			stage: 'growth'
		},
		{
			id: 'div1-attack',
			atSecond: 50,
			type: 'BOARD',
			text: 'E1 assigned to Div 1 for interior attack.',
			addBoardEntry: {
				id: 'entry-e1',
				division: 'Div 1',
				unitName: 'E1',
				assignment: 'Interior attack line',
				status: 'Operating'
			},
			removeAvailableUnit: 'E1'
		},
		{
			id: 'roof-vent',
			atSecond: 74,
			type: 'BOARD',
			text: 'T1 assigned to Roof for coordinated ventilation.',
			addBoardEntry: {
				id: 'entry-t1',
				division: 'Roof',
				unitName: 'T1',
				assignment: 'Vent roof over fire area',
				status: 'Operating'
			},
			removeAvailableUnit: 'T1',
			side: 'charlie'
		},
		{
			id: 'ric',
			atSecond: 98,
			type: 'SAFETY',
			text: 'R1 designated as RIC and staged on Side Alpha.',
			addBoardEntry: {
				id: 'entry-r1',
				division: 'RIC',
				unitName: 'R1',
				assignment: 'Rapid Intervention standby',
				status: 'Assigned'
			},
			removeAvailableUnit: 'R1'
		},
		{
			id: 'med',
			atSecond: 116,
			type: 'EMS',
			text: 'MED1 assigned to Rehab/Medical group.',
			addBoardEntry: {
				id: 'entry-med1',
				division: 'Med',
				unitName: 'MED1',
				assignment: 'Rehab setup and vitals',
				status: 'Operating'
			},
			removeAvailableUnit: 'MED1'
		},
		{
			id: 'knockdown',
			atSecond: 136,
			type: 'UPDATE',
			text: 'Main body of fire knocked down. Moving to overhaul.',
			stage: 'decay',
			side: 'bravo',
			addAvailableUnit: 'E3'
		}
	];

	function isStageKey(value: unknown): value is StageKey {
		return (
			value === 'incipient' ||
			value === 'growth' ||
			value === 'fully_developed' ||
			value === 'decay'
		);
	}

	function isSideKey(value: unknown): value is SideKey {
		return value === 'alpha' || value === 'bravo' || value === 'charlie' || value === 'delta';
	}

	function formatDispatchText(dispatch: {
		stage?: string;
		side?: string;
		hazard?: string;
		update?: string;
	}): string {
		const parts: string[] = [];
		if (isStageKey(dispatch.stage)) parts.push(`Stage changes to ${stageLabels[dispatch.stage]}`);
		if (isSideKey(dispatch.side)) parts.push(`View changes to ${sideLabels[dispatch.side]}`);
		if (dispatch.hazard) parts.push(dispatch.hazard);
		if (dispatch.update) parts.push(dispatch.update);
		return parts.join(' · ') || 'Scenario timeline event fired.';
	}

	function scriptFromSelectedScenario(): DemoScriptEvent[] {
		const timeline = data.demoScenario?.selfPacedConfigJson?.timeline ?? [];
		if (timeline.length === 0) return fallbackDemoScript;

		return [...timeline]
			.sort((a, b) => a.offsetSeconds - b.offsetSeconds)
			.map((event, index) => {
				const dispatch = event.dispatch ?? {};
				const stage = isStageKey(dispatch.stage) ? dispatch.stage : undefined;
				const side = isSideKey(dispatch.side) ? dispatch.side : undefined;
				const label = event.label?.trim();
				const arrivalUnit = parseArrivalUnit(label);
				const type = arrivalUnit
					? 'ARRIVAL'
					: stage
						? 'STAGE'
						: side
							? 'SIDE'
							: dispatch.hazard
								? 'HAZARD'
								: 'UPDATE';
				return {
					id: event.id || `selected-${index}`,
					atSecond: Math.max(0, event.offsetSeconds ?? 0),
					type,
					text: label || formatDispatchText(dispatch),
					stage,
					side
				};
			});
	}

	function scriptedArrivalResources(): DemoScenarioResource[] {
		const timeline = data.demoScenario?.selfPacedConfigJson?.timeline ?? [];
		const arrivals: DemoScenarioResource[] = [];
		for (const event of timeline) {
			const unitName = parseArrivalUnit(event.label);
			if (!unitName) continue;
			const offsetSeconds =
				typeof event.offsetSeconds === 'number' && Number.isFinite(event.offsetSeconds)
					? Math.max(0, Math.floor(event.offsetSeconds))
					: 0;
			const existing = arrivals.find((arrival) => arrival.unitName === unitName);
			if (existing && (existing.offsetSeconds ?? 0) <= offsetSeconds) continue;
			const nextArrival = { unitName, status: 'available', offsetSeconds };
			if (existing) {
				arrivals.splice(arrivals.indexOf(existing), 1, nextArrival);
			} else {
				arrivals.push(nextArrival);
			}
		}
		return arrivals.sort(
			(a, b) =>
				(a.offsetSeconds ?? 0) - (b.offsetSeconds ?? 0) || a.unitName.localeCompare(b.unitName)
		);
	}

	function initialAvailableUnits(): string[] {
		if (!data.demoScenario) return [...FALLBACK_AVAILABLE_UNITS];
		if ((data.demoScenario.selfPacedConfigJson?.timeline ?? []).length > 0) return [];
		return data.demoScenario.defaultResources.map((resource) => resource.unitName).filter(Boolean);
	}

	let hasStarted = $state(false);
	let isPaused = $state(false);
	let sessionSeconds = $state(0);
	let currentStage = $state<StageKey>('incipient');
	let currentSide = $state<SideKey>('alpha');
	let boardEntries = $state<DemoBoardEntry[]>([]);
	let boardColumns = $state<BoardColumnState[]>(buildBoardColumns());
	const boardColumnChoices = $derived(boardColumns.map((column) => column.label || column.header));
	let availableUnits = $state<string[]>(initialAvailableUnits());
	let firedScriptEventIds = $state<string[]>([]);
	let dispatchSheetOpen = $state(false);
	let editSheetOpen = $state(false);
	let sessionEnded = $state(false);
	let sessionStartedAt = $state<string | null>(null);
	let dispatchUnitName = $state('');
	let dispatchDivision = $state('Working Assignments');
	let dispatchAssignment = $state('');
	let editingEntry = $state<DemoBoardEntry | null>(null);
	let editDivision = $state('');
	let editAssignment = $state('');
	let editStatus = $state('');
	let timelineFilter = $state<'all' | 'RADIO' | 'STAGE' | 'HAZARD'>('all');
	let timelineEvents = $state<DemoTimelineEvent[]>([
		{
			id: 'intro',
			type: 'INFO',
			text: 'Scenario loading. Hold the mic to talk on the radio once live.',
			time: '00:00'
		}
	]);

	let isRecording = $state(false);
	let isArmingMic = $state(false);
	let isProcessing = $state(false);
	let radioError = $state<string | null>(null);
	let lastTranscript = $state('');
	let radioSecondsUsed = $state(0);
	let clipStartedAt = $state<number | null>(null);
	let clipLimitTimer: ReturnType<typeof setTimeout> | null = null;

	let mediaRecorder: MediaRecorder | null = null;
	let activeStream: MediaStream | null = null;
	let audioChunks: Blob[] = [];
	let pttHeld = false;
	let pttDestroyed = false;
	const PTT_TIMESLICE_MS = 250;

	let clockInterval: ReturnType<typeof setInterval> | null = null;
	let timelineScrollEls: HTMLDivElement[] = [];
	let sceneImageIntrinsics = $state<{ url: string; width: number; height: number } | null>(null);
	let demoSceneShelfW = $state(0);
	let viewportInnerHeight = $state(0);
	let teardownViewportResize: (() => void) | null = null;
	const activeDemoScript = $derived(scriptFromSelectedScenario());
	const scenarioTimeLimitSeconds = $derived.by(() => {
		const limit = data.demoScenario?.selfPacedConfigJson?.timeLimitSeconds;
		if (typeof limit === 'number' && limit > 0) return limit;
		const lastEvent = activeDemoScript.at(-1);
		if (lastEvent && lastEvent.atSecond > 0) {
			return Math.max(lastEvent.atSecond + 300, DEFAULT_SCENARIO_SECONDS);
		}
		return DEFAULT_SCENARIO_SECONDS;
	});
	const timeLimitLabel = $derived(formatClock(scenarioTimeLimitSeconds));
	const visibleScenarioResources = $derived(scriptedArrivalResources());
	const hasPendingScriptedArrivals = $derived(
		visibleScenarioResources.some(
			(resource) =>
				(resource.offsetSeconds ?? 0) > sessionSeconds &&
				!boardEntries.some((entry) => entry.unitName === resource.unitName)
		)
	);
	const scenarioTitle = $derived(data.demoScenario?.title ?? 'Residential Working Fire (Demo)');
	const scenarioDescription = $derived(
		data.demoScenario?.description ??
			'Free self-paced command scenario with radio, assignments, and after-action review.'
	);
	const currentSideImage = $derived.by(() => {
		const scenario = data.demoScenario;
		if (!scenario) return null;
		const images: Record<SideKey, string | null> = {
			alpha: scenario.sideAlphaImageUrl,
			bravo: scenario.sideBravoImageUrl,
			charlie: scenario.sideCharlieImageUrl,
			delta: scenario.sideDeltaImageUrl
		};
		return images[currentSide] ?? scenario.sideAlphaImageUrl ?? null;
	});
	const filteredTimelineEvents = $derived(
		timelineFilter === 'all'
			? timelineEvents
			: timelineEvents.filter((event) =>
					timelineFilter === 'STAGE'
						? event.type === 'STAGE' || event.type === 'SIDE'
						: event.type === timelineFilter
				)
	);
	const sessionComplete = $derived(
		sessionEnded ||
			(hasStarted &&
				!sessionEnded &&
				scenarioTimeLimitSeconds > 0 &&
				sessionSeconds >= scenarioTimeLimitSeconds &&
				isPaused)
	);

	type StageOverlays = Record<string, AnimationOverlay[]>;
	type SideStageOverlays = Record<string, StageOverlays>;

	const stageMetadata = $derived((data.demoScenario?.stageMetadataJson ?? {}) as SideStageOverlays);
	const currentOverlays = $derived(
		getOverlaysForSideStage(stageMetadata, currentSide, currentStage)
	);
	const hasOverlays = $derived(currentOverlays.length > 0);
	const intrinsicSceneActive = $derived(
		currentSideImage && sceneImageIntrinsics?.url === currentSideImage ? sceneImageIntrinsics : null
	);
	const demoSceneMaxH = $derived(
		viewportInnerHeight > 0 ? Math.min(viewportInnerHeight * 0.52, 520) : 520
	);
	const demoSceneSizedBox = $derived(
		intrinsicSceneActive && demoSceneShelfW > 0
			? fitSceneAspectBox(demoSceneShelfW, intrinsicSceneActive, demoSceneMaxH)
			: null
	);
	const demoSceneSizedStyle = $derived(
		demoSceneSizedBox
			? `width:${demoSceneSizedBox.width}px;height:${demoSceneSizedBox.height}px;max-width:100%`
			: undefined
	);

	function parsePersistedOverlays(value: unknown): PersistedAnimationOverlay[] | undefined {
		if (!Array.isArray(value)) return undefined;
		return value as PersistedAnimationOverlay[];
	}

	function getOverlaysForSideStage(
		meta: SideStageOverlays,
		side: SideKey,
		stage: StageKey
	): AnimationOverlay[] {
		const raw = (meta[side] as StageOverlays | undefined)?.[stage];
		return normalizeAnimationOverlays(parsePersistedOverlays(raw));
	}

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
		let width = availableWidthPx;
		let height = width / ratio;
		if (height > maxHeightPx) {
			height = maxHeightPx;
			width = height * ratio;
		}
		return { width: Math.floor(width), height: Math.floor(height) };
	}

	function sideImageUrls(): string[] {
		return [
			data.demoScenario?.sideAlphaImageUrl,
			data.demoScenario?.sideBravoImageUrl,
			data.demoScenario?.sideCharlieImageUrl,
			data.demoScenario?.sideDeltaImageUrl
		].filter((url): url is string => Boolean(url));
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

	async function warmScenarioMedia(): Promise<void> {
		if (!browser) return;
		await Promise.allSettled([
			preloadImages(sideImageUrls()),
			preloadSpritesheetPacks(allOverlayPackIds())
		]);
	}

	function nextStatus(current: string): string {
		const idx = (STATUS_CYCLE as readonly string[]).indexOf(current);
		if (idx === -1 || idx >= STATUS_CYCLE.length - 1) return STATUS_CYCLE[0];
		return STATUS_CYCLE[idx + 1];
	}

	function formatClock(totalSeconds: number): string {
		const safeSeconds = Math.max(0, totalSeconds);
		const minutes = Math.floor(safeSeconds / 60);
		const seconds = safeSeconds % 60;
		return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
	}

	function addTimelineEvent(type: string, text: string, atSecond = sessionSeconds): void {
		timelineEvents = [
			...timelineEvents,
			{
				id: crypto.randomUUID(),
				type,
				text,
				time: formatClock(atSecond)
			}
		];
		scrollTimelineToBottom();
	}

	function scrollTimelineToBottom(): void {
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

	function stopClock(): void {
		if (clockInterval === null) return;
		clearInterval(clockInterval);
		clockInterval = null;
	}

	function startClock(): void {
		if (clockInterval !== null) return;
		clockInterval = setInterval(() => {
			if (sessionEnded) return;
			sessionSeconds += 1;
			runDueScriptEvents();
			if (scenarioTimeLimitSeconds > 0 && sessionSeconds >= scenarioTimeLimitSeconds) {
				handleEndSession('timeout');
			}
		}, 1000);
	}

	function pickAudioMimeType(): string | undefined {
		if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return undefined;
		for (const t of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']) {
			if (MediaRecorder.isTypeSupported(t)) return t;
		}
		return undefined;
	}

	function stopMediaTracks(): void {
		if (activeStream) {
			for (const track of activeStream.getTracks()) track.stop();
			activeStream = null;
		}
	}

	function clearClipLimitTimer(): void {
		if (clipLimitTimer !== null) {
			clearTimeout(clipLimitTimer);
			clipLimitTimer = null;
		}
	}

	function applyRadioActions(
		actions: Array<{
			unitName: string;
			division: string;
			assignment: string;
			status: string;
		}>
	): void {
		for (const action of actions) {
			const entry: DemoBoardEntry = {
				id: `radio-${action.unitName}-${action.division}`,
				division: action.division,
				unitName: action.unitName,
				assignment: action.assignment,
				status: action.status
			};
			boardEntries = [
				...boardEntries.filter((existing) => existing.unitName !== action.unitName),
				entry
			];
			availableUnits = availableUnits.filter((unit) => unit !== action.unitName);
		}
	}

	async function sendDemoRadio(blob: Blob, mimeType: string, clipSeconds: number): Promise<void> {
		const fd = new FormData();
		const ext = mimeType.includes('mp4') ? 'm4a' : 'webm';
		fd.set('audio', blob, `demo-radio.${ext}`);

		const resp = await fetch('/api/demo/radio', {
			method: 'POST',
			body: fd,
			credentials: 'include'
		});

		let result: {
			error?: string;
			transcript?: string;
			actions?: Array<{
				id?: string;
				slotIndex?: number | null;
				unitName: string;
				division: string;
				assignment: string;
				status: string;
			}>;
			boardEntries?: DemoBoardEntry[];
			boardColumns?: BoardColumnState[];
			sizeUpText?: string | null;
		} = {};
		try {
			result = await resp.json();
		} catch {
			radioError = 'Server returned an invalid response.';
			return;
		}

		if (!resp.ok) {
			radioError = typeof result.error === 'string' ? result.error : `Radio request failed (${resp.status})`;
			return;
		}

		radioSecondsUsed += clipSeconds;
		const transcript = result.transcript?.trim() ?? '';
		if (transcript) {
			lastTranscript = transcript;
			addTimelineEvent('RADIO', transcript);
		}
		if (result.sizeUpText) {
			addTimelineEvent('SIZE-UP', result.sizeUpText);
		}
		if (result.boardColumns) boardColumns = buildBoardColumns(result.boardColumns);
		if (result.boardEntries && result.boardEntries.length > 0) {
			boardEntries = result.boardEntries;
			availableUnits = availableUnits.filter(
				(unit) => !result.boardEntries?.some((entry) => entry.unitName === unit)
			);
		} else if (result.actions && result.actions.length > 0) {
			applyRadioActions(result.actions);
		}
	}

	async function startRecording(): Promise<void> {
		radioError = null;
		if (!hasStarted || sessionEnded || isProcessing || isArmingMic) return;
		if (mediaRecorder?.state === 'recording') return;

		pttHeld = true;
		isArmingMic = true;

		try {
			if (!navigator.mediaDevices?.getUserMedia) {
				radioError = 'Microphone is not supported in this browser.';
				return;
			}

			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			if (!pttHeld || pttDestroyed) {
				for (const track of stream.getTracks()) track.stop();
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
					: mimeType ?? 'audio/webm';
			audioChunks = [];
			clipStartedAt = Date.now();

			mediaRecorder.ondataavailable = (event) => {
				if (event.data.size > 0) audioChunks.push(event.data);
			};

			mediaRecorder.onstop = async () => {
				clearClipLimitTimer();
				stopMediaTracks();
				mediaRecorder = null;
				const startedAt = clipStartedAt;
				clipStartedAt = null;

				const blob = new Blob(audioChunks, { type: recordedType });
				audioChunks = [];
				if (blob.size === 0 || !startedAt) {
					isRecording = false;
					return;
				}

				const clipSeconds = Math.min(
					DEMO_MAX_CLIP_SECONDS,
					Math.max(1, Math.ceil((Date.now() - startedAt) / 1000))
				);

				isProcessing = true;
				try {
					await sendDemoRadio(blob, recordedType, clipSeconds);
				} catch (err) {
					console.error('Demo radio failed:', err);
					radioError = err instanceof Error ? err.message : 'Could not send radio audio.';
				} finally {
					isProcessing = false;
					isRecording = false;
				}
			};

			clipLimitTimer = setTimeout(() => {
				if (mediaRecorder?.state === 'recording') mediaRecorder.stop();
			}, DEMO_MAX_CLIP_SECONDS * 1000);

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

	function stopRecording(): void {
		pttHeld = false;
		isRecording = false;
		clearClipLimitTimer();
		if (mediaRecorder && mediaRecorder.state === 'recording') {
			mediaRecorder.stop();
		}
	}

	function onPttPointerDown(event: PointerEvent): void {
		event.preventDefault();
		void startRecording();
	}

	function onPttPointerUp(event: PointerEvent): void {
		event.preventDefault();
		stopRecording();
	}

	function persistReplay(): void {
		saveDemoReplay({
			version: 1,
			scenarioTitle: scenarioTitle,
			scenarioId: data.demoScenario?.id ?? null,
			startedAt: sessionStartedAt ?? new Date().toISOString(),
			endedAt: new Date().toISOString(),
			durationSeconds: sessionSeconds,
			events: timelineEvents.map((event) => ({
				id: event.id,
				type: event.type,
				text: event.text,
				time: event.time,
				atSecond: sessionSeconds
			})),
			boardEntries: boardEntries.map((entry) => ({ ...entry })),
			radioSecondsUsed
		});
	}

	function handleEndSession(reason: 'user' | 'timeout' = 'user'): void {
		if (sessionEnded) return;
		sessionEnded = true;
		stopClock();
		isPaused = true;
		stopRecording();
		const message =
			reason === 'timeout'
				? 'Scenario time limit reached. Review your run or create an account to save replay.'
				: 'Scenario ended. Review your run or create an account to save replay.';
		addTimelineEvent('END', message);
		persistReplay();
	}

	function applyScriptEvent(event: DemoScriptEvent): void {
		if (event.stage) currentStage = event.stage;
		if (event.side) currentSide = event.side;
		if (event.type === 'ARRIVAL' || event.type === 'UNIT') {
			const arrivingUnit = parseArrivalUnit(event.text);
			if (
				arrivingUnit &&
				!availableUnits.includes(arrivingUnit) &&
				!boardEntries.some((entry) => entry.unitName === arrivingUnit)
			) {
				availableUnits = [...availableUnits, arrivingUnit];
			}
		}
		if (
			event.addBoardEntry &&
			!boardEntries.some((entry) => entry.id === event.addBoardEntry?.id)
		) {
			boardEntries = [...boardEntries, event.addBoardEntry];
		}
		if (event.removeAvailableUnit) {
			availableUnits = availableUnits.filter((unit) => unit !== event.removeAvailableUnit);
		}
		if (event.addAvailableUnit && !availableUnits.includes(event.addAvailableUnit)) {
			availableUnits = [...availableUnits, event.addAvailableUnit];
		}
		addTimelineEvent(event.type, event.text, event.atSecond);
	}

	function runDueScriptEvents(): void {
		const dueEvents = activeDemoScript.filter(
			(event) => event.atSecond <= sessionSeconds && !firedScriptEventIds.includes(event.id)
		);
		if (dueEvents.length === 0) return;
		for (const event of dueEvents) applyScriptEvent(event);
		firedScriptEventIds = [...firedScriptEventIds, ...dueEvents.map((event) => event.id)];
	}

	function resetDemoState(): void {
		stopClock();
		stopRecording();
		hasStarted = false;
		isPaused = false;
		sessionEnded = false;
		sessionStartedAt = null;
		sessionSeconds = 0;
		currentStage = 'incipient';
		currentSide = 'alpha';
		boardEntries = [];
		boardColumns = buildBoardColumns();
		availableUnits = initialAvailableUnits();
		firedScriptEventIds = [];
		dispatchSheetOpen = false;
		editSheetOpen = false;
		dispatchUnitName = '';
		dispatchDivision = 'Div 1';
		dispatchAssignment = '';
		editingEntry = null;
		editDivision = '';
		editAssignment = '';
		editStatus = '';
		timelineFilter = 'all';
		radioError = null;
		lastTranscript = '';
		radioSecondsUsed = 0;
		isProcessing = false;
		timelineEvents = [
			{
				id: 'intro',
				type: 'INFO',
				text: 'Scenario loading. Hold the mic to talk on the radio once live.',
				time: '00:00'
			}
		];
	}

	function handleStartDemo(): void {
		if (hasStarted) return;
		hasStarted = true;
		isPaused = false;
		sessionStartedAt = new Date().toISOString();
		addTimelineEvent('START', 'Free scenario started. Hold the mic to talk on the radio.');
		runDueScriptEvents();
		startClock();
	}

	function handlePauseResume(): void {
		if (!hasStarted) return;
		if (isPaused) {
			isPaused = false;
			addTimelineEvent('RESUME', 'Demo resumed.');
			startClock();
			return;
		}
		isPaused = true;
		addTimelineEvent('PAUSE', 'Demo paused.');
		stopClock();
	}

	function handleResetDemo(): void {
		resetDemoState();
	}

	function openDispatchSheet(unitName: string, division = boardColumnChoices[0] ?? 'Working Assignments'): void {
		dispatchUnitName = unitName;
		dispatchDivision = division;
		dispatchAssignment = '';
		dispatchSheetOpen = true;
	}

	function submitDispatch(): void {
		if (!dispatchUnitName) return;
		const unitName = dispatchUnitName;
		const division = dispatchDivision;
		const assignment = dispatchAssignment.trim();
		const entry: DemoBoardEntry = {
			id: `manual-${unitName}-${division}`,
			division,
			unitName,
			assignment,
			status: 'Assigned'
		};
		boardEntries = [...boardEntries.filter((existing) => existing.unitName !== unitName), entry];
		availableUnits = availableUnits.filter((unit) => unit !== unitName);
		dispatchSheetOpen = false;
		dispatchUnitName = '';
		dispatchAssignment = '';
		addTimelineEvent(
			'DISPATCH',
			`${unitName} → ${division}${assignment ? ` (${assignment})` : ''}`
		);
	}

	function openEdit(entry: DemoBoardEntry): void {
		editingEntry = entry;
		editDivision = entry.division;
		editAssignment = entry.assignment;
		editStatus = entry.status;
		editSheetOpen = true;
	}

	function closeEdit(): void {
		editSheetOpen = false;
		editingEntry = null;
	}

	function saveEdit(): void {
		if (!editingEntry) return;
		const nextEntry: DemoBoardEntry = {
			...editingEntry,
			division: editDivision,
			assignment: editAssignment.trim(),
			status: editStatus
		};
		boardEntries = boardEntries.map((entry) => (entry.id === nextEntry.id ? nextEntry : entry));
		addTimelineEvent('FIX', `Updated ${nextEntry.unitName}.`);
		closeEdit();
	}

	function cycleEntryStatus(entry: DemoBoardEntry): void {
		const status = nextStatus(entry.status);
		boardEntries = boardEntries.map((existing) =>
			existing.id === entry.id ? { ...existing, status } : existing
		);
		addTimelineEvent('STATUS', `${entry.unitName} ${status}.`);
	}

	function returnEditingUnitToAvailable(): void {
		if (!editingEntry) return;
		const entry = editingEntry;
		boardEntries = boardEntries.filter((existing) => existing.id !== entry.id);
		if (!availableUnits.includes(entry.unitName))
			availableUnits = [...availableUnits, entry.unitName];
		addTimelineEvent('BOARD', `${entry.unitName} returned to available units.`);
		closeEdit();
	}

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
			const width = img.naturalWidth || img.width;
			const height = img.naturalHeight || img.height;
			if (!(width > 0) || !(height > 0)) return;
			sceneImageIntrinsics = { url, width, height };
		};
		img.onerror = () => {
			if (!cancelled) sceneImageIntrinsics = null;
		};
		img.src = url;
		return () => {
			cancelled = true;
		};
	});

	onDestroy(() => {
		stopClock();
		pttDestroyed = true;
		pttHeld = false;
		clearClipLimitTimer();
		if (mediaRecorder?.state === 'recording') {
			mediaRecorder.stop();
		} else {
			stopMediaTracks();
		}
		if (teardownViewportResize) teardownViewportResize();
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
		void warmScenarioMedia();
		handleStartDemo();
	});
</script>

<svelte:head>
	<title>{pageTitle}</title>
	<meta name="description" content={pageDescription} />
	<link rel="canonical" href={canonicalUrl} />
	<meta name="robots" content="index,follow" />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="3AlarmLabs" />
	<meta property="og:title" content={pageTitle} />
	<meta property="og:description" content={pageDescription} />
	<meta property="og:url" content={canonicalUrl} />
	<meta property="og:image" content={defaultOgImageUrl} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={pageTitle} />
	<meta name="twitter:description" content={pageDescription} />
	<meta name="twitter:image" content={defaultOgImageUrl} />
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- JSON-LD is generated from trusted static page metadata. -->
	{@html demoJsonLdScript}
</svelte:head>

<div class="min-h-screen bg-muted/25 text-foreground">
	<div class="mx-auto max-w-7xl px-3 sm:px-8 lg:px-10">
		<LandingHeader {monthlyPrice} />

		<main class="py-6 sm:py-16">
			<div class="mx-auto max-w-7xl">
				<header class="max-w-3xl">
					<p class="text-sm font-semibold tracking-[0.18em] text-muted-foreground uppercase">
						Free command scenario
					</p>
					<h1
						class="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:mt-4 sm:text-5xl"
					>
						Run a real self-paced command simulation — free
					</h1>
					<p class="mt-4 text-sm leading-6 text-muted-foreground sm:mt-5 sm:text-lg sm:leading-7">
						Work the incident with radio traffic, unit assignments, changing conditions, and
						after-action review. No account required. Push-to-talk radio is included
						({DEMO_MAX_CLIP_SECONDS}s max per transmission).
					</p>
				</header>

				<section class="mt-6 overflow-hidden rounded-xl border bg-card shadow-sm sm:mt-8">
					<div class="border-b px-4 py-4 sm:px-5">
						<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
							<div class="min-w-0">
								<h2 class="truncate text-lg font-semibold">{scenarioTitle}</h2>
								<p class="mt-1 line-clamp-2 text-sm text-muted-foreground">{scenarioDescription}</p>
							</div>
							<div class="flex flex-wrap items-center gap-1.5 sm:gap-2">
								<Badge class={sessionEnded ? 'bg-muted text-foreground' : 'bg-green-500 text-white'}>
									{sessionEnded ? 'ENDED' : isPaused ? 'PAUSED' : 'LIVE'}
								</Badge>
								<Badge variant="outline">{stageLabels[currentStage]}</Badge>
								<Badge variant="outline">{sideLabels[currentSide]}</Badge>
								<span class="font-mono text-sm text-muted-foreground"
									>{formatClock(sessionSeconds)} / {timeLimitLabel}</span
								>
							</div>
						</div>
						<div class="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
							<Button class="min-h-11 px-2" disabled={hasStarted} onclick={handleStartDemo}>
								Start Scenario
							</Button>
							<Button
								class="min-h-11 px-2"
								variant="outline"
								disabled={!hasStarted || sessionEnded}
								onclick={handlePauseResume}
							>
								{isPaused ? 'Resume' : 'Pause'}
							</Button>
							<Button
								class="min-h-11 px-2"
								variant="outline"
								disabled={!hasStarted || sessionEnded}
								onclick={() => handleEndSession('user')}
							>
								End Session
							</Button>
							<Button class="min-h-11 px-2" variant="outline" onclick={handleResetDemo}
								>Reset</Button
							>
						</div>
					</div>

					<div class="grid gap-4 p-3 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(420px,500px)]">
						<div class="space-y-4">
							<div class="overflow-hidden rounded-lg border bg-muted/20">
								<div
									bind:clientWidth={demoSceneShelfW}
									class="flex justify-center bg-muted/30 p-1 sm:p-2"
								>
									<div
										class="relative overflow-hidden rounded-lg bg-muted shadow-sm ring-1 ring-border/60 {demoSceneSizedStyle
											? ''
											: 'h-[min(38vh,360px)] w-full sm:h-[min(52vh,520px)]'}"
										style={demoSceneSizedStyle}
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
												alt={sideLabels[currentSide]}
												class={SCENE_FOREGROUND_FILL_CLASS}
												width="960"
												height="360"
												decoding="async"
											/>
										{:else}
											<div
												class="absolute inset-0 bg-linear-to-br from-slate-900 via-slate-700 to-orange-700"
											></div>
											<div
												class="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.18),transparent_45%)]"
											></div>
										{/if}
										<div
											class="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-linear-to-t from-black/75 via-black/25 to-transparent p-3 sm:p-4"
										>
											<p class="text-sm font-semibold text-white">{scenarioTitle}</p>
											{#if data.demoScenario?.dispatchNotes}
												<p
													class="mt-1 line-clamp-1 text-xs whitespace-pre-line text-white/85 sm:line-clamp-2"
												>
													{data.demoScenario.dispatchNotes}
												</p>
											{:else}
												<p class="mt-1 text-xs text-white/85">
													Heavy smoke from the first floor with extension toward the attic.
												</p>
											{/if}
										</div>
										<div class="absolute top-3 right-3 z-20 flex gap-1.5">
											<span
												class="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white sm:text-[11px] {stageBadgeClass[
													currentStage
												]}"
											>
												{stageLabels[currentStage]}
											</span>
											<span
												class="rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white sm:text-[11px]"
											>
												{sideLabels[currentSide]}
											</span>
										</div>
										{#if sessionComplete}
											<div
												class="absolute inset-0 z-30 flex items-center justify-center bg-black/55 p-4"
											>
												<div
													class="max-w-sm rounded-xl border border-white/20 bg-background p-4 text-center shadow-xl sm:p-5"
												>
													<h3 class="text-lg font-semibold">Scenario complete</h3>
													<p class="mt-2 text-sm text-muted-foreground">
														Create an account to save your replay, unlock unlimited radio, and access
														the full scenario library.
													</p>
													<div class="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
														<Button class="min-h-11" href={SAVE_REPLAY_SIGNUP_HREF}
															>Create account & save replay</Button
														>
														<Button class="min-h-11" variant="outline" href={INDIVIDUAL_SIGNUP_HREF}
															>Start 7-day trial</Button
														>
													</div>
												</div>
											</div>
										{/if}
									</div>
								</div>
							</div>

							<div class="rounded-lg border bg-background">
								<div class="border-b px-3 py-2">
									<h3 class="text-xs font-semibold tracking-wide uppercase">Available Units</h3>
								</div>
								<div class="space-y-3 px-3 py-3">
									{#if availableUnits.length > 0}
										<div class="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
											{#each availableUnits as unit (unit)}
												<button
													type="button"
													onclick={() => openDispatchSheet(unit)}
													class="min-h-11 rounded-md border bg-secondary px-3 py-2 text-left text-xs font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 sm:min-h-0 sm:px-2.5 sm:py-1"
												>
													<span class="block text-sm sm:inline sm:text-xs">{unit}</span>
													<span class="text-muted-foreground">Dispatch</span>
												</button>
											{/each}
										</div>
									{:else}
										<p class="text-xs text-muted-foreground">
											{hasPendingScriptedArrivals
												? 'Waiting on scripted arrivals.'
												: 'No available units in this preview.'}
										</p>
									{/if}
									<p class="text-xs text-muted-foreground">
										Tap a unit to manually assign a board box and assignment, or use push-to-talk
										radio below.
									</p>
								</div>
							</div>

							<div class="rounded-lg border bg-background">
								<div class="border-b px-3 py-2">
									<h3 class="text-xs font-semibold tracking-wide uppercase">
										Incident Command Board
									</h3>
								</div>
								<div class="space-y-3 p-3 sm:hidden">
									{#if boardEntries.length > 0}
										<div class="space-y-2">
											{#each boardEntries as entry (entry.id)}
												<div class="rounded-xl border bg-card p-3">
													<div class="flex items-start justify-between gap-2">
														<button
															type="button"
															onclick={() => openEdit(entry)}
															class="min-w-0 flex-1 text-left"
														>
															<p class="truncate text-sm font-semibold">{entry.unitName}</p>
															<p class="mt-0.5 truncate text-xs text-muted-foreground">
																{entry.division}{entry.assignment ? ` · ${entry.assignment}` : ''}
															</p>
														</button>
														<button
															type="button"
															onclick={() => cycleEntryStatus(entry)}
															class="min-h-9 shrink-0 rounded-full px-2.5 text-[11px] font-semibold {STATUS_COLORS[
																entry.status
															] ?? 'bg-gray-100 text-gray-700'}"
														>
															{entry.status}
														</button>
													</div>
												</div>
											{/each}
										</div>
									{:else}
										<div class="rounded-xl border border-dashed bg-muted/20 px-4 py-6 text-center">
											<p class="text-sm font-medium">No units assigned yet</p>
											<p class="mt-1 text-xs text-muted-foreground">
												Tap an available unit or choose a board box below.
											</p>
										</div>
									{/if}

									<div>
										<p
											class="mb-2 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase"
										>
											Quick add to board box
										</p>
										<div class="grid grid-cols-2 gap-2">
											{#each boardColumnChoices as division (division)}
												<button
													type="button"
													disabled={availableUnits.length === 0}
													onclick={() => {
														const unitName = availableUnits[0];
														if (unitName) openDispatchSheet(unitName, division);
													}}
													class="min-h-11 rounded-lg border border-dashed bg-background px-3 text-left text-xs font-medium transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
												>
													{division}
												</button>
											{/each}
										</div>
									</div>
								</div>
								<div class="hidden overflow-x-auto p-2 sm:block">
									<div class="flex min-w-[760px] gap-1">
										{#each boardColumns as column (column.key)}
											<div class="min-h-40 w-24 rounded border {column.colorClass}">
												<div
													class="flex min-h-8 items-center justify-center border-b bg-muted/40 px-1 text-[10px] leading-tight font-semibold tracking-wide text-muted-foreground uppercase"
												>
													{column.header}
												</div>
												<div class="space-y-1 p-1">
													{#each entriesForColumn(boardEntries, column) as entry (entry.id)}
														<div class="rounded border bg-card text-[10px] leading-tight">
															<button
																type="button"
																onclick={() => openEdit(entry as DemoBoardEntry)}
																class="w-full px-1.5 py-1 text-left transition-colors hover:bg-muted"
																title="Click to edit this assignment"
															>
																<p class="font-medium">{formatUnitAssignmentLine(entry)}</p>
															</button>
															<button
																type="button"
																onclick={() => cycleEntryStatus(entry as DemoBoardEntry)}
																class="m-1 mt-0 rounded px-1.5 py-0.5 text-left text-[9px] font-semibold {STATUS_COLORS[
																	entry.status
																] ?? 'bg-gray-100 text-gray-700'}"
																title="Click to cycle status"
															>
																{entry.status}
															</button>
														</div>
													{:else}
														<button
															type="button"
															disabled={availableUnits.length === 0}
															onclick={() => {
																const unitName = availableUnits[0];
																if (unitName) openDispatchSheet(unitName, column.label || column.header);
															}}
															class="min-h-9 w-full rounded border border-dashed px-1.5 py-1 text-[10px] leading-tight text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
														>
															Add unit
														</button>
													{/each}
												</div>
											</div>
										{/each}
									</div>
								</div>
							</div>
						</div>

						<aside class="flex flex-col gap-4">
							<div class="order-2 rounded-lg border bg-background lg:order-0">
								<div class="border-b px-3 py-2">
									<div class="flex items-center justify-between gap-2">
										<h3 class="text-xs font-semibold tracking-wide uppercase">
											Timeline ({filteredTimelineEvents.length})
										</h3>
										<div class="flex flex-wrap gap-1">
											{#each [{ id: 'all', label: 'All' }, { id: 'RADIO', label: 'Radio' }, { id: 'STAGE', label: 'Stage' }, { id: 'HAZARD', label: 'Hazard' }] as filter (filter.id)}
												<button
													type="button"
													onclick={() => (timelineFilter = filter.id as typeof timelineFilter)}
													class="rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors {timelineFilter ===
													filter.id
														? 'bg-foreground text-background'
														: 'bg-muted text-muted-foreground hover:bg-muted/70'}"
												>
													{filter.label}
												</button>
											{/each}
										</div>
									</div>
								</div>
								<div
									use:timelineScrollContainer
									class="max-h-72 space-y-3 overflow-y-auto p-3 sm:max-h-136 sm:p-4"
								>
									{#each filteredTimelineEvents as event (event.id)}
										<div
											class="grid grid-cols-[3.25rem_auto_minmax(0,1fr)] gap-2 text-xs sm:grid-cols-[3.75rem_auto_minmax(0,1fr)] sm:gap-3 sm:text-sm"
										>
											<span class="shrink-0 font-mono text-muted-foreground">{event.time}</span>
											<Badge variant="outline" class="h-fit shrink-0 text-[10px]"
												>{event.type}</Badge
											>
											<p class="min-w-0 leading-6 wrap-break-word">{event.text}</p>
										</div>
									{/each}
								</div>
							</div>

							<div class="order-1 rounded-lg border bg-background lg:order-0">
								<div class="border-b px-3 py-2">
									<h3 class="text-xs font-semibold tracking-wide uppercase">
										Radio - Push to Talk
									</h3>
								</div>
								<div
									class="flex items-center gap-4 p-3 text-left sm:flex-col sm:gap-2 sm:p-4 sm:text-center"
								>
									<div class="flex shrink-0 flex-col items-center">
										<button
											type="button"
											onpointerdown={onPttPointerDown}
											onpointerup={onPttPointerUp}
											onpointercancel={onPttPointerUp}
											onlostpointercapture={onPttPointerUp}
											disabled={!hasStarted || sessionEnded || isProcessing}
											class="relative flex h-16 w-16 touch-none items-center justify-center rounded-full border-4 transition-all select-none disabled:cursor-not-allowed disabled:opacity-50 {isRecording
												? 'scale-110 border-red-500 bg-red-500'
												: 'border-red-300 bg-red-500/80 hover:bg-red-500'}"
											aria-label="Push to talk"
											aria-pressed={isRecording}
										>
											<MicIcon class="h-6 w-6 text-white" />
										</button>
									</div>
									<div class="min-w-0">
										<p class="text-xs font-medium text-foreground">
											{DEMO_MAX_CLIP_SECONDS}s max per transmission.
										</p>
										<p class="mt-1 text-[11px] leading-relaxed text-muted-foreground">
											{isArmingMic
												? 'Starting mic…'
												: isRecording
													? 'Recording…'
													: isProcessing
														? 'Processing…'
														: hasStarted
															? 'Hold to talk on the radio.'
															: 'Start the scenario to use radio.'}
										</p>
										{#if radioError}
											<p class="mt-2 text-[11px] text-destructive" role="alert">{radioError}</p>
										{/if}
										{#if lastTranscript}
											<p class="mt-2 rounded-md border bg-muted/50 p-2 text-[11px] text-muted-foreground">
												"{lastTranscript}"
											</p>
										{/if}
									</div>
								</div>
							</div>
						</aside>
					</div>
				</section>

				<section
					class="mt-8 rounded-none border border-border bg-primary p-6 text-primary-foreground shadow-sm sm:p-8"
				>
					<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<div class="max-w-xl">
							<h2 class="text-2xl font-semibold tracking-tight">Save your replay and keep training</h2>
							<p class="mt-2 text-sm leading-6 text-primary-foreground/85">
								Create an account to save this run, unlock unlimited radio, and access weekly library
								scenarios. Departments and training companies can request team access.
							</p>
						</div>
						<div class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
							<Button
								class="w-full rounded-none bg-card text-foreground hover:bg-muted sm:w-auto"
								href={SAVE_REPLAY_SIGNUP_HREF}
							>
								Create account & save replay
							</Button>
							<Button
								variant="outline"
								class="w-full rounded-none border-primary-foreground/60 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground sm:w-auto"
								href={INDIVIDUAL_SIGNUP_HREF}
							>
								Start 7-day trial
							</Button>
							<Button
								variant="outline"
								class="w-full rounded-none border-primary-foreground/60 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground sm:w-auto"
								href={TEAM_ACCESS_HREF}
							>
								Explore team access
							</Button>
						</div>
					</div>
				</section>
			</div>
		</main>

		<Sheet.Root bind:open={dispatchSheetOpen}>
			<Sheet.Content
				side="bottom"
				class="max-h-[90dvh] overflow-y-auto rounded-t-2xl pb-[max(env(safe-area-inset-bottom),1rem)]"
			>
				<Sheet.Header class="text-left">
					<Sheet.Title class="text-base">Dispatch {dispatchUnitName}</Sheet.Title>
					<Sheet.Description class="text-xs">
						Pick a board box and assignment. This updates the demo board locally.
					</Sheet.Description>
				</Sheet.Header>
				<div class="space-y-3 px-4">
					<div>
						<p class="mb-1 text-xs font-medium">Division</p>
						<div class="flex flex-wrap gap-1.5">
							{#each boardColumnChoices as division (division)}
								<button
									type="button"
									onclick={() => (dispatchDivision = division)}
									class="min-h-10 rounded-full border px-3 text-xs font-medium transition-colors {dispatchDivision ===
									division
										? 'border-primary bg-primary text-primary-foreground'
										: 'bg-background hover:bg-muted'}"
								>
									{division}
								</button>
							{/each}
						</div>
					</div>
					<div>
						<label for="dispatch-assignment" class="mb-1 block text-xs font-medium"
							>Assignment</label
						>
						<Input
							id="dispatch-assignment"
							bind:value={dispatchAssignment}
							placeholder="e.g. search, vent, RIC"
							class="h-11"
						/>
						<div class="mt-1.5 flex flex-wrap gap-1.5">
							{#each ASSIGNMENT_SUGGESTIONS as suggestion (suggestion)}
								<button
									type="button"
									onclick={() => (dispatchAssignment = suggestion)}
									class="min-h-9 rounded-full border bg-background px-2.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted"
								>
									{suggestion}
								</button>
							{/each}
						</div>
					</div>
				</div>
				<Sheet.Footer class="flex flex-row justify-end gap-2 px-4 pt-0 pb-2">
					<Button
						variant="outline"
						size="sm"
						class="min-h-10"
						onclick={() => (dispatchSheetOpen = false)}
					>
						Cancel
					</Button>
					<Button size="sm" class="min-h-10" onclick={submitDispatch}>Dispatch</Button>
				</Sheet.Footer>
			</Sheet.Content>
		</Sheet.Root>

		<Sheet.Root
			bind:open={editSheetOpen}
			onOpenChange={(isOpen) => {
				if (!isOpen) closeEdit();
			}}
		>
			<Sheet.Content
				side="bottom"
				class="max-h-[90dvh] overflow-y-auto rounded-t-2xl pb-[max(env(safe-area-inset-bottom),1rem)]"
			>
				<Sheet.Header class="text-left">
					<Sheet.Title class="text-base">Edit {editingEntry?.unitName ?? 'unit'}</Sheet.Title>
					<Sheet.Description class="text-xs">
						Correct the assignment or return this unit to available resources.
					</Sheet.Description>
				</Sheet.Header>
				<div class="space-y-3 px-4">
					<div>
						<p class="mb-1 text-xs font-medium">Division</p>
						<div class="flex flex-wrap gap-1.5">
							{#each boardColumnChoices as division (division)}
								<button
									type="button"
									onclick={() => (editDivision = division)}
									class="min-h-10 rounded-full border px-3 text-xs font-medium transition-colors {editDivision ===
									division
										? 'border-primary bg-primary text-primary-foreground'
										: 'bg-background hover:bg-muted'}"
								>
									{division}
								</button>
							{/each}
						</div>
					</div>
					<div>
						<label for="edit-assignment" class="mb-1 block text-xs font-medium">Assignment</label>
						<Input id="edit-assignment" bind:value={editAssignment} class="h-11" />
					</div>
					<div>
						<p class="mb-1 text-xs font-medium">Status</p>
						<div class="flex flex-wrap gap-1.5">
							{#each STATUS_CHOICES as status (status)}
								<button
									type="button"
									onclick={() => (editStatus = status)}
									class="min-h-10 rounded-full border px-3 text-xs font-medium transition-colors {editStatus ===
									status
										? `border-transparent ${STATUS_COLORS[status] ?? 'bg-foreground text-background'}`
										: 'bg-background hover:bg-muted'}"
								>
									{status}
								</button>
							{/each}
						</div>
					</div>
				</div>
				<Sheet.Footer class="flex flex-row flex-wrap justify-end gap-2 px-4 pt-0 pb-2">
					<Button
						variant="outline"
						size="sm"
						class="min-h-10"
						onclick={returnEditingUnitToAvailable}
					>
						Return to available
					</Button>
					<Button variant="outline" size="sm" class="min-h-10" onclick={closeEdit}>Cancel</Button>
					<Button size="sm" class="min-h-10" onclick={saveEdit}>Save</Button>
				</Sheet.Footer>
			</Sheet.Content>
		</Sheet.Root>

		<LandingFooter />
	</div>
</div>
