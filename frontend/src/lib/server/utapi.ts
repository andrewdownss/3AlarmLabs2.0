import { env } from '$env/dynamic/private';
import { UTApi } from 'uploadthing/server';

/** UploadThing SDK reads `process.env` by default; SvelteKit only injects `.env` into `$env/*`. */
export function getUtApi(): UTApi {
	return new UTApi({ token: env.UPLOADTHING_TOKEN });
}
