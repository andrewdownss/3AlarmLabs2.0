export const ORG_MEMBER_ROLES = ['owner', 'instructor', 'member'] as const;

export type OrgMemberRole = (typeof ORG_MEMBER_ROLES)[number];

export const ORG_MEMBER_ROLE_LABELS: Record<OrgMemberRole, string> = {
	owner: 'Owner',
	instructor: 'Instructor',
	member: 'Member'
};

export function isOrgMemberRole(value: string): value is OrgMemberRole {
	return (ORG_MEMBER_ROLES as readonly string[]).includes(value);
}

export function orgMemberRoleBadgeVariant(
	role: OrgMemberRole
): 'default' | 'secondary' | 'outline' {
	if (role === 'owner') return 'default';
	if (role === 'instructor') return 'secondary';
	return 'outline';
}
