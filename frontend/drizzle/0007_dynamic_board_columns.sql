ALTER TABLE "trainer_sessions"
ADD COLUMN IF NOT EXISTS "board_columns_json" jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE "trainer_command_board_entries"
ADD COLUMN IF NOT EXISTS "slot_index" integer;
