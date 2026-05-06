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
	import {
		LandingHeader,
		LandingHero,
		LandingValueProps,
		LandingBuiltFor,
		LandingHowItWorks,
		LandingReviewSection,
		LandingDepartments,
		LandingClosingCta,
		LandingFooter
	} from '$lib/components/landing';

	const monthlyPrice = PLANS.individual.monthlyPrice ?? 14.99;
	const canonicalUrl = toCanonicalUrl('/');
	const faqItems = [
		{
			question: 'What is fire command training software?',
			answer:
				'Fire command training software helps firefighters and officers practice incident size-up, radio communication, assignments, command tracking, and after-action review through repeatable scenarios.'
		},
		{
			question: 'Can firefighters practice command scenarios alone?',
			answer:
				'Yes. 3AlarmLabs supports self-paced command scenarios so firefighters can build reps on shift, at home, or while preparing for promotion.'
		},
		{
			question: 'Does 3AlarmLabs support department training?',
			answer:
				'Yes. Individual firefighters can train on their own, and department plans support instructor-led sessions, shared scenarios, and team access.'
		},
		{
			question: 'How does replay review work?',
			answer:
				'After each run, firefighters can review the scenario, radio traffic, transcript, and decisions so they can identify what worked and what to improve next time.'
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
			<LandingValueProps />
			<LandingBuiltFor />
			<LandingHowItWorks />
			<LandingReviewSection />
			<LandingDepartments />
			<section class="py-16" aria-labelledby="homepage-faq-heading">
				<div class="mx-auto max-w-3xl">
					<p class="text-sm font-semibold tracking-[0.18em] text-muted-foreground uppercase">FAQ</p>
					<h2 id="homepage-faq-heading" class="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
						Fire command training questions
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
