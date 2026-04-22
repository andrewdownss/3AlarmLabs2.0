/**
 * Shared self-paced scenario types.
 *
 * The runtime / DB / authoring UI all read this. The API package keeps a
 * mirrored copy at `api/src/lib/self-paced.ts` — keep them in sync.
 */

export type SimulationOutcome = 'in_progress' | 'completed' | 'failed' | 'timeout';

export type SelfPacedScheduledEventKind =
	| 'assignment_completion'
	| 'time_warning'
	| 'force_end';

/**
 * Payload that mirrors `trainer:state:dispatch` — when emitted, the student
 * UI applies it identically to instructor-driven updates.
 */
export interface SelfPacedDispatchPayload {
	stage?: 'incipient' | 'growth' | 'fully_developed' | 'decay';
	side?: 'alpha' | 'bravo' | 'charlie' | 'delta';
	hazard?: string;
	update?: string;
}

export interface TimelineEvent {
	id: string;
	offsetSeconds: number;
	label?: string;
	dispatch: SelfPacedDispatchPayload;
}

export interface AssignmentMatch {
	unitName?: string;
	assignmentContains?: string;
}

export interface ExpectedAction {
	id: string;
	label: string;
	match: AssignmentMatch;
	deadlineSeconds?: number;
	critical?: boolean;
}

export interface AssignmentCompletionRule {
	id: string;
	label?: string;
	trigger: AssignmentMatch;
	delaySeconds: number;
	dispatch: SelfPacedDispatchPayload;
}

export interface SelfPacedEndConditions {
	onUnderControl?: boolean;
	onTimelineComplete?: boolean;
	onTimeExpired?: boolean;
}

export interface SelfPacedConfig {
	timeLimitSeconds?: number;
	timeline: TimelineEvent[];
	expectedActions: ExpectedAction[];
	assignmentCompletions: AssignmentCompletionRule[];
	endConditions: SelfPacedEndConditions;
}

export const SIMULATION_OUTCOMES: ReadonlyArray<SimulationOutcome> = [
	'in_progress',
	'completed',
	'failed',
	'timeout'
];

export function isValidSelfPacedConfig(value: unknown): value is SelfPacedConfig {
	if (!value || typeof value !== 'object') return false;
	const v = value as Record<string, unknown>;
	return (
		Array.isArray(v.timeline) &&
		Array.isArray(v.expectedActions) &&
		Array.isArray(v.assignmentCompletions) &&
		typeof v.endConditions === 'object'
	);
}

/**
 * Wall-clock simulation time — start time, minus accumulated paused windows,
 * minus the currently-open pause window if the session is paused.
 *
 * Returns 0 before `hasStarted` is set.
 */
export function simulationElapsedMs(
	session: {
		hasStarted: boolean;
		startedAt: Date | string;
		pausedAt: Date | string | null | undefined;
		accumulatedPauseMs: number;
	},
	now: Date = new Date()
): number {
	if (!session.hasStarted) return 0;
	const started = new Date(session.startedAt).getTime();
	const wall = now.getTime() - started;
	const acc = session.accumulatedPauseMs ?? 0;
	const open = session.pausedAt ? now.getTime() - new Date(session.pausedAt).getTime() : 0;
	return Math.max(0, wall - acc - open);
}

const norm = (s: string | undefined): string => (s ?? '').toLowerCase().trim();

/**
 * Detects a student "under control" declaration in a radio transcript.
 *
 * Matches natural variants like "fire under control", "incident under
 * control", "command, under control", etc. Rejects obvious negations
 * ("not under control", "fire is not under control") so a situation report
 * doesn't prematurely end the session.
 */
export function isUnderControlDeclaration(text: string | null | undefined): boolean {
	if (!text) return false;
	const normalized = text
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	if (!normalized) return false;
	if (/\b(not|no|never|isn t|aren t|wasn t|weren t|don t|doesn t)\s+under\s+control\b/.test(normalized)) {
		return false;
	}
	return /\bunder\s+control\b/.test(normalized);
}

/**
 * Case-insensitive substring match for board / radio command inspection.
 * Both fields are optional — when absent the rule still requires *some* match,
 * so empty matchers are treated as "never matches" to avoid noise.
 */
export function matchesAssignment(
	rule: AssignmentMatch,
	candidate: { unitName?: string | null; assignment?: string | null }
): boolean {
	const wantUnit = norm(rule.unitName ?? undefined);
	const wantAsg = norm(rule.assignmentContains ?? undefined);
	if (!wantUnit && !wantAsg) return false;

	const haveUnit = norm(candidate.unitName ?? undefined);
	const haveAsg = norm(candidate.assignment ?? undefined);

	if (wantUnit && !haveUnit.includes(wantUnit) && haveUnit !== wantUnit) return false;
	if (wantAsg && !haveAsg.includes(wantAsg)) return false;
	return true;
}
