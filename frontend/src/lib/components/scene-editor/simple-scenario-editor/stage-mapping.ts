import type { SelfPacedConfig, SelfPacedDispatchPayload, TimelineEvent } from '$lib/self-paced';

export const ARRIVAL_LABEL_PREFIX = 'arrival:';

export const SIMPLE_STAGES = [
	{ key: 'incipient', label: 'Incipient' },
	{ key: 'growth', label: 'Growth' },
	{ key: 'fully_developed', label: 'Fully Developed' },
	{ key: 'decay', label: 'Decay' }
] as const;

export const SIMPLE_SIDES = [
	{ key: 'alpha', label: 'Side Alpha' },
	{ key: 'bravo', label: 'Side Bravo' },
	{ key: 'charlie', label: 'Side Charlie' },
	{ key: 'delta', label: 'Side Delta' }
] as const;

export type SimpleStageKey = (typeof SIMPLE_STAGES)[number]['key'];
export type SimpleSideKey = (typeof SIMPLE_SIDES)[number]['key'];

/** Theme-aware Tailwind classes for fire stage visual hierarchy in the editor. */
export const STAGE_THEME: Record<
	SimpleStageKey,
	{
		section: string;
		rail: string;
		badge: string;
		dot: string;
	}
> = {
	incipient: {
		section:
			'border-emerald-200/70 bg-emerald-50/40 dark:border-emerald-900/50 dark:bg-emerald-950/20',
		rail: 'bg-emerald-500',
		badge:
			'border-emerald-300/60 bg-emerald-100/80 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100',
		dot: 'bg-emerald-500 ring-emerald-500/30'
	},
	growth: {
		section: 'border-amber-200/70 bg-amber-50/40 dark:border-amber-900/50 dark:bg-amber-950/20',
		rail: 'bg-amber-500',
		badge:
			'border-amber-300/60 bg-amber-100/80 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100',
		dot: 'bg-amber-500 ring-amber-500/30'
	},
	fully_developed: {
		section: 'border-orange-200/70 bg-orange-50/40 dark:border-orange-900/50 dark:bg-orange-950/20',
		rail: 'bg-orange-600',
		badge:
			'border-orange-300/60 bg-orange-100/80 text-orange-900 dark:border-orange-800 dark:bg-orange-950/50 dark:text-orange-100',
		dot: 'bg-orange-600 ring-orange-600/30'
	},
	decay: {
		section: 'border-slate-300/70 bg-slate-100/50 dark:border-slate-700/50 dark:bg-slate-900/30',
		rail: 'bg-slate-500',
		badge:
			'border-slate-300/60 bg-slate-100/80 text-slate-800 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200',
		dot: 'bg-slate-500 ring-slate-500/30'
	}
};

export interface SimpleArrival {
	id: string;
	unitName: string;
	offsetSeconds: number;
}

export interface SimpleStageEvent {
	id: string;
	offsetSeconds: number;
	label?: string;
	dispatch: SelfPacedDispatchPayload;
}

export interface SimpleStageSection {
	stage: SimpleStageKey;
	transitionId?: string;
	startSeconds?: number;
	events: SimpleStageEvent[];
}

export interface SimpleScenarioSections {
	arrivals: SimpleArrival[];
	stages: SimpleStageSection[];
	unscheduled: TimelineEvent[];
}

function uid(prefix: string): string {
	return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 10)}`;
}

function clampSeconds(value: number | undefined): number {
	return Math.max(0, Math.floor(Number.isFinite(value) ? Number(value) : 0));
}

export function arrivalLabel(unitName: string): string {
	return `${ARRIVAL_LABEL_PREFIX}${unitName.trim()}`;
}

export function parseArrivalUnit(label: string | null | undefined): string | null {
	if (!label?.startsWith(ARRIVAL_LABEL_PREFIX)) return null;
	const unitName = label.slice(ARRIVAL_LABEL_PREFIX.length).trim();
	return unitName || null;
}

export function isArrivalEvent(event: TimelineEvent): boolean {
	return parseArrivalUnit(event.label) !== null;
}

export function isStageTransitionEvent(event: TimelineEvent): boolean {
	return Boolean(
		event.dispatch.stage &&
		!event.dispatch.side &&
		!event.dispatch.hazard?.trim() &&
		!event.dispatch.update?.trim() &&
		!isArrivalEvent(event)
	);
}

function sortTimeline<T extends { id?: string; offsetSeconds?: number }>(items: T[]): T[] {
	return [...items].sort(
		(a, b) =>
			clampSeconds(a.offsetSeconds) - clampSeconds(b.offsetSeconds) ||
			(a.id ?? '').localeCompare(b.id ?? '')
	);
}

function emptyStageSection(stage: SimpleStageKey): SimpleStageSection {
	return { stage, startSeconds: undefined, events: [] };
}

export function bucketSimpleScenario(config: SelfPacedConfig): SimpleScenarioSections {
	const stages = SIMPLE_STAGES.map((stage) => emptyStageSection(stage.key));
	const stageByKey = new Map<SimpleStageKey, SimpleStageSection>(
		stages.map((stage) => [stage.stage, stage])
	);
	const arrivals: SimpleArrival[] = [];
	const candidates: TimelineEvent[] = [];

	for (const event of sortTimeline(config.timeline)) {
		const unitName = parseArrivalUnit(event.label);
		if (unitName) {
			arrivals.push({
				id: event.id,
				unitName,
				offsetSeconds: clampSeconds(event.offsetSeconds)
			});
			continue;
		}

		if (isStageTransitionEvent(event)) {
			const stage = stageByKey.get(event.dispatch.stage as SimpleStageKey);
			if (stage) {
				stage.transitionId = event.id;
				stage.startSeconds = clampSeconds(event.offsetSeconds);
			}
			continue;
		}

		candidates.push(event);
	}

	const scheduledStages = sortTimeline(
		stages
			.filter(
				(stage): stage is SimpleStageSection & { startSeconds: number } =>
					stage.startSeconds != null
			)
			.map((stage) => ({ ...stage, offsetSeconds: stage.startSeconds }))
	);
	const unscheduled: TimelineEvent[] = [];

	for (const event of candidates) {
		const offsetSeconds = clampSeconds(event.offsetSeconds);
		let activeStage: SimpleStageSection | undefined;

		for (const stage of scheduledStages) {
			if (offsetSeconds < stage.startSeconds) break;
			activeStage = stageByKey.get(stage.stage);
		}

		if (!activeStage) {
			unscheduled.push(event);
			continue;
		}

		activeStage.events.push({
			id: event.id,
			offsetSeconds,
			label: event.label,
			dispatch: { ...event.dispatch }
		});
	}

	for (const stage of stages) stage.events = sortTimeline(stage.events);

	return {
		arrivals: sortTimeline(arrivals),
		stages,
		unscheduled: sortTimeline(unscheduled)
	};
}

export function rebuildTimelineFromSimpleSections(
	sections: SimpleScenarioSections
): TimelineEvent[] {
	const timeline: TimelineEvent[] = [];

	for (const stage of sections.stages) {
		if (stage.startSeconds != null) {
			timeline.push({
				id: stage.transitionId ?? uid(`stage-${stage.stage}`),
				offsetSeconds: clampSeconds(stage.startSeconds),
				label: undefined,
				dispatch: { stage: stage.stage }
			});
		}

		for (const event of stage.events) {
			timeline.push({
				id: event.id,
				offsetSeconds: clampSeconds(event.offsetSeconds),
				label: event.label?.trim() || undefined,
				dispatch: { ...event.dispatch }
			});
		}
	}

	for (const arrival of sections.arrivals) {
		const unitName = arrival.unitName.trim();
		if (!unitName) continue;
		timeline.push({
			id: arrival.id,
			offsetSeconds: clampSeconds(arrival.offsetSeconds),
			label: arrivalLabel(unitName),
			dispatch: { update: `${unitName} on scene` }
		});
	}

	for (const event of sections.unscheduled) {
		timeline.push({
			...event,
			offsetSeconds: clampSeconds(event.offsetSeconds),
			label: event.label?.trim() || undefined,
			dispatch: { ...event.dispatch }
		});
	}

	return sortTimeline(timeline);
}

export function getArrivalUnitNames(config: SelfPacedConfig): string[] {
	const names = new Set<string>();
	for (const event of config.timeline) {
		const unitName = parseArrivalUnit(event.label);
		if (unitName) names.add(unitName);
	}
	return [...names].sort((a, b) => a.localeCompare(b));
}
