/**
 * Mirrors frontend plan rules: instructor-led Command requires Team, Instructor, or Enterprise.
 * Keep in sync with `frontend/src/lib/plans.ts` (`canInstructorLedCommand`).
 */
const INSTRUCTOR_LED_PLAN_IDS = new Set(['team', 'instructor', 'enterprise']);

export function planAllowsInstructorLed(planId: string | null | undefined): boolean {
	if (!planId) return false;
	return INSTRUCTOR_LED_PLAN_IDS.has(planId);
}
