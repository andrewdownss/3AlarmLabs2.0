import { DEMO_MAX_CLIP_SECONDS } from '$lib/demo/constants';

/** Shared free-demo radio limit copy — keep pricing, hero, and free scenario in sync */
export const freeDemoRadioLimitShort = `${DEMO_MAX_CLIP_SECONDS}s max per radio transmission`;
export const freeDemoRadioLimitDetail = `${DEMO_MAX_CLIP_SECONDS}s max per transmission`;

export interface ValueProp {
	title: string;
	description: string;
}

export interface HowItWorksStep {
	step: string;
	title: string;
	description: string;
}

export interface SeoLink {
	label: string;
	href: string;
}

export interface AudienceCard {
	id: string;
	title: string;
	description: string;
	bullets: string[];
}

export interface CollaborationPartner {
	id: string;
	label: string;
	description: string;
}

export interface Testimonial {
	id: string;
	quote: string;
	name: string;
	role: string;
	org: string;
}

export interface PricingPath {
	id: string;
	label: string;
	title: string;
	price: string;
	description: string;
	cta: string;
	href: string;
	highlight?: boolean;
}

/** Primary public conversion paths */
export const DEMO_HREF = '/demo';
export const TEAM_ACCESS_HREF = '#team-access';
export const INDIVIDUAL_SIGNUP_HREF = '/signup?next=%2Fapp%2Fstart-individual';
export const SAVE_REPLAY_SIGNUP_HREF = '/signup?next=%2Fapp%2Fcommand';

/** Hero preview screenshot */
export const heroPreviewImageUrl =
	'https://hero.3alarmlabs.com/Screenshot%202026-05-26%20at%203.09.57%E2%80%AFPM.png';

export const heroHeadline = 'Practice command before the tones drop.';
export const heroSubheading =
	'Step into realistic fireground scenarios with radio traffic, unit assignments, shifting conditions, and replay review. Train solo for the next seat up, or run it with your crew.';
export const heroSupportLine =
	'Try a free scenario first. Individual plans start at $14.99/month, with department and training company access available.';

export const freeScenarioSection = {
	eyebrow: 'Free scenario',
	title: 'Take the seat for a working fire. No account needed.',
	description: `Start with a residential working fire and see how it feels. Give assignments, manage the board, use push-to-talk radio (${freeDemoRadioLimitShort}), and review the run afterward.`,
	bullets: [
		'A complete self-paced command scenario',
		`Push-to-talk radio with AI parsing (${freeDemoRadioLimitShort})`,
		'A command board that keeps changing as the call develops',
		'Replay review when the run is over'
	],
	cta: 'Run the free scenario',
	radioNote: `Push-to-talk radio included. ${freeDemoRadioLimitDetail} in the free demo.`
};

export const builtForEveryLevel: AudienceCard[] = [
	{
		id: 'firefighters',
		title: 'Firefighters',
		description:
			'Get command reps when you can grab them: at the station, at home, or before the next promotional process sneaks up.',
		bullets: [
			'Self-paced scenarios whenever you have time',
			'Radio practice, size-up, and board discipline',
			'Replay review after each run'
		]
	},
	{
		id: 'departments',
		title: 'Fire departments',
		description:
			'Give members a place to practice command before the drill tower, the assessment center, or the real thing.',
		bullets: [
			'Access for teams, companies, and academies',
			'Instructor-led command sessions',
			'Shared workspace and scenario library'
		]
	},
	{
		id: 'training-companies',
		title: 'Training companies',
		description:
			'Bring clients into command simulations without hauling out a pile of props, whiteboards, and "pretend this is smoke" explanations.',
		bullets: [
			'Commercial training use',
			'Classroom and instructor modes',
			'Custom agreements and invoicing'
		]
	}
];

export const builtWithFireService = {
	eyebrow: 'Built with the fire service',
	title: 'Built with people who actually run incidents',
	description:
		'3AlarmLabs is shaped with training companies, fire departments, and individual firefighters, so the simulator follows real command habits instead of generic click-through training.',
	partners: [
		{
			id: 'training-companies',
			label: 'Training companies',
			description:
				'Scenario design and instructor workflows informed by providers who teach command for a living.'
		},
		{
			id: 'departments',
			label: 'Fire departments',
			description:
				'Department pilots and academy feedback help shape session modes, team access, and the small details that matter.'
		},
		{
			id: 'firefighters',
			label: 'Individual firefighters',
			description:
				'Self-paced reps and replay review refined with officers and officer candidates preparing to lead.'
		}
	] satisfies CollaborationPartner[]
};

export const testimonials: Testimonial[] = [
	{
		id: 'acting-officer',
		quote:
			'I finally have a way to get command reps without waiting around for drill night. The radio traffic and board tracking feel close enough to the real job that it exposes your habits fast.',
		name: 'Acting Officer',
		role: 'Company officer candidate',
		org: 'Career department, Midwest'
	},
	{
		id: 'training-officer',
		quote:
			'We use it between live sessions, almost like homework that people will actually do. Students come in sharper on assignments, radio discipline, and just keeping the incident organized.',
		name: 'Training Officer',
		role: 'Academy instructor',
		org: 'Regional fire academy'
	}
];

export function pricingPaths(monthlyPrice: number): PricingPath[] {
	const salesMail =
		'mailto:andrew@3alarmlabs.com?subject=' + encodeURIComponent('Team access — 3AlarmLabs');
	return [
		{
			id: 'free',
			label: 'Try first',
			title: 'Free scenario',
			price: '$0',
			description: `Run one self-paced command scenario with push-to-talk radio (${freeDemoRadioLimitShort}), command board tracking, and replay review. No account required.`,
			cta: 'Try the free scenario',
			href: DEMO_HREF
		},
		{
			id: 'individual',
			label: 'Self-serve',
			title: 'Individual',
			price: `$${monthlyPrice.toFixed(2)}/mo`,
			description:
				'Unlimited self-paced command reps, weekly library scenarios, and saved replay history.',
			cta: 'Start 7-day trial',
			href: INDIVIDUAL_SIGNUP_HREF,
			highlight: true
		},
		{
			id: 'department',
			label: 'Teams',
			title: 'Department / team access',
			price: 'From $799/yr',
			description:
				'Instructor-led sessions, shared scenarios, and member access for departments, academies, and training divisions.',
			cta: 'Explore team access',
			href: '/pricing'
		},
		{
			id: 'training-company',
			label: 'Commercial',
			title: 'Training company access',
			price: 'Custom',
			description:
				'Commercial use, client-facing training rights, and annual agreements built for training businesses.',
			cta: 'Contact sales',
			href: salesMail
		}
	];
}

export const proofPoints = [
	'Ready-made fireground scenarios',
	'Radio-first command reps',
	'Replay review after every run'
] as const;

export const valueProps: ValueProp[] = [
	{
		title: 'Build the command muscle',
		description:
			'Run scenarios again and again, make assignments out loud, and practice staying organized when the picture starts changing.'
	},
	{
		title: 'Get better on the radio',
		description:
			'Work the communication side of command with radio traffic, progress updates, and assignments that need to be clear the first time.'
	},
	{
		title: 'Prepare for promotion',
		description:
			'Sharpen the stuff that shows up in acting roles, officer interviews, assessment centers, and the first few minutes of a real incident.'
	}
];

export const audienceChips = [
	'Promotional prep',
	'Acting officers',
	'Company officers',
	'Better radio traffic'
] as const;

export const howItWorks: HowItWorksStep[] = [
	{
		step: '01',
		title: 'Pick the run',
		description:
			'Start with a ready-made fireground scenario built for self-paced command practice.'
	},
	{
		step: '02',
		title: 'Work the incident',
		description:
			'Give radio traffic, assign units, track conditions, and keep the command board from turning into soup.'
	},
	{
		step: '03',
		title: 'Look it over',
		description:
			'Replay the scenario afterward with transcripts, audio, and decisions, then spot what to tighten up next time.'
	}
];

export const whyBullets = [
	'Run command scenarios when your schedule actually allows it.',
	'Practice radio traffic, assignments, size-up, and command board discipline.',
	'Review each run and come back a little sharper on the next one.'
] as const;

export const seoLinks: {
	core: SeoLink[];
	useCases: SeoLink[];
	features: SeoLink[];
	comparison: SeoLink[];
} = {
	core: [
		{ label: 'Fire Command Training Software', href: '/fire-command-training-software' },
		{ label: 'Firefighter Command Simulation', href: '/firefighter-command-simulation' },
		{ label: 'Incident Command Simulator', href: '/incident-command-simulator' },
		{ label: 'Fire Department Training Software', href: '/fire-department-training-software' },
		{
			label: 'Incident Command Training for Firefighters',
			href: '/incident-command-training-for-firefighters'
		},
		{ label: 'Self-Paced Command Training', href: '/self-paced-command-training' }
	],
	useCases: [
		{ label: 'Promotional Prep for Fire Officers', href: '/promotional-prep-fire-officers' },
		{
			label: 'Command Training for Acting Officers',
			href: '/command-training-for-acting-officers'
		},
		{ label: 'Fire Officer Training Software', href: '/fire-officer-training-software' },
		{
			label: 'Radio Communication Training for Officers',
			href: '/radio-communication-training-for-officers'
		},
		{ label: 'Practice Incident Command Online', href: '/practice-incident-command-online' }
	],
	features: [
		{ label: 'Push-to-Talk Radio Commands', href: '/push-to-talk-radio-commands' },
		{ label: 'Command Board Tracking', href: '/command-board-tracking' },
		{ label: 'After-Action Review Fire Training', href: '/after-action-review-fire-training' },
		{
			label: 'Replayable Command Training Sessions',
			href: '/replayable-command-training-sessions'
		},
		{ label: 'Self-Paced Scripted Scenarios', href: '/self-paced-scripted-scenarios' }
	],
	comparison: [
		{ label: '3AlarmLabs vs SimsUShare', href: '/3alarmlabs-vs-simsushare' },
		{ label: 'Best Fire Command Training Software', href: '/best-fire-command-training-software' },
		{
			label: 'Modern Alternative to Legacy Fire Training Software',
			href: '/modern-alternative-to-legacy-fire-training-software'
		}
	]
};
