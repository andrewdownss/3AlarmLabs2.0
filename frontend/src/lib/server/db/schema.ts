import { relations } from 'drizzle-orm';
import {
	pgTable,
	text,
	timestamp,
	boolean,
	index,
	uniqueIndex,
	pgEnum,
	integer,
	jsonb
} from 'drizzle-orm/pg-core';
import type { PlanId } from '$lib/plans';
import type {
	SelfPacedConfig,
	SelfPacedScheduledEventKind,
	SimulationOutcome
} from '$lib/self-paced';

// ── Auth (Better Auth) ─────────────────────────────────────────

export const user = pgTable('user', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: boolean('email_verified').default(false).notNull(),
	image: text('image'),
	isAdmin: boolean('is_admin').default(false).notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at')
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull()
});

export const session = pgTable(
	'session',
	{
		id: text('id').primaryKey(),
		expiresAt: timestamp('expires_at').notNull(),
		token: text('token').notNull().unique(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.$onUpdate(() => new Date())
			.notNull(),
		ipAddress: text('ip_address'),
		userAgent: text('user_agent'),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' })
	},
	(table) => [index('session_userId_idx').on(table.userId)]
);

export const account = pgTable(
	'account',
	{
		id: text('id').primaryKey(),
		accountId: text('account_id').notNull(),
		providerId: text('provider_id').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		accessToken: text('access_token'),
		refreshToken: text('refresh_token'),
		idToken: text('id_token'),
		accessTokenExpiresAt: timestamp('access_token_expires_at'),
		refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
		scope: text('scope'),
		password: text('password'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [index('account_userId_idx').on(table.userId)]
);

export const verification = pgTable(
	'verification',
	{
		id: text('id').primaryKey(),
		identifier: text('identifier').notNull(),
		value: text('value').notNull(),
		expiresAt: timestamp('expires_at').notNull(),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [index('verification_identifier_idx').on(table.identifier)]
);

// ── Organizations ──────────────────────────────────────────────

export const organizations = pgTable(
	'organizations',
	{
		id: text('id').primaryKey(),
		name: text('name').notNull(),
		ownerId: text('owner_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		planId: text('plan_id').$type<PlanId>().notNull().default('free'),
		stripeCustomerId: text('stripe_customer_id'),
		stripeSubscriptionId: text('stripe_subscription_id'),
		stripeCurrentPeriodEnd: timestamp('stripe_current_period_end', {
			withTimezone: true,
			mode: 'date'
		}),
		joinCode: text('join_code').unique(),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [
		index('organizations_owner_id_idx').on(table.ownerId),
		index('organizations_join_code_idx').on(table.joinCode)
	]
);

export const organizationMembers = pgTable(
	'organization_members',
	{
		id: text('id').primaryKey(),
		organizationId: text('organization_id')
			.notNull()
			.references(() => organizations.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		role: text('role').$type<'owner' | 'member'>().notNull().default('member'),
		joinedAt: timestamp('joined_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull()
	},
	(table) => [
		index('org_members_org_id_idx').on(table.organizationId),
		index('org_members_user_id_idx').on(table.userId),
		uniqueIndex('org_members_org_user_idx').on(table.organizationId, table.userId),
		uniqueIndex('org_members_user_unique_idx').on(table.userId)
	]
);

export const organizationInvites = pgTable(
	'organization_invites',
	{
		id: text('id').primaryKey(),
		organizationId: text('organization_id')
			.notNull()
			.references(() => organizations.id, { onDelete: 'cascade' }),
		email: text('email').notNull(),
		role: text('role').$type<'member'>().notNull().default('member'),
		token: text('token').notNull().unique(),
		expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull()
	},
	(table) => [
		index('org_invites_org_id_idx').on(table.organizationId),
		index('org_invites_token_idx').on(table.token)
	]
);

// ── Folders ────────────────────────────────────────────────────

export const folders = pgTable(
	'folders',
	{
		id: text('id').primaryKey(),
		organizationId: text('organization_id')
			.notNull()
			.references(() => organizations.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		parentId: text('parent_id'),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [index('folders_org_id_idx').on(table.organizationId)]
);

// ── Scenes (SizeUp) ──────────────────────────────────────────

export const scenes = pgTable(
	'scenes',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		organizationId: text('organization_id').references(() => organizations.id, {
			onDelete: 'set null'
		}),
		folderId: text('folder_id').references(() => folders.id, { onDelete: 'set null' }),
		title: text('title').notNull().default('Untitled Scene'),
		baseImageUrl: text('base_image_url'),
		overlaysJson: jsonb('overlays_json')
			.$type<
				Array<{
					id: string;
					packId: string;
					kind: 'fire' | 'smoke';
					x: number;
					y: number;
					width: number;
					height: number;
					rotation: number;
					opacity: number;
					flipY?: boolean;
					flipX?: boolean;
					playbackSpeed: number;
				}>
			>()
			.default([]),
		captureMeta: jsonb('capture_meta').$type<{
			lat: number;
			lng: number;
			heading: number;
			pitch: number;
			fov: number;
			panoId?: string;
		}>(),
		shareToken: text('share_token').unique(),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [
		index('scenes_user_id_idx').on(table.userId),
		index('scenes_user_updated_at_idx').on(table.userId, table.updatedAt),
		index('scenes_org_id_idx').on(table.organizationId),
		index('scenes_org_folder_updated_idx').on(table.organizationId, table.folderId, table.updatedAt),
		index('scenes_share_token_idx').on(table.shareToken)
	]
);

// ── Trainer / Command ─────────────────────────────────────────

export const trainerSessionModeEnum = pgEnum('trainer_session_mode', [
	'instructor_led',
	'self_practice'
]);

export const trainerScenarios = pgTable(
	'trainer_scenarios',
	{
		id: text('id').primaryKey(),
		title: text('title').notNull(),
		description: text('description'),
		organizationId: text('organization_id').references(() => organizations.id, {
			onDelete: 'set null'
		}),
		createdBy: text('created_by')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		constructionType: text('construction_type'),
		address: text('address'),
		occupancyType: text('occupancy_type'),
		alarmLevel: text('alarm_level'),
		sideAlphaImageUrl: text('side_alpha_image_url'),
		sideBravoImageUrl: text('side_bravo_image_url'),
		sideCharlieImageUrl: text('side_charlie_image_url'),
		sideDeltaImageUrl: text('side_delta_image_url'),
		dispatchNotes: text('dispatch_notes'),
		selfPacedConfigJson: jsonb('self_paced_config_json').$type<SelfPacedConfig | null>(),
		stageMetadataJson: jsonb('stage_metadata_json')
			.$type<Record<string, unknown>>()
			.notNull()
			.default({}),
		defaultResources: jsonb('default_resources')
			.$type<Array<{ unitName: string; status: string }>>()
			.notNull()
			.default([]),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull()
	},
	(table) => [
		index('trainer_scenarios_created_by_idx').on(table.createdBy),
		index('trainer_scenarios_org_id_idx').on(table.organizationId)
	]
);

export const trainerSessions = pgTable(
	'trainer_sessions',
	{
		id: text('id').primaryKey(),
		scenarioId: text('scenario_id')
			.notNull()
			.references(() => trainerScenarios.id, { onDelete: 'cascade' }),
		mode: trainerSessionModeEnum('mode').notNull(),
		joinCode: text('join_code').unique(),
		organizationId: text('organization_id').references(() => organizations.id, {
			onDelete: 'set null'
		}),
		instructorId: text('instructor_id').references(() => user.id, { onDelete: 'set null' }),
		studentId: text('student_id').references(() => user.id, { onDelete: 'cascade' }),
		activeStage: text('active_stage').notNull().default('incipient'),
		activeSide: text('active_side').notNull().default('alpha'),
		hasStarted: boolean('has_started').notNull().default(false),
		startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
		endedAt: timestamp('ended_at', { withTimezone: true, mode: 'date' }),
		pausedAt: timestamp('paused_at', { withTimezone: true, mode: 'date' }),
		accumulatedPauseMs: integer('accumulated_pause_ms').notNull().default(0),
		simulationOutcome: text('simulation_outcome')
			.$type<SimulationOutcome>()
			.notNull()
			.default('in_progress'),
		endReason: text('end_reason')
	},
	(table) => [
		index('trainer_sessions_scenario_id_idx').on(table.scenarioId),
		index('trainer_sessions_student_id_idx').on(table.studentId),
		index('trainer_sessions_join_code_idx').on(table.joinCode)
	]
);

export const trainerSessionEvents = pgTable(
	'trainer_session_events',
	{
		id: text('id').primaryKey(),
		sessionId: text('session_id')
			.notNull()
			.references(() => trainerSessions.id, { onDelete: 'cascade' }),
		eventType: text('event_type').notNull(),
		timestamp: timestamp('timestamp', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
		payloadJson: jsonb('payload_json').$type<Record<string, unknown>>().notNull().default({})
	},
	(table) => [index('trainer_session_events_session_id_idx').on(table.sessionId)]
);

export const trainerRadioMessages = pgTable(
	'trainer_radio_messages',
	{
		id: text('id').primaryKey(),
		sessionId: text('session_id')
			.notNull()
			.references(() => trainerSessions.id, { onDelete: 'cascade' }),
		audioUrl: text('audio_url').notNull(),
		transcript: text('transcript'),
		parsedCommandJson: jsonb('parsed_command_json').$type<Record<string, unknown>>(),
		instructorCorrectionJson: jsonb('instructor_correction_json').$type<Record<string, unknown>>(),
		speakerRole: text('speaker_role').notNull().default('student'),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull()
	},
	(table) => [index('trainer_radio_messages_session_id_idx').on(table.sessionId)]
);

export const trainerCommandBoardEntries = pgTable(
	'trainer_command_board_entries',
	{
		id: text('id').primaryKey(),
		sessionId: text('session_id')
			.notNull()
			.references(() => trainerSessions.id, { onDelete: 'cascade' }),
		division: text('division').notNull().default('Unassigned'),
		unitName: text('unit_name').notNull(),
		assignment: text('assignment'),
		location: text('location'),
		status: text('status').notNull().default('Assigned'),
		lastUpdatedAt: timestamp('last_updated_at', { withTimezone: true, mode: 'date' })
			.defaultNow()
			.notNull()
	},
	(table) => [index('trainer_command_board_entries_session_id_idx').on(table.sessionId)]
);

export const trainerScheduledEvents = pgTable(
	'trainer_scheduled_events',
	{
		id: text('id').primaryKey(),
		sessionId: text('session_id')
			.notNull()
			.references(() => trainerSessions.id, { onDelete: 'cascade' }),
		kind: text('kind').$type<SelfPacedScheduledEventKind>().notNull(),
		ruleId: text('rule_id'),
		fireAt: timestamp('fire_at', { withTimezone: true, mode: 'date' }).notNull(),
		firedAt: timestamp('fired_at', { withTimezone: true, mode: 'date' }),
		payloadJson: jsonb('payload_json').$type<Record<string, unknown>>().notNull().default({}),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull()
	},
	(table) => [
		index('trainer_scheduled_events_session_id_idx').on(table.sessionId),
		index('trainer_scheduled_events_due_idx').on(table.firedAt, table.fireAt)
	]
);

// ── Relations ─────────────────────────────────────────────────

export const userRelations = relations(user, ({ many }) => ({
	sessions: many(session),
	accounts: many(account),
	ownedOrganizations: many(organizations),
	organizationMemberships: many(organizationMembers),
	scenes: many(scenes)
}));

export const sessionRelations = relations(session, ({ one }) => ({
	user: one(user, { fields: [session.userId], references: [user.id] })
}));

export const accountRelations = relations(account, ({ one }) => ({
	user: one(user, { fields: [account.userId], references: [user.id] })
}));

export const organizationsRelations = relations(organizations, ({ one, many }) => ({
	owner: one(user, { fields: [organizations.ownerId], references: [user.id] }),
	members: many(organizationMembers),
	invites: many(organizationInvites),
	scenes: many(scenes),
	folders: many(folders)
}));

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
	organization: one(organizations, {
		fields: [organizationMembers.organizationId],
		references: [organizations.id]
	}),
	user: one(user, { fields: [organizationMembers.userId], references: [user.id] })
}));

export const organizationInvitesRelations = relations(organizationInvites, ({ one }) => ({
	organization: one(organizations, {
		fields: [organizationInvites.organizationId],
		references: [organizations.id]
	})
}));

export const foldersRelations = relations(folders, ({ one, many }) => ({
	organization: one(organizations, {
		fields: [folders.organizationId],
		references: [organizations.id]
	}),
	parent: one(folders, { fields: [folders.parentId], references: [folders.id] }),
	scenes: many(scenes)
}));

export const scenesRelations = relations(scenes, ({ one }) => ({
	user: one(user, { fields: [scenes.userId], references: [user.id] }),
	organization: one(organizations, {
		fields: [scenes.organizationId],
		references: [organizations.id]
	}),
	folder: one(folders, { fields: [scenes.folderId], references: [folders.id] })
}));

export const trainerScenariosRelations = relations(trainerScenarios, ({ one, many }) => ({
	creator: one(user, { fields: [trainerScenarios.createdBy], references: [user.id] }),
	organization: one(organizations, {
		fields: [trainerScenarios.organizationId],
		references: [organizations.id]
	}),
	sessions: many(trainerSessions)
}));

export const trainerSessionsRelations = relations(trainerSessions, ({ one, many }) => ({
	scenario: one(trainerScenarios, {
		fields: [trainerSessions.scenarioId],
		references: [trainerScenarios.id]
	}),
	organization: one(organizations, {
		fields: [trainerSessions.organizationId],
		references: [organizations.id]
	}),
	instructor: one(user, { fields: [trainerSessions.instructorId], references: [user.id] }),
	events: many(trainerSessionEvents),
	radioMessages: many(trainerRadioMessages),
	commandBoardEntries: many(trainerCommandBoardEntries)
}));

export const trainerSessionEventsRelations = relations(trainerSessionEvents, ({ one }) => ({
	session: one(trainerSessions, {
		fields: [trainerSessionEvents.sessionId],
		references: [trainerSessions.id]
	})
}));

export const trainerRadioMessagesRelations = relations(trainerRadioMessages, ({ one }) => ({
	session: one(trainerSessions, {
		fields: [trainerRadioMessages.sessionId],
		references: [trainerSessions.id]
	})
}));

export const trainerCommandBoardEntriesRelations = relations(
	trainerCommandBoardEntries,
	({ one }) => ({
		session: one(trainerSessions, {
			fields: [trainerCommandBoardEntries.sessionId],
			references: [trainerSessions.id]
		})
	})
);
