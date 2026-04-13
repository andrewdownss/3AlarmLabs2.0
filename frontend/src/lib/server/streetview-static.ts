import { env } from '$env/dynamic/public';

export async function fetchStreetViewStatic(
	panoId: string,
	heading: number,
	pitch: number,
	fov: number,
	size: string = '640x640'
): Promise<ArrayBuffer | null> {
	const key = env.PUBLIC_GOOGLE_MAPS_API_KEY;
	if (!key) return null;

	const url = new URL('https://maps.googleapis.com/maps/api/streetview');
	url.searchParams.set('size', size);
	url.searchParams.set('pano', panoId);
	url.searchParams.set('heading', String(heading));
	url.searchParams.set('pitch', String(pitch));
	url.searchParams.set('fov', String(fov));
	url.searchParams.set('key', key);

	const res = await fetch(url.toString());
	if (!res.ok) return null;
	const contentType = res.headers.get('content-type') ?? '';
	if (!contentType.includes('image')) return null;
	return res.arrayBuffer();
}
