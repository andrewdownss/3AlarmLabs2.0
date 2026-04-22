/**
 * Mirror of `frontend/src/lib/self-paced.ts` — keep them in sync.
 * Shared by API routes, the timeline engine, and the radio matcher.
 */

import { z } from 'zod';

export type SimulationOutcome = 'in_progress' | 'completed' | 'failed' | 'timeout';

export type SelfPacedScheduledEventKind =
	| 'assignment_completion'
	| 'time_warning'
	| 'force_end';

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

export const stageEnum = z.enum(['incipient', 'growth', 'fully_developed', 'decay']);
export const sideEnum = z.enum(['alpha', 'bravo', 'charlie', 'delta']);

export const dispatchPayloadSchema = z
	.object({
		stage: stageEnum.optional(),
		side: sideEnum.optional(),
		hazard: z.string().max(2000).optional(),
		update: z.string().max(2000).optional()
	})
	.refine(
		(p) => p.stage || p.side || (p.hazard && p.hazard.trim()) || (p.update && p.update.trim()),
		'dispatch payload requires at least one field'
	);

export const assignmentMatchSchema = z
	.object({
		unitName: z.string().trim().min(1).optional(),
		assignmentContains: z.string().trim().min(1).optional()
	})
	.refine((m) => m.unitName || m.assignmentContains, 'match requires unitName or assignmentContains');

export const timelineEventSchema = z.object({
	id: z.string().min(1),
	offsetSeconds: z.number().int().min(0).max(60 * 60 * 6),
	label: z.string().max(200).optional(),
	dispatch: dispatchPayloadSchema
});

export const expectedActionSchema = z.object({
	id: z.string().min(1),
	label: z.string().min(1).max(200),
	match: assignmentMatchSchema,
	deadlineSeconds: z.number().int().min(0).max(60 * 60 * 6).optional(),
	critical: z.boolean().optional()
});

export const assignmentCompletionRuleSchema = z.object({
	id: z.string().min(1),
	label: z.string().max(200).optional(),
	trigger: assignmentMatchSchema,
	delaySeconds: z.number().int().min(0).max(60 * 60),
	dispatch: dispatchPayloadSchema
});

export const selfPacedConfigSchema = z.object({
	timeLimitSeconds: z.number().int().min(60).max(60 * 60 * 6).optional(),
	timeline: z.array(timelineEventSchema).default([]),
	expectedActions: z.array(expectedActionSchema).default([]),
	assignmentCompletions: z.array(assignmentCompletionRuleSchema).default([]),
	endConditions: z
		.object({
			onUnderControl: z.boolean().optional(),
			onTimelineComplete: z.boolean().optional(),
			onTimeExpired: z.boolean().optional()
		})
		.default({})
});

/** Parse arbitrary JSON; returns null if invalid (treats invalid as "no script"). */
export function parseSelfPacedConfig(raw: unknown): SelfPacedConfig | null {
	if (raw == null) return null;
	const result = selfPacedConfigSchema.safeParse(raw);
	if (!result.success) return null;
	return result.data;
}

export interface SimulationTimingFields {
	hasStarted: boolean;
	startedAt: Date;
	pausedAt: Date | null;
	accumulatedPauseMs: number;
}

/**
 * Wall-clock simulation time minus accumulated paused windows minus the
 * currently-open pause window. Authoritative timeline / deadline clock.
 */
export function simulationElapsedMs(session: SimulationTimingFields, now: Date = new Date()): number {
	if (!session.hasStarted) return 0;
	const started = session.startedAt.getTime();
	const wall = now.getTime() - started;
	const acc = session.accumulatedPauseMs ?? 0;
	const open = session.pausedAt ? now.getTime() - session.pausedAt.getTime() : 0;
	return Math.max(0, wall - acc - open);
}

const norm = (s: string | undefined | null): string => (s ?? '').toLowerCase().trim();

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
 * Case-insensitive match used by both the expected-action matcher and the
 * assignment-completion scheduler.
 */
export function matchesAssignment(
	rule: AssignmentMatch,
	candidate: { unitName?: string | null; assignment?: string | null }
): boolean {
	const wantUnit = norm(rule.unitName);
	const wantAsg = norm(rule.assignmentContains);
	if (!wantUnit && !wantAsg) return false;

	const haveUnit = norm(candidate.unitName);
	const haveAsg = norm(candidate.assignment);

	if (wantUnit && !haveUnit.includes(wantUnit) && haveUnit !== wantUnit) return false;
	if (wantAsg && !haveAsg.includes(wantAsg)) return false;
	return true;
}
