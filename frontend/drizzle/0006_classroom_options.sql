ALTER TABLE "classrooms" ADD COLUMN IF NOT EXISTS "use_self_paced_script" boolean DEFAULT true NOT NULL;
ALTER TABLE "classrooms" ADD COLUMN IF NOT EXISTS "board_label_mode" text DEFAULT 'division_group' NOT NULL;

