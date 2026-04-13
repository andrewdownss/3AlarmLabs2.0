declare global {
	namespace App {
		interface Locals {
			user: {
				id: string;
				name: string;
				email: string;
				emailVerified: boolean;
				image: string | null;
				isAdmin: boolean;
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
