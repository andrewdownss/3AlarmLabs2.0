export const PLAN_IDS = [
	'free',
	'individual',
	'small_firehouse',
	'medium_firehouse',
	'large_firehouse',
	'training_company'
] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export type BillingInterval = 'month' | 'year';

export interface PlanConfig {
	id: PlanId;
	name: string;
	maxScenes: number;
	maxCommandScenarios: number;
	maxUsers: number;
	watermark: boolean;
	canExportVideo: boolean;
	canShareLink: boolean;
	canUseFolders: boolean;
	/** Self-serve Stripe Checkout (null for free / enterprise contact) */
	canSelfServeCheckout: boolean;
	checkoutIntervals: BillingInterval[];
	limitsSummary: string;
	bestFor: string;
	/** Instructor-led command sessions (join codes, student role) */
	canInstructorLedCommand: boolean;
	monthlyPrice: number | null;
	annualPrice: number | null;
}

export const PLANS: Record<PlanId, PlanConfig> = {
	free: {
		id: 'free',
		name: 'Free',
		maxScenes: 3,
		maxCommandScenarios: 3,
		maxUsers: 3,
		watermark: true,
		canExportVideo: false,
		canShareLink: false,
		canUseFolders: false,
		canSelfServeCheckout: false,
		checkoutIntervals: [],
		limitsSummary: 'Up to 3 scenes, basic features.',
		bestFor: 'Trying it out',
		canInstructorLedCommand: false,
		monthlyPrice: 0,
		annualPrice: 0
	},
	individual: {
		id: 'individual',
		name: 'Individual',
		maxScenes: 3,
		maxCommandScenarios: 3,
		maxUsers: 1,
		watermark: false,
		canExportVideo: false,
		canShareLink: true,
		canUseFolders: false,
		canSelfServeCheckout: true,
		checkoutIntervals: ['month', 'year'],
		limitsSummary:
			'1 user, self-paced only, up to 3 active SizeUp scenes, up to 3 active Command scenarios.',
		bestFor: 'Individual firefighters/officers',
		canInstructorLedCommand: false,
		monthlyPrice: 29,
		annualPrice: 299
	},
	small_firehouse: {
		id: 'small_firehouse',
		name: 'Small Firehouse',
		maxScenes: -1,
		maxCommandScenarios: 10,
		maxUsers: 10,
		watermark: false,
		canExportVideo: false,
		canShareLink: true,
		canUseFolders: true,
		canSelfServeCheckout: true,
		checkoutIntervals: ['year'],
		limitsSummary:
			'Up to 10 members, 1 instructor/admin, 10 active Command scenarios, instructor-led + self-paced.',
		bestFor: 'Small volunteer or single-station departments',
		canInstructorLedCommand: true,
		monthlyPrice: null,
		annualPrice: 799
	},
	medium_firehouse: {
		id: 'medium_firehouse',
		name: 'Medium Firehouse',
		maxScenes: -1,
		maxCommandScenarios: 25,
		maxUsers: 30,
		watermark: false,
		canExportVideo: false,
		canShareLink: true,
		canUseFolders: true,
		canSelfServeCheckout: true,
		checkoutIntervals: ['year'],
		limitsSummary:
			'Up to 30 members, 3 instructors/admins, 25 active Command scenarios, shared org workspace.',
		bestFor: 'Combo/career companies and multi-company departments',
		canInstructorLedCommand: true,
		monthlyPrice: null,
		annualPrice: 1499
	},
	large_firehouse: {
		id: 'large_firehouse',
		name: 'Large Firehouse',
		maxScenes: -1,
		maxCommandScenarios: -1,
		maxUsers: 100,
		watermark: false,
		canExportVideo: true,
		canShareLink: true,
		canUseFolders: true,
		canSelfServeCheckout: true,
		checkoutIntervals: ['year'],
		limitsSummary:
			'Up to 100 members, 10 instructors/admins, unlimited active Command scenarios, advanced reporting.',
		bestFor: 'Larger departments, academies, training divisions',
		canInstructorLedCommand: true,
		monthlyPrice: null,
		annualPrice: 3999
	},
	training_company: {
		id: 'training_company',
		name: 'Training Company',
		maxScenes: -1,
		maxCommandScenarios: -1,
		maxUsers: -1,
		watermark: false,
		canExportVideo: true,
		canShareLink: true,
		canUseFolders: true,
		canSelfServeCheckout: false,
		checkoutIntervals: [],
		limitsSummary:
			'Commercial use allowed, up to 5 instructors, up to 50 trainees/year (included), client-facing training rights.',
		bestFor: 'Private training businesses',
		canInstructorLedCommand: true,
		monthlyPrice: null,
		annualPrice: null
	}
};

export function normalizePlanId(raw: string | null | undefined): PlanId {
	if (raw && raw in PLANS) return raw as PlanId;
	const legacyMap: Record<string, PlanId> = {
		team: 'small_firehouse',
		instructor: 'medium_firehouse',
		enterprise: 'large_firehouse'
	};
	if (raw && raw in legacyMap) return legacyMap[raw];
	return 'free';
}

export function getPlanConfig(planId: PlanId): PlanConfig {
	return PLANS[planId];
}

export function canCreateScene(plan: PlanConfig, currentCount: number): boolean {
	if (plan.maxScenes === -1) return true;
	return currentCount < plan.maxScenes;
}

export function canCreateCommandScenario(plan: PlanConfig, currentCount: number): boolean {
	if (plan.maxCommandScenarios === -1) return true;
	return currentCount < plan.maxCommandScenarios;
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
