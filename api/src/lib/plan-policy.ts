/**
 * Mirrors frontend plan rules: instructor-led Command requires a firehouse tier (or higher).
 * Keep in sync with `frontend/src/lib/plans.ts` (`canInstructorLedCommand`).
 */
const INSTRUCTOR_LED_PLAN_IDS = new Set([
	'small_firehouse',
	'medium_firehouse',
	'large_firehouse',
	'training_company',
	// Legacy values (pre-firehouse tiers)
	'team',
	'instructor',
	'enterprise'
]);

const CLASSROOM_SEATS_BY_PLAN_ID = new Map<string, number>([
	['medium_firehouse', 30],
	['large_firehouse', 100],
	['training_company', 100],
	// Legacy values (pre-firehouse tiers)
	['instructor', 30],
	['enterprise', 100]
]);

export function planAllowsInstructorLed(planId: string | null | undefined): boolean {
	if (!planId) return false;
	return INSTRUCTOR_LED_PLAN_IDS.has(planId);
}

export function maxClassroomSeatsForPlan(planId: string | null | undefined): number {
	if (!planId) return 0;
	return CLASSROOM_SEATS_BY_PLAN_ID.get(planId) ?? 0;
}

export function planAllowsClassroom(planId: string | null | undefined): boolean {
	return maxClassroomSeatsForPlan(planId) > 0;
}
