import { createUploadthing, type FileRouter } from 'uploadthing/server';
import { auth } from '$lib/auth';

const f = createUploadthing();

export const ourFileRouter = {
	sceneAssets: f({
		image: { maxFileSize: '8MB', maxFileCount: 1 }
	})
		.middleware(async ({ req }) => {
			const session = await auth.api.getSession({ headers: req.headers });
			if (!session?.user) throw new Error('Unauthorized');
			return { userId: session.user.id };
		})
		.onUploadComplete(({ file }) => {
			return { url: file.ufsUrl };
		})
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
