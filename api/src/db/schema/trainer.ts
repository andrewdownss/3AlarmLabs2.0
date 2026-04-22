import { pgTable, text, timestamp, jsonb, index, pgEnum, boolean, integer } from 'drizzle-orm/pg-core';
import type {
	SelfPacedConfig,
	SelfPacedScheduledEventKind,
	SimulationOutcome
} from '../../lib/self-paced.js';

export const trainerSessionModeEnum = pgEnum('trainer_session_mode', [
	'instructor_led',
	'self_practice'
]);

export const organizations = pgTable('organizations', {
	id: text('id').primaryKey(),
	planId: text('plan_id').notNull().default('free')
});

export const trainerScenarios = pgTable(
	'trainer_scenarios',
	{
		id: text('id').primaryKey(),
		title: text('title').notNull(),
		description: text('description'),
		createdBy: text('created_by').notNull(),
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
		organizationId: text('organization_id').references(() => organizations.id, {
			onDelete: 'set null'
		}),
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
		instructorId: text('instructor_id'),
		studentId: text('student_id'),
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

export const session = pgTable('session', {
	id: text('id').primaryKey(),
	token: text('token').notNull(),
	userId: text('user_id').notNull(),
	expiresAt: timestamp('expires_at').notNull()
});
