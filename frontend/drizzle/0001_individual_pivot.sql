ALTER TABLE "organizations"
	ADD COLUMN IF NOT EXISTS "is_personal" boolean DEFAULT false NOT NULL;

ALTER TABLE "organizations"
	ALTER COLUMN "plan_id" SET DEFAULT 'expired';

ALTER TABLE "trainer_scenarios"
	ADD COLUMN IF NOT EXISTS "is_library" boolean DEFAULT false NOT NULL;

ALTER TABLE "trainer_scenarios"
	ADD COLUMN IF NOT EXISTS "published_at" timestamp with time zone;

CREATE INDEX IF NOT EXISTS "trainer_scenarios_library_published_idx"
	ON "trainer_scenarios" ("is_library", "published_at");

UPDATE "organizations"
SET "plan_id" = 'expired'
WHERE "plan_id" = 'free'
	AND "stripe_subscription_id" IS NULL;
