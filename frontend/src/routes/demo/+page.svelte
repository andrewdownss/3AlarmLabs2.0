<script lang="ts">
	import { LandingFooter, LandingHeader } from '$lib/components/landing';
	import { Button } from '$lib/components/ui/button';
	import { PLANS } from '$lib/plans';
	import { defaultOgImageUrl, toCanonicalUrl, toJsonLd } from '$lib/seo';

	const monthlyPrice = PLANS.individual.monthlyPrice ?? 14.99;
	const individualSignupHref = '/signup?next=%2Fapp%2Fstart-individual';
	const pageTitle = 'Request a Fire Department Training Demo | 3AlarmLabs';
	const pageDescription =
		'Book a 30-minute 3AlarmLabs demo for your fire department and see instructor-led command sessions, self-paced scenarios, radio capture, and replay review.';
	const canonicalUrl = toCanonicalUrl('/demo');

	const demoMail =
		'mailto:sales@3alarmlabs.com?subject=' +
		encodeURIComponent('Demo request — 3AlarmLabs') +
		'&body=' +
		encodeURIComponent(
			'Name:\n' +
				'Department:\n' +
				'Role (e.g. training officer, chief, instructor):\n' +
				'Approximate number of members:\n' +
				'Time zones / times that work for a 30-minute demo:\n' +
				'Anything specific you want to see:'
		);
	const demoJsonLd = {
		'@context': 'https://schema.org',
		'@type': 'WebPage',
		name: pageTitle,
		description: pageDescription,
		url: canonicalUrl,
		mainEntity: {
			'@type': 'SoftwareApplication',
			name: '3AlarmLabs',
			applicationCategory: 'EducationalApplication',
			operatingSystem: 'Web'
		}
	};
</script>

<svelte:head>
	<title>{pageTitle}</title>
	<meta name="description" content={pageDescription} />
	<link rel="canonical" href={canonicalUrl} />
	<meta name="robots" content="index,follow" />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="3AlarmLabs" />
	<meta property="og:title" content={pageTitle} />
	<meta property="og:description" content={pageDescription} />
	<meta property="og:url" content={canonicalUrl} />
	<meta property="og:image" content={defaultOgImageUrl} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={pageTitle} />
	<meta name="twitter:description" content={pageDescription} />
	<meta name="twitter:image" content={defaultOgImageUrl} />
	{@html `<script type="application/ld+json">${toJsonLd(demoJsonLd)}</script>`}
</svelte:head>

<div class="min-h-screen bg-muted/25 text-foreground">
	<div class="mx-auto max-w-6xl px-6 sm:px-8 lg:px-10">
		<LandingHeader {monthlyPrice} />

		<main class="py-12 sm:py-16">
			<div class="mx-auto max-w-3xl">
				<header>
					<p class="text-sm font-semibold tracking-[0.18em] text-muted-foreground uppercase">
						Request a demo
					</p>
					<h1 class="mt-4 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
						See 3AlarmLabs for your department.
					</h1>
					<p class="mt-5 text-base leading-7 text-muted-foreground sm:text-lg">
						A 30-minute walkthrough covering instructor-led Command sessions, self-paced scenarios
						for every member, and how after-action review helps officers develop on-shift.
					</p>
				</header>

				<section class="mt-10 grid gap-4 sm:grid-cols-2">
					<article class="rounded-none border border-border bg-card p-6 shadow-sm">
						<h2 class="text-lg font-semibold text-foreground">What we'll cover</h2>
						<ul class="mt-3 space-y-2 text-sm text-muted-foreground">
							<li>Running a live instructor-led command session</li>
							<li>Self-paced scenarios members can run on shift</li>
							<li>Radio capture, transcripts, and replay review</li>
							<li>Shared scenarios, folders, and roles</li>
							<li>How pricing scales with department size</li>
						</ul>
					</article>

					<article class="rounded-none border border-border bg-card p-6 shadow-sm">
						<h2 class="text-lg font-semibold text-foreground">Who it's for</h2>
						<ul class="mt-3 space-y-2 text-sm text-muted-foreground">
							<li>Training officers and chiefs evaluating tools</li>
							<li>Career, combo, and volunteer departments</li>
							<li>Academies and regional training divisions</li>
							<li>Private training companies and instructors</li>
						</ul>
					</article>
				</section>

				<section
					class="mt-10 rounded-none border border-border bg-primary p-6 text-primary-foreground shadow-sm sm:p-8"
				>
					<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<div class="max-w-xl">
							<h2 class="text-2xl font-semibold tracking-tight">Email to schedule a demo</h2>
							<p class="mt-2 text-sm leading-6 text-primary-foreground/85">
								We'll reply within one business day with a scheduling link and a short intake email
								so we can tailor the walkthrough to your department.
							</p>
						</div>
						<Button
							variant="secondary"
							class="w-full shrink-0 rounded-none bg-card text-foreground hover:bg-muted sm:w-auto"
							href={demoMail}
						>
							Email sales@3alarmlabs.com
						</Button>
					</div>
				</section>

				<section class="mt-10">
					<h2 class="text-xl font-semibold tracking-tight text-foreground">
						Prefer to self-serve?
					</h2>
					<p class="mt-2 text-sm leading-6 text-muted-foreground">
						Individual firefighters and acting officers can start self-paced training for ${monthlyPrice}/month
						after a 7-day trial without a demo.
					</p>
					<div class="mt-4 flex flex-wrap gap-3">
						<Button
							class="rounded-none bg-[#E85D20] text-white hover:bg-[#D4501A]"
							href={individualSignupHref}
						>
							Start 7-day trial
						</Button>
						<Button variant="outline" class="rounded-none" href="/pricing">See pricing</Button>
					</div>
				</section>
			</div>
		</main>

		<LandingFooter />
	</div>
</div>
