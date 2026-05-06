<script lang="ts">
	import { LandingFooter, LandingHeader } from '$lib/components/landing';
	import { Button } from '$lib/components/ui/button';
	import { PLANS } from '$lib/plans';
	import { defaultOgImageUrl, organizationJsonLd, toCanonicalUrl, toJsonLd } from '$lib/seo';

	const monthlyPrice = PLANS.individual.monthlyPrice ?? 14.99;
	const pageTitle = 'Contact 3AlarmLabs | Fire Command Training Support and Sales';
	const pageDescription =
		'Contact 3AlarmLabs for fire command training software sales, support, privacy questions, department demos, and billing help.';
	const canonicalUrl = toCanonicalUrl('/contact');

	const supportMail =
		'mailto:support@3alarmlabs.com?subject=' + encodeURIComponent('Support — 3AlarmLabs');
	const salesMail =
		'mailto:sales@3alarmlabs.com?subject=' + encodeURIComponent('Sales inquiry — 3AlarmLabs');
	const privacyMail =
		'mailto:privacy@3alarmlabs.com?subject=' + encodeURIComponent('Privacy inquiry — 3AlarmLabs');
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
	{@html `<script type="application/ld+json">${toJsonLd(organizationJsonLd)}</script>`}
</svelte:head>

<div class="min-h-screen bg-muted/25 text-foreground">
	<div class="mx-auto max-w-6xl px-6 sm:px-8 lg:px-10">
		<LandingHeader {monthlyPrice} />

		<main class="py-12 sm:py-16">
			<div class="mx-auto max-w-3xl">
				<header>
					<p class="text-sm font-semibold tracking-[0.18em] text-muted-foreground uppercase">
						Contact
					</p>
					<h1 class="mt-4 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
						Get in touch.
					</h1>
					<p class="mt-5 text-base leading-7 text-muted-foreground sm:text-lg">
						We're based in the United States and support firefighters, departments, academies, and
						training companies. Pick the inbox that matches your question.
					</p>
				</header>

				<section class="mt-10 grid gap-4 sm:grid-cols-2">
					<article class="rounded-none border border-border bg-card p-6 shadow-sm">
						<h2 class="text-lg font-semibold text-foreground">Support</h2>
						<p class="mt-2 text-sm leading-6 text-muted-foreground">
							Account help, billing questions, bug reports, and how-to questions.
						</p>
						<a
							class="mt-4 block text-sm font-medium text-[#E85D20] hover:underline"
							href={supportMail}
						>
							support@3alarmlabs.com
						</a>
					</article>

					<article class="rounded-none border border-border bg-card p-6 shadow-sm">
						<h2 class="text-lg font-semibold text-foreground">Sales</h2>
						<p class="mt-2 text-sm leading-6 text-muted-foreground">
							Department pricing, demos, pilot programs, and training-company licensing.
						</p>
						<a
							class="mt-4 block text-sm font-medium text-[#E85D20] hover:underline"
							href={salesMail}
						>
							sales@3alarmlabs.com
						</a>
					</article>

					<article class="rounded-none border border-border bg-card p-6 shadow-sm">
						<h2 class="text-lg font-semibold text-foreground">Privacy</h2>
						<p class="mt-2 text-sm leading-6 text-muted-foreground">
							Privacy questions, data-processing requests, and recording-policy questions.
						</p>
						<a
							class="mt-4 block text-sm font-medium text-[#E85D20] hover:underline"
							href={privacyMail}
						>
							privacy@3alarmlabs.com
						</a>
					</article>

					<article class="rounded-none border border-border bg-card p-6 shadow-sm">
						<h2 class="text-lg font-semibold text-foreground">Request a demo</h2>
						<p class="mt-2 text-sm leading-6 text-muted-foreground">
							See instructor-led Command and self-paced scenarios in a 30-minute walkthrough.
						</p>
						<Button variant="outline" class="mt-4 rounded-none" href="/demo">Request a demo</Button>
					</article>
				</section>

				<section class="mt-10 rounded-none border border-border bg-muted/30 p-6 shadow-sm">
					<h2 class="text-xl font-semibold tracking-tight text-foreground">Response times</h2>
					<p class="mt-2 text-sm leading-6 text-muted-foreground">
						We reply to support emails within one business day. Sales inquiries usually get a
						same-day response during business hours.
					</p>
				</section>
			</div>
		</main>

		<LandingFooter />
	</div>
</div>
