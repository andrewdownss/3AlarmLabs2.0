<script lang="ts">
	import MarketingTemplate from '$lib/components/marketing/marketing-template.svelte';
	import favicon from '$lib/assets/favicon.svg';

	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.title}</title>
	<meta name="description" content={data.description} />
	{#if data.keywords?.length}
		<meta name="keywords" content={data.keywords.join(', ')} />
	{/if}

	<link rel="canonical" href={data.canonicalUrl} />

	<meta name="robots" content="index,follow" />

	<!-- Open Graph -->
	<meta property="og:type" content="website" />
	<meta property="og:title" content={data.title} />
	<meta property="og:description" content={data.description} />
	<meta property="og:url" content={data.canonicalUrl} />
	<meta property="og:image" content={favicon} />

	<!-- Twitter -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={data.title} />
	<meta name="twitter:description" content={data.description} />
	<meta name="twitter:image" content={favicon} />
</svelte:head>

<MarketingTemplate
	monthlyPrice={data.monthlyPrice}
	heroEyebrow={data.heroEyebrow}
	heroTitle={data.heroTitle}
	heroDescription={data.heroDescription}
	bodyHtml={data.bodyHtml}
/>

