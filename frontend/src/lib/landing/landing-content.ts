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

export const proofPoints = [
	'Pre-authored scenarios',
	'Radio-based reps',
	'Replay after every run'
] as const;

export const valueProps: ValueProp[] = [
	{
		title: 'Build command confidence',
		description:
			'Get repeatable reps running scenarios, making assignments, and staying organized under pressure.'
	},
	{
		title: 'Practice realistic radio communication',
		description:
			'Train the communication side of command with radio traffic, updates, and assignments.'
	},
	{
		title: 'Prepare for promotion',
		description:
			'Sharpen the skills that matter before officer roles, acting positions, or promotional exams.'
	}
];

export const audienceChips = [
	'Promotional prep',
	'Acting officers',
	'Company officers',
	'Command confidence'
] as const;

export const howItWorks: HowItWorksStep[] = [
	{
		step: '01',
		title: 'Choose a scenario',
		description: 'Start a pre-authored command scenario built for self-paced reps.'
	},
	{
		step: '02',
		title: 'Work the incident',
		description: 'Give radio traffic, assign units, and keep the command board organized.'
	},
	{
		step: '03',
		title: 'Review the run',
		description: 'Replay the scenario and review transcripts, audio, and decisions afterward.'
	}
];

export const whyBullets = [
	'Run self-paced command scenarios on your own schedule.',
	'Practice radio traffic, assignments, and command board discipline.',
	'Review each run and come back sharper on the next one.'
] as const;

export const seoLinks: {
	core: SeoLink[];
	useCases: SeoLink[];
	features: SeoLink[];
	comparison: SeoLink[];
} = {
	core: [
		{ label: 'Fire Command Training Software', href: '/fire-command-training-software' },
		{ label: 'Promotional Prep for Fire Officers', href: '/promotional-prep-fire-officers' },
		{ label: 'Self-Paced Command Training', href: '/self-paced-command-training' },
		{
			label: 'Incident Command Training for Firefighters',
			href: '/incident-command-training-for-firefighters'
		}
	],
	useCases: [
		{
			label: 'Command Training for Acting Officers',
			href: '/command-training-for-acting-officers'
		},
		{
			label: 'Radio Communication Training for Officers',
			href: '/radio-communication-training-for-officers'
		},
		{
			label: 'After-Action Review for Command Training',
			href: '/after-action-review-for-command-training'
		},
		{ label: 'Practice Incident Command Online', href: '/practice-incident-command-online' }
	],
	features: [
		{ label: 'Push-to-Talk Radio Commands', href: '/push-to-talk-radio-commands' },
		{ label: 'Command Board Tracking', href: '/command-board-tracking' },
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
