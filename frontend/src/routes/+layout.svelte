<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();

	const geistStylesheetHref =
		'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap';

	function revealFontStylesheet(event: Event) {
		const el = event.currentTarget;
		if (el instanceof HTMLLinkElement) el.media = 'all';
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<!-- Avoid render-blocking: load font CSS as print then promote to all once fetched (Lighthouse). -->
	<link
		rel="stylesheet"
		href={geistStylesheetHref}
		media="print"
		onload={revealFontStylesheet}
	/>
	<noscript>
		<link rel="stylesheet" href={geistStylesheetHref} />
	</noscript>
</svelte:head>
{@render children()}
