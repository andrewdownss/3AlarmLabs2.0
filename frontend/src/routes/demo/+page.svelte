<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import { LandingFooter, LandingHeader } from '$lib/components/landing';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { PLANS } from '$lib/plans';
	import { parseArrivalUnit } from '$lib/components/scene-editor/simple-scenario-editor/stage-mapping';
	import {
		COMMAND_BOARD_COLUMNS,
		entriesForColumn,
		formatUnitAssignmentLine
	} from '$lib/trainer-command-board';
	import { defaultOgImageUrl, toCanonicalUrl, toJsonLd } from '$lib/seo';
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
	const individualSignupHref = '/signup?next=%2Fapp%2Fstart-individual';
	const pageTitle = 'Interactive Fire Command Demo | 3AlarmLabs';
	const pageDescription =
		'Preview the 3AlarmLabs self-paced Command interface in a low-resource demo mode with local timeline playback and disabled radio processing.';
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

	const DEMO_PREVIEW_SECONDS = 120;
	const FALLBACK_AVAILABLE_UNITS = ['E1', 'E2', 'T1', 'R1', 'BC1', 'MED1'];

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
		if (timeline.length === 0)
			return fallbackDemoScript.filter((event) => event.atSecond <= DEMO_PREVIEW_SECONDS);

		return [...timeline]
			.sort((a, b) => a.offsetSeconds - b.offsetSeconds)
			.filter((event) => Math.max(0, event.offsetSeconds ?? 0) <= DEMO_PREVIEW_SECONDS)
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
			if (offsetSeconds > DEMO_PREVIEW_SECONDS) continue;
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
	let availableUnits = $state<string[]>(initialAvailableUnits());
	let firedScriptEventIds = $state<string[]>([]);
	let selectedUnitName = $state<string | null>(null);
	let selectedAssignment = $state('');
	let timelineEvents = $state<DemoTimelineEvent[]>([
		{
			id: 'intro',
			type: 'INFO',
			text: 'Press Start Demo to watch the first two minutes of the self-paced run.',
			time: '00:00'
		}
	]);

	let clockInterval: ReturnType<typeof setInterval> | null = null;
	let timelineScrollEls: HTMLDivElement[] = [];
	const activeDemoScript = $derived(scriptFromSelectedScenario());
	const demoDurationSeconds = DEMO_PREVIEW_SECONDS;
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
			'Local-only two-minute playback of the self-paced Command interface.'
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
	const selectedUnitLabel = $derived(selectedUnitName ?? 'Select a unit');

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
			sessionSeconds += 1;
			runDueScriptEvents();
			if (sessionSeconds >= demoDurationSeconds) {
				stopClock();
				isPaused = true;
				addTimelineEvent(
					'END',
					'Two-minute preview complete. Create an account to run the full simulation.',
					demoDurationSeconds
				);
			}
		}, 1000);
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
		hasStarted = false;
		isPaused = false;
		sessionSeconds = 0;
		currentStage = 'incipient';
		currentSide = 'alpha';
		boardEntries = [];
		availableUnits = initialAvailableUnits();
		firedScriptEventIds = [];
		selectedUnitName = null;
		selectedAssignment = '';
		timelineEvents = [
			{
				id: 'intro',
				type: 'INFO',
				text: 'Press Start Demo to watch the first two minutes of the self-paced run.',
				time: '00:00'
			}
		];
	}

	function handleStartDemo(): void {
		if (hasStarted) return;
		hasStarted = true;
		isPaused = false;
		addTimelineEvent('START', 'Simulation started. Preview is running locally for two minutes.');
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

	function selectUnit(unitName: string): void {
		selectedUnitName = unitName;
	}

	function placeSelectedUnit(division: string): void {
		if (!selectedUnitName) return;
		const unitName = selectedUnitName;
		const assignment = selectedAssignment.trim();
		const entry: DemoBoardEntry = {
			id: `manual-${unitName}-${division}`,
			division,
			unitName,
			assignment,
			status: 'Assigned'
		};
		boardEntries = [...boardEntries.filter((existing) => existing.unitName !== unitName), entry];
		availableUnits = availableUnits.filter((unit) => unit !== unitName);
		selectedUnitName = null;
		selectedAssignment = '';
		addTimelineEvent(
			'DISPATCH',
			`${unitName} → ${division}${assignment ? ` (${assignment})` : ''}`
		);
	}

	function returnUnitToAvailable(entry: DemoBoardEntry): void {
		boardEntries = boardEntries.filter((existing) => existing.id !== entry.id);
		if (!availableUnits.includes(entry.unitName))
			availableUnits = [...availableUnits, entry.unitName];
		addTimelineEvent('BOARD', `${entry.unitName} returned to available units.`);
	}

	onDestroy(() => {
		stopClock();
	});

	onMount(() => {
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
	<div class="mx-auto max-w-7xl px-6 sm:px-8 lg:px-10">
		<LandingHeader {monthlyPrice} />

		<main class="py-12 sm:py-16">
			<div class="mx-auto max-w-7xl">
				<header class="max-w-3xl">
					<p class="text-sm font-semibold tracking-[0.18em] text-muted-foreground uppercase">
						Two-minute command preview
					</p>
					<h1 class="mt-4 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
						Watch the first two minutes of the real self-paced simulation.
					</h1>
					<p class="mt-5 text-base leading-7 text-muted-foreground sm:text-lg">
						This page plays the selected authored simulation locally through 02:00. It shows the
						Command board and scenario timeline without creating a session, saving activity, or
						enabling radio processing.
					</p>
				</header>

				<section class="mt-8 rounded-xl border bg-card shadow-sm">
					<div class="border-b px-4 py-4 sm:px-5">
						<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
							<div class="min-w-0">
								<h2 class="truncate text-lg font-semibold">{scenarioTitle}</h2>
								<p class="mt-1 line-clamp-2 text-sm text-muted-foreground">{scenarioDescription}</p>
							</div>
							<div class="flex flex-wrap items-center gap-2">
								<Badge class="bg-green-500 text-white">{isPaused ? 'PAUSED' : 'LIVE'}</Badge>
								<Badge variant="outline">{stageLabels[currentStage]}</Badge>
								<Badge variant="outline">{sideLabels[currentSide]}</Badge>
								<span class="font-mono text-sm text-muted-foreground"
									>{formatClock(sessionSeconds)} / 02:00</span
								>
							</div>
						</div>
						<div class="mt-4 flex flex-wrap gap-2">
							<Button class="min-h-11" disabled={hasStarted} onclick={handleStartDemo}>
								Start Scenario
							</Button>
							<Button
								class="min-h-11"
								variant="outline"
								disabled={!hasStarted}
								onclick={handlePauseResume}
							>
								{isPaused ? 'Resume' : 'Pause'}
							</Button>
							<Button class="min-h-11" variant="outline" onclick={handleResetDemo}>Reset</Button>
						</div>
					</div>

					<div class="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(420px,500px)]">
						<div class="space-y-4">
							<div class="overflow-hidden rounded-lg border bg-muted/20">
								<div class="relative flex h-56 items-end bg-muted p-4 sm:h-64">
									{#if currentSideImage}
										<img
											src={currentSideImage}
											alt={sideLabels[currentSide]}
											class="absolute inset-0 h-full w-full object-cover"
											width="960"
											height="360"
											decoding="async"
										/>
										<div
											class="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-transparent"
										></div>
									{:else}
										<div
											class="absolute inset-0 bg-linear-to-br from-slate-900 via-slate-700 to-orange-700"
										></div>
										<div
											class="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.18),transparent_45%)]"
										></div>
									{/if}
									<div class="relative z-10 max-w-xl">
										<p class="text-sm font-semibold text-white">{scenarioTitle}</p>
										{#if data.demoScenario?.dispatchNotes}
											<p class="mt-1 line-clamp-2 text-xs whitespace-pre-line text-white/85">
												{data.demoScenario.dispatchNotes}
											</p>
										{:else}
											<p class="mt-1 text-xs text-white/85">
												Heavy smoke from the first floor with extension toward the attic.
											</p>
										{/if}
									</div>
									<div class="absolute top-3 right-3 z-10 flex gap-1.5">
										<span
											class="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white {stageBadgeClass[
												currentStage
											]}"
										>
											{stageLabels[currentStage]}
										</span>
										<span class="rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white">
											{sideLabels[currentSide]}
										</span>
									</div>
								</div>
							</div>

							<div class="rounded-lg border bg-background">
								<div class="border-b px-3 py-2">
									<h3 class="text-xs font-semibold tracking-wide uppercase">Available Units</h3>
								</div>
								<div class="space-y-3 px-3 py-3">
									{#if availableUnits.length > 0}
										<div class="flex flex-wrap gap-2">
											{#each availableUnits as unit (unit)}
												<button
													type="button"
													onclick={() => selectUnit(unit)}
													class="rounded-md border px-2.5 py-1 text-xs font-medium transition-colors {selectedUnitName ===
													unit
														? 'border-primary bg-primary text-primary-foreground'
														: 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}"
												>
													{unit}
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
									<div class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
										<label class="sr-only" for="demo-assignment">Assignment</label>
										<input
											id="demo-assignment"
											bind:value={selectedAssignment}
											placeholder="Optional assignment, e.g. interior attack"
											class="h-10 rounded-md border bg-background px-3 text-sm"
										/>
										<p class="self-center text-xs text-muted-foreground">
											{selectedUnitLabel}, then click a command box.
										</p>
									</div>
								</div>
							</div>

							<div class="rounded-lg border bg-background">
								<div class="border-b px-3 py-2">
									<h3 class="text-xs font-semibold tracking-wide uppercase">
										Incident Command Board
									</h3>
								</div>
								<div class="overflow-x-auto p-2">
									<div class="flex min-w-[760px] gap-1">
										{#each COMMAND_BOARD_COLUMNS as column (column.key)}
											<div class="min-h-40 w-24 rounded border bg-muted/20">
												<div
													class="flex min-h-8 items-center justify-center border-b bg-muted/40 px-1 text-[10px] leading-tight font-semibold tracking-wide text-muted-foreground uppercase"
												>
													{column.header || 'Reserve'}
												</div>
												<div class="space-y-1 p-1">
													<button
														type="button"
														disabled={!selectedUnitName}
														onclick={() => placeSelectedUnit(column.key)}
														class="min-h-9 w-full rounded border border-dashed px-1.5 py-1 text-[10px] leading-tight text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
													>
														{selectedUnitName ? `Place ${selectedUnitName}` : 'Select unit'}
													</button>
													{#each entriesForColumn(boardEntries, column.key) as entry (entry.id)}
														<button
															type="button"
															onclick={() => returnUnitToAvailable(entry as DemoBoardEntry)}
															class="w-full rounded border bg-card px-1.5 py-1 text-left text-[10px] leading-tight transition-colors hover:bg-muted"
															title="Click to return this unit to available units"
														>
															<p class="font-medium">{formatUnitAssignmentLine(entry)}</p>
															<p class="mt-0.5 text-muted-foreground">{entry.status}</p>
														</button>
													{/each}
												</div>
											</div>
										{/each}
									</div>
								</div>
							</div>
						</div>

						<aside class="space-y-4">
							<div class="rounded-lg border bg-background">
								<div class="border-b px-3 py-2">
									<h3 class="text-xs font-semibold tracking-wide uppercase">
										Timeline ({timelineEvents.length})
									</h3>
								</div>
								<div use:timelineScrollContainer class="max-h-136 space-y-3 overflow-y-auto p-4">
									{#each timelineEvents as event (event.id)}
										<div class="grid grid-cols-[3.75rem_auto_minmax(0,1fr)] gap-3 text-sm">
											<span class="shrink-0 font-mono text-muted-foreground">{event.time}</span>
											<Badge variant="outline" class="h-fit shrink-0 text-[10px]"
												>{event.type}</Badge
											>
											<p class="min-w-0 leading-6 wrap-break-word">{event.text}</p>
										</div>
									{/each}
								</div>
							</div>

							<div class="rounded-lg border bg-background">
								<div class="border-b px-3 py-2">
									<h3 class="text-xs font-semibold tracking-wide uppercase">Demo mode</h3>
								</div>
								<div class="space-y-2 p-4">
									<p class="text-xs font-medium text-foreground">
										Local playback only. No radio controls are shown.
									</p>
									<p class="text-[11px] leading-relaxed text-muted-foreground">
										The preview does not create a trainer session, request microphone access,
										process audio, or save command-board activity.
									</p>
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
							<h2 class="text-2xl font-semibold tracking-tight">Want full access?</h2>
							<p class="mt-2 text-sm leading-6 text-primary-foreground/85">
								Create an account to run full self-paced sessions with radio capture, AI parsing,
								and after-action review.
							</p>
						</div>
						<div class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
							<Button
								class="w-full rounded-none bg-card text-foreground hover:bg-muted sm:w-auto"
								href={individualSignupHref}
							>
								Start 7-day trial
							</Button>
							<Button
								variant="outline"
								class="w-full rounded-none border-primary-foreground/60 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground sm:w-auto"
								href="/pricing"
							>
								See pricing
							</Button>
						</div>
					</div>
				</section>
			</div>
		</main>

		<LandingFooter />
	</div>
</div>
