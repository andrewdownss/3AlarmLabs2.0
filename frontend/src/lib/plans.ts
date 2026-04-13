export const PLAN_IDS = ['free', 'individual', 'team', 'instructor', 'enterprise'] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export type BillingInterval = 'month' | 'year';

export interface PlanConfig {
	id: PlanId;
	name: string;
	maxScenes: number;
	maxUsers: number;
	watermark: boolean;
	canExportVideo: boolean;
	canShareLink: boolean;
	canUseFolders: boolean;
	/** Self-serve Stripe Checkout (null for free / enterprise contact) */
	canSelfServeCheckout: boolean;
	/** Instructor-led command sessions (join codes, student role) */
	canInstructorLedCommand: boolean;
	monthlyPrice: number;
	annualPrice: number;
}

export const PLANS: Record<PlanId, PlanConfig> = {
	free: {
		id: 'free',
		name: 'Free',
		maxScenes: 3,
		maxUsers: 3,
		watermark: true,
		canExportVideo: false,
		canShareLink: false,
		canUseFolders: false,
		canSelfServeCheckout: false,
		canInstructorLedCommand: false,
		monthlyPrice: 0,
		annualPrice: 0
	},
	individual: {
		id: 'individual',
		name: 'Individual',
		maxScenes: -1,
		maxUsers: 1,
		watermark: false,
		canExportVideo: false,
		canShareLink: true,
		canUseFolders: false,
		canSelfServeCheckout: true,
		canInstructorLedCommand: false,
		monthlyPrice: 29.99,
		annualPrice: 299
	},
	team: {
		id: 'team',
		name: 'Team',
		maxScenes: -1,
		maxUsers: 3,
		watermark: false,
		canExportVideo: false,
		canShareLink: true,
		canUseFolders: true,
		canSelfServeCheckout: true,
		canInstructorLedCommand: true,
		monthlyPrice: 54.99,
		annualPrice: 549
	},
	instructor: {
		id: 'instructor',
		name: 'Instructor',
		maxScenes: -1,
		maxUsers: 15,
		watermark: false,
		canExportVideo: true,
		canShareLink: true,
		canUseFolders: true,
		canSelfServeCheckout: true,
		canInstructorLedCommand: true,
		monthlyPrice: 84.99,
		annualPrice: 849
	},
	enterprise: {
		id: 'enterprise',
		name: 'Fire Department / Academy',
		maxScenes: -1,
		maxUsers: -1,
		watermark: false,
		canExportVideo: true,
		canShareLink: true,
		canUseFolders: true,
		canSelfServeCheckout: false,
		canInstructorLedCommand: true,
		monthlyPrice: 0,
		annualPrice: 0
	}
};

export function normalizePlanId(raw: string | null | undefined): PlanId {
	if (raw && raw in PLANS) return raw as PlanId;
	return 'free';
}

export function getPlanConfig(planId: PlanId): PlanConfig {
	return PLANS[planId];
}

export function canCreateScene(plan: PlanConfig, currentCount: number): boolean {
	if (plan.maxScenes === -1) return true;
	return currentCount < plan.maxScenes;
}

export function canInviteUser(plan: PlanConfig, currentMemberCount: number): boolean {
	if (plan.maxUsers === -1) return true;
	return currentMemberCount < plan.maxUsers;
}

export function canStartCommandMode(
	plan: PlanConfig,
	mode: 'self_practice' | 'instructor_led'
): boolean {
	if (mode === 'self_practice') return true;
	return plan.canInstructorLedCommand;
}
