<script lang="ts">
	import { resolve } from '$app/paths';
	import { LandingFooter, LandingHeader } from '$lib/components/landing';
	import { Button } from '$lib/components/ui/button';
	import { PLANS } from '$lib/plans';

	const individual = PLANS.individual;
	const smallFirehouse = PLANS.small_firehouse;
	const mediumFirehouse = PLANS.medium_firehouse;
	const largeFirehouse = PLANS.large_firehouse;
	const trainingCompany = PLANS.training_company;

	const monthlyPrice = individual.monthlyPrice ?? 29;

	const salesMail =
		'mailto:sales@3alarmlabs.com?subject=' + encodeURIComponent('Pricing question — 3 Alarm Labs');
</script>

<svelte:head>
	<title>Pricing — 3 Alarm Labs</title>
	<meta
		name="description"
		content="Self-paced command training for $29/month. Department plans start at $799/year for up to 10 members with instructor-led sessions and shared scenarios."
	/>
	<link rel="canonical" href="https://3alarmlabs.com/pricing" />
	<meta property="og:type" content="website" />
	<meta property="og:title" content="Pricing — 3 Alarm Labs" />
	<meta
		property="og:description"
		content="Self-paced command training for $29/month. Department plans with instructor-led sessions and shared scenarios."
	/>
	<meta property="og:url" content="https://3alarmlabs.com/pricing" />
	<meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<div class="min-h-screen bg-muted/25 text-foreground">
	<div class="mx-auto max-w-6xl px-6 sm:px-8 lg:px-10">
		<LandingHeader {monthlyPrice} />

		<main class="py-12 sm:py-16">
			<header class="mx-auto max-w-3xl text-center">
				<p class="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Pricing</p>
				<h1 class="mt-4 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
					Simple pricing for firefighters and departments.
				</h1>
				<p class="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
					Start with self-paced command training for individuals. Add instructor-led sessions, shared scenarios,
					and more members as your department grows.
				</p>
			</header>

			<section class="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3" aria-label="Individual and small department plans">
				<article class="flex flex-col rounded-none border border-border bg-card p-6 shadow-sm">
					<header>
						<p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
							{individual.bestFor}
						</p>
						<h2 class="mt-2 text-xl font-semibold tracking-tight">{individual.name}</h2>
						<p class="mt-4 text-3xl font-bold">
							${individual.monthlyPrice}<span class="text-base font-normal text-muted-foreground">/mo</span>
						</p>
						<p class="mt-1 text-sm text-muted-foreground">or ${individual.annualPrice}/yr billed yearly</p>
					</header>
					<ul class="mt-5 space-y-2 text-sm text-muted-foreground">
						<li>1 seat · Self-paced Command</li>
						<li>Up to 3 active SizeUp scenes</li>
						<li>Up to 3 active Command scenarios</li>
						<li>Share scenarios by link</li>
					</ul>
					<Button class="mt-6 w-full rounded-none bg-[#E85D20] text-white hover:bg-[#D4501A]" href={resolve('/signup')}>
						Start for ${monthlyPrice}/month
					</Button>
				</article>

				<article class="flex flex-col rounded-none border-2 border-[#E85D20] bg-card p-6 shadow-md">
					<header>
						<p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#E85D20]">Most popular</p>
						<h2 class="mt-2 text-xl font-semibold tracking-tight">{smallFirehouse.name}</h2>
						<p class="mt-4 text-3xl font-bold">
							${smallFirehouse.annualPrice}<span class="text-base font-normal text-muted-foreground">/yr</span>
						</p>
						<p class="mt-1 text-sm text-muted-foreground">Billed yearly</p>
					</header>
					<ul class="mt-5 space-y-2 text-sm text-muted-foreground">
						<li>Up to 10 members</li>
						<li>Instructor-led Command sessions</li>
						<li>Unlimited SizeUp scenes</li>
						<li>Folders and share links</li>
					</ul>
					<Button class="mt-6 w-full rounded-none bg-[#E85D20] text-white hover:bg-[#D4501A]" href={resolve('/signup')}>
						Get started
					</Button>
				</article>

				<article class="flex flex-col rounded-none border border-border bg-card p-6 shadow-sm">
					<header>
						<p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
							{mediumFirehouse.bestFor}
						</p>
						<h2 class="mt-2 text-xl font-semibold tracking-tight">{mediumFirehouse.name}</h2>
						<p class="mt-4 text-3xl font-bold">
							${mediumFirehouse.annualPrice}<span class="text-base font-normal text-muted-foreground">/yr</span>
						</p>
						<p class="mt-1 text-sm text-muted-foreground">Billed yearly</p>
					</header>
					<ul class="mt-5 space-y-2 text-sm text-muted-foreground">
						<li>Up to 30 members</li>
						<li>3 instructors/admins</li>
						<li>25 active Command scenarios</li>
						<li>Shared org workspace</li>
					</ul>
					<Button variant="outline" class="mt-6 w-full rounded-none" href={resolve('/signup')}>Get started</Button>
				</article>
			</section>

			<section class="mt-6 grid gap-4 md:grid-cols-2" aria-label="Larger department and training company plans">
				<article class="flex flex-col rounded-none border border-border bg-card p-6 shadow-sm">
					<header>
						<p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
							{largeFirehouse.bestFor}
						</p>
						<h2 class="mt-2 text-xl font-semibold tracking-tight">{largeFirehouse.name}</h2>
						<p class="mt-4 text-3xl font-bold">
							${largeFirehouse.annualPrice}<span class="text-base font-normal text-muted-foreground">/yr</span>
						</p>
						<p class="mt-1 text-sm text-muted-foreground">Billed yearly</p>
					</header>
					<ul class="mt-5 space-y-2 text-sm text-muted-foreground">
						<li>Up to 100 members</li>
						<li>10 instructors/admins</li>
						<li>Unlimited Command scenarios</li>
						<li>Advanced reporting · video export</li>
					</ul>
					<Button variant="outline" class="mt-6 w-full rounded-none" href={resolve('/demo')}>Book a demo</Button>
				</article>

				<article class="flex flex-col rounded-none border border-dashed border-border bg-background p-6 shadow-sm">
					<header>
						<p class="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
							{trainingCompany.bestFor}
						</p>
						<h2 class="mt-2 text-xl font-semibold tracking-tight">{trainingCompany.name}</h2>
						<p class="mt-4 text-lg font-semibold text-muted-foreground">Custom pricing</p>
						<p class="mt-1 text-sm text-muted-foreground">Commercial use and client-facing rights</p>
					</header>
					<ul class="mt-5 space-y-2 text-sm text-muted-foreground">
						<li>Commercial training use</li>
						<li>Up to 5 instructors</li>
						<li>Up to 50 trainees/year included</li>
						<li>Invoicing and annual agreements</li>
					</ul>
					<Button variant="outline" class="mt-6 w-full rounded-none" href={salesMail}>Contact sales</Button>
				</article>
			</section>

			<section class="mt-16" aria-labelledby="faq-heading">
				<div class="rounded-none border border-border bg-card p-6 sm:p-10">
					<h2 id="faq-heading" class="text-2xl font-semibold tracking-tight text-foreground">Pricing FAQ</h2>

					<dl class="mt-6 grid gap-6 sm:grid-cols-2">
						<div>
							<dt class="font-semibold text-foreground">Can I try it before paying?</dt>
							<dd class="mt-2 text-sm leading-6 text-muted-foreground">
								Yes. Create a free account to try self-paced scenarios before starting a monthly Individual plan.
							</dd>
						</div>
						<div>
							<dt class="font-semibold text-foreground">Do department plans include self-paced training?</dt>
							<dd class="mt-2 text-sm leading-6 text-muted-foreground">
								Every department plan includes self-paced Command for every member, plus instructor-led sessions.
							</dd>
						</div>
						<div>
							<dt class="font-semibold text-foreground">How does billing work?</dt>
							<dd class="mt-2 text-sm leading-6 text-muted-foreground">
								Individual plans bill monthly or yearly. Department plans bill yearly. Payments are handled by Stripe.
							</dd>
						</div>
						<div>
							<dt class="font-semibold text-foreground">Can I cancel anytime?</dt>
							<dd class="mt-2 text-sm leading-6 text-muted-foreground">
								Yes. Cancel from Settings → Billing to stop renewals. You keep access until the end of the period.
							</dd>
						</div>
					</dl>
				</div>
			</section>
		</main>

		<LandingFooter />
	</div>
</div>
