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

export function planAllowsInstructorLed(planId: string | null | undefined): boolean {
	if (!planId) return false;
	return INSTRUCTOR_LED_PLAN_IDS.has(planId);
}
