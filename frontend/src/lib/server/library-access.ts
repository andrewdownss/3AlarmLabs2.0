import type { PlanConfig } from '$lib/plans';

export interface LibraryAccessUser {
	isAdmin: boolean;
	libraryAccessGranted: boolean;
	libraryEditGranted: boolean;
}

/** All signed-in users can browse and run published library sims. */
export function canViewLibrary(_user: LibraryAccessUser, _planConfig?: PlanConfig): boolean {
	return true;
}

/** Only admins and explicitly granted users can edit library sims and see drafts. */
export function canEditLibrary(user: LibraryAccessUser): boolean {
	return user.isAdmin || user.libraryEditGranted;
}

export function canManageLibraryCatalog(user: LibraryAccessUser): boolean {
	return canEditLibrary(user);
}

export function canOpenScenarioById(user: LibraryAccessUser): boolean {
	return user.isAdmin || user.libraryEditGranted;
}
