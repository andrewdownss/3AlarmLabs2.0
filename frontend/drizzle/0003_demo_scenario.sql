ALTER TABLE "trainer_scenarios"
ADD COLUMN "is_demo_scenario" boolean DEFAULT false NOT NULL;

CREATE UNIQUE INDEX "trainer_scenarios_single_demo_idx"
ON "trainer_scenarios" ("is_demo_scenario")
WHERE "is_demo_scenario" = true;
