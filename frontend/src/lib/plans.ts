export const PLAN_IDS = [
	'expired',
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
	canAccessLibrary: boolean;
	/** Self-serve Stripe Checkout (false for enterprise/contact-sales plans) */
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
	expired: {
		id: 'expired',
		name: 'No subscription',
		maxScenes: 0,
		maxCommandScenarios: 0,
		maxUsers: 1,
		watermark: false,
		canExportVideo: false,
		canShareLink: false,
		canUseFolders: false,
		canAccessLibrary: false,
		canSelfServeCheckout: true,
		checkoutIntervals: [],
		limitsSummary: 'No billing on file yet. Subscribe to unlock training.',
		bestFor: 'Restarting access',
		canInstructorLedCommand: false,
		monthlyPrice: null,
		annualPrice: null
	},
	individual: {
		id: 'individual',
		name: 'Individual',
		maxScenes: -1,
		maxCommandScenarios: -1,
		maxUsers: 1,
		watermark: false,
		canExportVideo: false,
		canShareLink: true,
		canUseFolders: false,
		canAccessLibrary: true,
		canSelfServeCheckout: true,
		checkoutIntervals: ['month'],
		limitsSummary:
			'1 user, unlimited SizeUp scenes, unlimited self-paced Command, and weekly library scenarios.',
		bestFor: 'Promote your career with self-paced command training',
		canInstructorLedCommand: false,
		monthlyPrice: 14.99,
		annualPrice: null
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
		canAccessLibrary: true,
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
		canAccessLibrary: true,
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
		canAccessLibrary: true,
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
		canAccessLibrary: true,
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
		free: 'expired',
		team: 'small_firehouse',
		instructor: 'medium_firehouse',
		enterprise: 'large_firehouse'
	};
	if (raw && raw in legacyMap) return legacyMap[raw];
	return 'expired';
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
