import { pgTable, text, timestamp, jsonb, index, uniqueIndex, pgEnum, boolean, integer, } from "drizzle-orm/pg-core";
export const trainerSessionModeEnum = pgEnum("trainer_session_mode", [
    "instructor_led",
    "self_practice",
    "classroom",
]);
export const organizations = pgTable("organizations", {
    id: text("id").primaryKey(),
    planId: text("plan_id").notNull().default("expired"),
    isPersonal: boolean("is_personal").default(false).notNull(),
});
export const organizationMembers = pgTable("organization_members", {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
        .notNull()
        .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    role: text("role").notNull().default("member"),
    joinedAt: timestamp("joined_at", { withTimezone: true, mode: "date" })
        .defaultNow()
        .notNull(),
}, (table) => [
    index("api_org_members_org_id_idx").on(table.organizationId),
    index("api_org_members_user_id_idx").on(table.userId),
]);
export const trainerScenarios = pgTable("trainer_scenarios", {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    createdBy: text("created_by").notNull(),
    constructionType: text("construction_type"),
    address: text("address"),
    occupancyType: text("occupancy_type"),
    alarmLevel: text("alarm_level"),
    sideAlphaImageUrl: text("side_alpha_image_url"),
    sideBravoImageUrl: text("side_bravo_image_url"),
    sideCharlieImageUrl: text("side_charlie_image_url"),
    sideDeltaImageUrl: text("side_delta_image_url"),
    dispatchNotes: text("dispatch_notes"),
    selfPacedConfigJson: jsonb("self_paced_config_json").$type(),
    stageMetadataJson: jsonb("stage_metadata_json")
        .$type()
        .notNull()
        .default({}),
    defaultResources: jsonb("default_resources")
        .$type()
        .notNull()
        .default([]),
    isLibrary: boolean("is_library").default(false).notNull(),
    publishedAt: timestamp("published_at", {
        withTimezone: true,
        mode: "date",
    }),
    organizationId: text("organization_id").references(() => organizations.id, {
        onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
        .defaultNow()
        .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
        .defaultNow()
        .$onUpdate(() => new Date())
        .notNull(),
}, (table) => [
    index("trainer_scenarios_created_by_idx").on(table.createdBy),
    index("trainer_scenarios_org_id_idx").on(table.organizationId),
    index("trainer_scenarios_library_published_idx").on(table.isLibrary, table.publishedAt),
]);
export const classrooms = pgTable("classrooms", {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").references(() => organizations.id, {
        onDelete: "set null",
    }),
    instructorId: text("instructor_id"),
    name: text("name").notNull(),
    code: text("code").notNull().unique(),
    maxSeats: integer("max_seats").notNull().default(100),
    useSelfPacedScript: boolean("use_self_paced_script")
        .notNull()
        .default(true),
    boardLabelMode: text("board_label_mode")
        .$type()
        .notNull()
        .default("division_group"),
    activeSessionId: text("active_session_id"),
    calledOnParticipantId: text("called_on_participant_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
        .defaultNow()
        .notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true, mode: "date" }),
}, (table) => [
    index("classrooms_org_id_idx").on(table.organizationId),
    index("classrooms_instructor_id_idx").on(table.instructorId),
    uniqueIndex("classrooms_code_idx").on(table.code),
]);
export const classroomParticipants = pgTable("classroom_participants", {
    id: text("id").primaryKey(),
    classroomId: text("classroom_id")
        .notNull()
        .references(() => classrooms.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    userId: text("user_id"),
    joinedAt: timestamp("joined_at", { withTimezone: true, mode: "date" })
        .defaultNow()
        .notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true, mode: "date" })
        .defaultNow()
        .notNull(),
    kickedAt: timestamp("kicked_at", { withTimezone: true, mode: "date" }),
}, (table) => [
    index("classroom_participants_classroom_idx").on(table.classroomId),
    index("classroom_participants_presence_idx").on(table.classroomId, table.lastSeenAt),
]);
export const trainerSessions = pgTable("trainer_sessions", {
    id: text("id").primaryKey(),
    scenarioId: text("scenario_id")
        .notNull()
        .references(() => trainerScenarios.id, { onDelete: "cascade" }),
    mode: trainerSessionModeEnum("mode").notNull(),
    joinCode: text("join_code").unique(),
    organizationId: text("organization_id").references(() => organizations.id, {
        onDelete: "set null",
    }),
    classroomId: text("classroom_id").references(() => classrooms.id, {
        onDelete: "set null",
    }),
    instructorId: text("instructor_id"),
    studentId: text("student_id"),
    activeStage: text("active_stage").notNull().default("incipient"),
    activeSide: text("active_side").notNull().default("alpha"),
    hasStarted: boolean("has_started").notNull().default(false),
    reviewVisible: boolean("review_visible").notNull().default(true),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" })
        .defaultNow()
        .notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true, mode: "date" }),
    pausedAt: timestamp("paused_at", { withTimezone: true, mode: "date" }),
    accumulatedPauseMs: integer("accumulated_pause_ms").notNull().default(0),
    boardColumnsJson: jsonb("board_columns_json")
        .$type()
        .notNull()
        .default([]),
    simulationOutcome: text("simulation_outcome")
        .$type()
        .notNull()
        .default("in_progress"),
    endReason: text("end_reason"),
}, (table) => [
    index("trainer_sessions_scenario_id_idx").on(table.scenarioId),
    index("trainer_sessions_student_id_idx").on(table.studentId),
    index("trainer_sessions_join_code_idx").on(table.joinCode),
]);
export const trainerSessionEvents = pgTable("trainer_session_events", {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
        .notNull()
        .references(() => trainerSessions.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true, mode: "date" })
        .defaultNow()
        .notNull(),
    payloadJson: jsonb("payload_json")
        .$type()
        .notNull()
        .default({}),
}, (table) => [
    index("trainer_session_events_session_id_idx").on(table.sessionId),
]);
export const trainerRadioMessages = pgTable("trainer_radio_messages", {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
        .notNull()
        .references(() => trainerSessions.id, { onDelete: "cascade" }),
    audioUrl: text("audio_url").notNull(),
    transcript: text("transcript"),
    parsedCommandJson: jsonb("parsed_command_json").$type(),
    instructorCorrectionJson: jsonb("instructor_correction_json").$type(),
    speakerRole: text("speaker_role").notNull().default("student"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
        .defaultNow()
        .notNull(),
}, (table) => [
    index("trainer_radio_messages_session_id_idx").on(table.sessionId),
]);
export const trainerCommandBoardEntries = pgTable("trainer_command_board_entries", {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
        .notNull()
        .references(() => trainerSessions.id, { onDelete: "cascade" }),
    slotIndex: integer("slot_index"),
    division: text("division").notNull().default("Unassigned"),
    unitName: text("unit_name").notNull(),
    assignment: text("assignment"),
    location: text("location"),
    status: text("status").notNull().default("Assigned"),
    lastUpdatedAt: timestamp("last_updated_at", {
        withTimezone: true,
        mode: "date",
    })
        .defaultNow()
        .notNull(),
}, (table) => [
    index("trainer_command_board_entries_session_id_idx").on(table.sessionId),
]);
export const trainerScheduledEvents = pgTable("trainer_scheduled_events", {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
        .notNull()
        .references(() => trainerSessions.id, { onDelete: "cascade" }),
    kind: text("kind").$type().notNull(),
    ruleId: text("rule_id"),
    fireAt: timestamp("fire_at", {
        withTimezone: true,
        mode: "date",
    }).notNull(),
    firedAt: timestamp("fired_at", { withTimezone: true, mode: "date" }),
    payloadJson: jsonb("payload_json")
        .$type()
        .notNull()
        .default({}),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
        .defaultNow()
        .notNull(),
}, (table) => [
    index("trainer_scheduled_events_session_id_idx").on(table.sessionId),
    index("trainer_scheduled_events_due_idx").on(table.firedAt, table.fireAt),
]);
export const session = pgTable("session", {
    id: text("id").primaryKey(),
    token: text("token").notNull(),
    userId: text("user_id").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
});
//# sourceMappingURL=trainer.js.map