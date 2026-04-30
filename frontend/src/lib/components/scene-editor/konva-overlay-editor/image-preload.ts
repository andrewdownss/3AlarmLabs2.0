const imageCache = new Map<string, Promise<HTMLImageElement>>();

export function preloadImage(url: string): Promise<HTMLImageElement> {
	if (!url) return Promise.reject(new Error('Image URL is required'));

	const cached = imageCache.get(url);
	if (cached) return cached;

	const promise = new Promise<HTMLImageElement>((resolve, reject) => {
		const image = new Image();
		image.crossOrigin = 'anonymous';
		image.decoding = 'async';
		image.onload = () => resolve(image);
		image.onerror = () => {
			imageCache.delete(url);
			reject(new Error(`Failed to preload image: ${url}`));
		};
		image.src = url;
	});

	imageCache.set(url, promise);
	return promise;
}

export function preloadImages(urls: Array<string | null | undefined>): Promise<HTMLImageElement[]> {
	const uniqueUrls = urls.filter(
		(url, index): url is string => Boolean(url) && urls.indexOf(url) === index
	);
	return Promise.all(uniqueUrls.map((url) => preloadImage(url)));
}
