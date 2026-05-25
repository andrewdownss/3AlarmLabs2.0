declare global {
	interface Window {
		gtag?: (...args: unknown[]) => void;
	}

	namespace App {
		interface Locals {
			user: {
				id: string;
				name: string;
				email: string;
				emailVerified: boolean;
				image: string | null;
				isAdmin: boolean;
				libraryAccessGranted: boolean;
				libraryEditGranted: boolean;
				createdAt: Date;
				updatedAt: Date;
			} | null;
			session: {
				id: string;
				token: string;
				userId: string;
				expiresAt: Date;
			} | null;
		}
	}
}

export {};
