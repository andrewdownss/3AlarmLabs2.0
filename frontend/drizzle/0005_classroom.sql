ALTER TYPE "trainer_session_mode" ADD VALUE IF NOT EXISTS 'classroom';

CREATE TABLE IF NOT EXISTS "classrooms" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text,
	"instructor_id" text,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"max_seats" integer DEFAULT 100 NOT NULL,
	"active_session_id" text,
	"called_on_participant_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	CONSTRAINT "classrooms_code_unique" UNIQUE("code")
);

CREATE TABLE IF NOT EXISTS "classroom_participants" (
	"id" text PRIMARY KEY NOT NULL,
	"classroom_id" text NOT NULL,
	"display_name" text NOT NULL,
	"user_id" text,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"kicked_at" timestamp with time zone
);

ALTER TABLE "trainer_sessions" ADD COLUMN IF NOT EXISTS "classroom_id" text;
ALTER TABLE "trainer_sessions" ADD COLUMN IF NOT EXISTS "review_visible" boolean DEFAULT true NOT NULL;

DO $$ BEGIN
	ALTER TABLE "classrooms" ADD CONSTRAINT "classrooms_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
	ALTER TABLE "classrooms" ADD CONSTRAINT "classrooms_instructor_id_user_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "user"("id") ON DELETE SET NULL;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
	ALTER TABLE "classrooms" ADD CONSTRAINT "classrooms_active_session_id_trainer_sessions_id_fk" FOREIGN KEY ("active_session_id") REFERENCES "trainer_sessions"("id") ON DELETE SET NULL;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
	ALTER TABLE "classrooms" ADD CONSTRAINT "classrooms_called_on_participant_id_classroom_participants_id_fk" FOREIGN KEY ("called_on_participant_id") REFERENCES "classroom_participants"("id") ON DELETE SET NULL;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
	ALTER TABLE "classroom_participants" ADD CONSTRAINT "classroom_participants_classroom_id_classrooms_id_fk" FOREIGN KEY ("classroom_id") REFERENCES "classrooms"("id") ON DELETE CASCADE;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
	ALTER TABLE "classroom_participants" ADD CONSTRAINT "classroom_participants_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
	ALTER TABLE "trainer_sessions" ADD CONSTRAINT "trainer_sessions_classroom_id_classrooms_id_fk" FOREIGN KEY ("classroom_id") REFERENCES "classrooms"("id") ON DELETE SET NULL;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "classrooms_code_idx" ON "classrooms" USING btree ("code");
CREATE INDEX IF NOT EXISTS "classrooms_org_id_idx" ON "classrooms" USING btree ("organization_id");
CREATE INDEX IF NOT EXISTS "classrooms_instructor_id_idx" ON "classrooms" USING btree ("instructor_id");
CREATE INDEX IF NOT EXISTS "classroom_participants_classroom_idx" ON "classroom_participants" USING btree ("classroom_id");
CREATE INDEX IF NOT EXISTS "classroom_participants_presence_idx" ON "classroom_participants" USING btree ("classroom_id","last_seen_at");
CREATE INDEX IF NOT EXISTS "trainer_sessions_classroom_id_idx" ON "trainer_sessions" USING btree ("classroom_id");
