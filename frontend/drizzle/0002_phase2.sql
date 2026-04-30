-- Phase 2 best-effort backfill for self-practice review access.
-- This uses each student's current organization membership, not historical membership.
-- If a firefighter changed organizations after running a simulation, this may tag
-- the session to their current organization.
UPDATE "trainer_sessions" AS s
SET "organization_id" = (
	SELECT m."organization_id"
	FROM "organization_members" AS m
	WHERE m."user_id" = s."student_id"
	ORDER BY m."joined_at" DESC
	LIMIT 1
)
WHERE s."organization_id" IS NULL
	AND s."student_id" IS NOT NULL
	AND EXISTS (
		SELECT 1
		FROM "organization_members" AS m
		WHERE m."user_id" = s."student_id"
	);
