ALTER TABLE "organization_members"
ADD CONSTRAINT "org_members_role_check"
CHECK ("role" IN ('owner', 'instructor', 'member'));
