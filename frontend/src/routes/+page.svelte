<script lang="ts">
	import { PLANS } from '$lib/plans';
	import {
		defaultOgImageUrl,
		defaultSeoDescription,
		defaultSeoTitle,
		faqJsonLd,
		organizationJsonLd,
		softwareApplicationJsonLd,
		toCanonicalUrl,
		toJsonLd,
		websiteJsonLd
	} from '$lib/seo';
	import { freeDemoRadioLimitShort } from '$lib/landing/landing-content';
	import {
		LandingHeader,
		LandingHero,
		LandingFreeScenario,
		LandingBuiltFor,
		LandingBuiltWith,
		LandingTestimonials,
		LandingPricingPaths,
		LandingClosingCta,
		LandingFooter
	} from '$lib/components/landing';

	const monthlyPrice = PLANS.individual.monthlyPrice ?? 14.99;
	const canonicalUrl = toCanonicalUrl('/');
	const faqItems = [
		{
			question: 'Can I try 3AlarmLabs before paying?',
			answer: `Yes. You can run a free self-paced command scenario without creating an account. Push-to-talk radio is included (${freeDemoRadioLimitShort}). Create an account to save your replay and unlock unlimited radio.`
		},
		{
			question: 'Can firefighters practice command scenarios alone?',
			answer:
				'Yes. 3AlarmLabs is built for solo command practice, so firefighters can get reps on shift, at home, or while getting ready for promotion.'
		},
		{
			question: 'Does 3AlarmLabs support department training?',
			answer:
				'Yes. Individual members can train on their own, while department plans add instructor-led sessions, shared scenarios, and team access.'
		},
		{
			question: 'How does replay review work?',
			answer:
				'After each run, you can review the scenario, radio traffic, transcript, and decisions. It makes the awkward stuff easier to spot, which is the point.'
		}
	];
	const homepageJsonLd = [
		organizationJsonLd,
		websiteJsonLd,
		softwareApplicationJsonLd(monthlyPrice),
		faqJsonLd(faqItems)
	];
</script>

<svelte:head>
	<title>{defaultSeoTitle}</title>
	<meta name="description" content={defaultSeoDescription} />
	<link rel="canonical" href={canonicalUrl} />
	<meta name="robots" content="index,follow" />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="3AlarmLabs" />
	<meta property="og:title" content={defaultSeoTitle} />
	<meta property="og:description" content={defaultSeoDescription} />
	<meta property="og:url" content={canonicalUrl} />
	<meta property="og:image" content={defaultOgImageUrl} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={defaultSeoTitle} />
	<meta name="twitter:description" content={defaultSeoDescription} />
	<meta name="twitter:image" content={defaultOgImageUrl} />
	{@html `<script type="application/ld+json">${toJsonLd(homepageJsonLd)}</script>`}
</svelte:head>

<div class="min-h-screen bg-muted/25 text-foreground">
	<div class="mx-auto max-w-6xl px-6 sm:px-8 lg:px-10">
		<LandingHeader {monthlyPrice} />

		<main>
			<LandingHero {monthlyPrice} />
			<LandingFreeScenario />
			<LandingBuiltFor />
			<LandingBuiltWith />
			<LandingTestimonials />
			<LandingPricingPaths {monthlyPrice} />
			<section class="py-16" aria-labelledby="homepage-faq-heading">
				<div class="mx-auto max-w-3xl">
					<p class="text-sm font-semibold tracking-[0.18em] text-muted-foreground uppercase">FAQ</p>
					<h2
						id="homepage-faq-heading"
						class="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
					>
						Questions firefighters usually ask first
					</h2>
					<div class="mt-8 space-y-4">
						{#each faqItems as item (item.question)}
							<article class="rounded-none border border-border bg-card p-6 shadow-sm">
								<h3 class="text-lg font-semibold text-foreground">{item.question}</h3>
								<p class="mt-3 text-sm leading-6 text-muted-foreground">{item.answer}</p>
							</article>
						{/each}
					</div>
				</div>
			</section>
			<LandingClosingCta {monthlyPrice} />
		</main>

		<LandingFooter />
	</div>
</div>
