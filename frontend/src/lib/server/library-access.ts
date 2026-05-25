import type { PlanConfig } from '$lib/plans';

export interface LibraryAccessUser {
	isAdmin: boolean;
	libraryAccessGranted: boolean;
	libraryEditGranted: boolean;
}

export function canViewLibrary(user: LibraryAccessUser, planConfig: PlanConfig): boolean {
	return (
		planConfig.canAccessLibrary ||
		user.libraryAccessGranted ||
		user.libraryEditGranted ||
		user.isAdmin
	);
}

export function canEditLibrary(user: LibraryAccessUser): boolean {
	return user.isAdmin || user.libraryEditGranted;
}

export function canManageLibraryCatalog(user: LibraryAccessUser): boolean {
	return canEditLibrary(user);
}

export function canOpenScenarioById(user: LibraryAccessUser): boolean {
	return user.isAdmin || user.libraryEditGranted;
}
