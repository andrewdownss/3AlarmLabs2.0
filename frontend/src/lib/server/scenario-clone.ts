import type { SelfPacedConfig } from '$lib/self-paced';

function newId(prefix: string): string {
	return `${prefix}-${crypto.randomUUID()}`;
}

/** Deep-clone a self-paced config with fresh IDs for timeline/rules/actions. */
export function cloneSelfPacedConfig(config: SelfPacedConfig | null): SelfPacedConfig | null {
	if (!config) return null;
	return {
		timeLimitSeconds: config.timeLimitSeconds,
		endConditions: { ...config.endConditions },
		timeline: config.timeline.map((event) => ({
			...event,
			id: newId('tl'),
			dispatch: { ...event.dispatch }
		})),
		expectedActions: config.expectedActions.map((action) => ({
			...action,
			id: newId('action'),
			match: {
				...action.match,
				unitNames: action.match.unitNames ? [...action.match.unitNames] : undefined,
				assignmentContainsAny: action.match.assignmentContainsAny
					? [...action.match.assignmentContainsAny]
					: undefined
			}
		})),
		assignmentCompletions: config.assignmentCompletions.map((rule) => ({
			...rule,
			id: newId('completion'),
			trigger: {
				...rule.trigger,
				unitNames: rule.trigger.unitNames ? [...rule.trigger.unitNames] : undefined,
				assignmentContainsAny: rule.trigger.assignmentContainsAny
					? [...rule.trigger.assignmentContainsAny]
					: undefined
			},
			dispatch: { ...rule.dispatch }
		}))
	};
}

export function duplicateScenarioTitle(title: string): string {
	const trimmed = title.trim();
	if (!trimmed) return 'Untitled Scenario (Copy)';
	if (/\(copy\)$/i.test(trimmed)) return trimmed;
	return `${trimmed} (Copy)`;
}
