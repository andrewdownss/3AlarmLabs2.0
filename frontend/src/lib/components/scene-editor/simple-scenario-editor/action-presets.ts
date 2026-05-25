import type { AssignmentCompletionRule } from '$lib/self-paced';

export type ActionPresetGroup = 'engine' | 'truck' | 'rescue';

export interface ActionUpdatePreset {
	id: string;
	group: ActionPresetGroup;
	label: string;
	assignmentPhrases: string[];
	dispatchUpdate: string;
	delaySeconds?: number;
}

export const ACTION_UPDATE_PRESETS: ActionUpdatePreset[] = [
	{
		id: 'engine-primary-line',
		group: 'engine',
		label: 'Primary line',
		assignmentPhrases: ['primary line', 'supply line', 'first line'],
		dispatchUpdate: 'grabbed a supply line',
		delaySeconds: 90
	},
	{
		id: 'engine-secondary-line',
		group: 'engine',
		label: 'Secondary / backup line',
		assignmentPhrases: ['secondary line', 'backup line', 'second line'],
		dispatchUpdate: 'grabbed a backup line',
		delaySeconds: 120
	},
	{
		id: 'engine-hydrant',
		group: 'engine',
		label: 'Grabbing a hydrant',
		assignmentPhrases: ['hydrant', 'water supply', 'laying in'],
		dispatchUpdate: 'grabbed a hydrant',
		delaySeconds: 60
	},
	{
		id: 'truck-primary-search',
		group: 'truck',
		label: 'Primary search',
		assignmentPhrases: ['primary search', 'search and rescue', 'primary search complete'],
		dispatchUpdate: 'reports primary search complete',
		delaySeconds: 300
	},
	{
		id: 'truck-horizontal-vent',
		group: 'truck',
		label: 'Horizontal ventilation',
		assignmentPhrases: ['horizontal ventilation', 'horizontal vent', 'ventilation horizontal'],
		dispatchUpdate: 'reports horizontal ventilation complete',
		delaySeconds: 180
	},
	{
		id: 'truck-vertical-vent',
		group: 'truck',
		label: 'Vertical ventilation',
		assignmentPhrases: ['vertical ventilation', 'vertical vent', 'cut the roof', 'roof vent'],
		dispatchUpdate: 'reports vertical ventilation complete',
		delaySeconds: 240
	},
	{
		id: 'truck-gaining-entry',
		group: 'truck',
		label: 'Gaining entry',
		assignmentPhrases: ['gaining entry', 'force entry', 'forcible entry', 'entry team'],
		dispatchUpdate: 'reports entry gained',
		delaySeconds: 120
	},
	{
		id: 'rescue-primary-search',
		group: 'rescue',
		label: 'Primary search',
		assignmentPhrases: ['primary search', 'search and rescue'],
		dispatchUpdate: 'reports primary search complete',
		delaySeconds: 300
	},
	{
		id: 'rescue-horizontal-vent',
		group: 'rescue',
		label: 'Horizontal ventilation',
		assignmentPhrases: ['horizontal ventilation', 'horizontal vent'],
		dispatchUpdate: 'reports horizontal ventilation complete',
		delaySeconds: 180
	},
	{
		id: 'rescue-vertical-vent',
		group: 'rescue',
		label: 'Vertical ventilation',
		assignmentPhrases: ['vertical ventilation', 'vertical vent', 'cut the roof'],
		dispatchUpdate: 'reports vertical ventilation complete',
		delaySeconds: 240
	},
	{
		id: 'rescue-gaining-entry',
		group: 'rescue',
		label: 'Gaining entry',
		assignmentPhrases: ['gaining entry', 'force entry', 'forcible entry'],
		dispatchUpdate: 'reports entry gained',
		delaySeconds: 120
	}
];

export const ACTION_PRESET_GROUPS: { key: ActionPresetGroup; label: string }[] = [
	{ key: 'engine', label: 'Engine' },
	{ key: 'truck', label: 'Truck' },
	{ key: 'rescue', label: 'Rescue' }
];

const UNIT_MATCHERS: Record<ActionPresetGroup, RegExp> = {
	engine: /\bengine\b|\be-\d|\beng\b/i,
	truck: /\btruck\b|\bladder\b|\btower\b|\bl-\d|\bt-\d/i,
	rescue: /\brescue\b|\bsquad\b|\br-\d/i
};

export function filterUnitsByGroup(unitNames: string[], group: ActionPresetGroup): string[] {
	const matcher = UNIT_MATCHERS[group];
	return unitNames.filter((name) => matcher.test(name));
}

function uid(prefix: string): string {
	return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 10)}`;
}

export function createRuleFromPreset(
	preset: ActionUpdatePreset,
	unitNames: string[]
): AssignmentCompletionRule {
	const scopedUnits = filterUnitsByGroup(unitNames, preset.group);
	return {
		id: uid('action-update'),
		label: preset.label,
		trigger: {
			unitNames: scopedUnits.length > 0 ? scopedUnits : undefined,
			assignmentContainsAny: preset.assignmentPhrases
		},
		delaySeconds: preset.delaySeconds ?? 60,
		dispatch: { update: preset.dispatchUpdate }
	};
}

export function presetsForGroup(group: ActionPresetGroup): ActionUpdatePreset[] {
	return ACTION_UPDATE_PRESETS.filter((preset) => preset.group === group);
}
