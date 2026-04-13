import { ourFileRouter } from '$lib/server/uploadthing';
import { createRouteHandler } from 'uploadthing/server';
import { env } from '$env/dynamic/private';

const handler = createRouteHandler({
	router: ourFileRouter,
	config: { token: env.UPLOADTHING_TOKEN }
});

export const GET = handler;
export const POST = handler;
