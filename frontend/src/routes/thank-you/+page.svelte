<script lang="ts">
	import { resolve } from '$app/paths';
	import { LandingFooter, LandingHeader } from '$lib/components/landing';
	import { Button } from '$lib/components/ui/button';
	import { PLANS } from '$lib/plans';
	import { defaultOgImageUrl, toCanonicalUrl } from '$lib/seo';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const monthlyPrice = PLANS.individual.monthlyPrice ?? 14.99;
	const pageTitle = 'Thank you | 3AlarmLabs';
	const canonicalUrl = toCanonicalUrl('/thank-you');

	const headline = () => {
		if (!data.isPostCheckout)
			return "You're signed in — head to Command when you're ready.";
		if (!data.isActiveOrgOwner)
			return 'Checkout completed.';
		if (data.checkoutSync === 'applied') return 'Purchase complete — welcome aboard.';
		if (data.checkoutSync === 'failed')
			return "We're finishing your checkout — one more step.";
		return 'Thanks — Stripe confirmed your checkout.';
	};

	const summary = () => {
		if (!data.isPostCheckout) {
			return 'This page is shown after Stripe checkout completes. Browse Command training below, or jump back anytime from your dashboard.';
		}
		if (!data.isActiveOrgOwner) {
			return `The organization owner completes billing. You'll get access automatically once they're done. Questions? Reach us at andrew@3alarmlabs.com.`;
		}
		if (data.checkoutSync === 'applied') {
			return `You're on ${data.planConfig.name}. Start with self-paced Command or instructor-led simulations from your workspace.`;
		}
		if (data.checkoutSync === 'failed') {
			return 'Open Billing in Settings once — we sync subscription details after checkout. Receipts remain in Stripe; use “Manage billing” when it appears.';
		}
		return 'If something still looks off after a refresh, open Billing once or reply to your Stripe receipt and we’ll help.';
	};
</script>

<svelte:head>
	<title>{pageTitle}</title>
	<meta
		name="description"
		content="Payment confirmed for 3AlarmLabs fire command training. Continue into Command training from your dashboard."
	/>
	<link rel="canonical" href={canonicalUrl} />
	<meta name="robots" content="noindex,nofollow" />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="3AlarmLabs" />
	<meta property="og:title" content={pageTitle} />
	<meta property="og:url" content={canonicalUrl} />
	<meta property="og:image" content={defaultOgImageUrl} />
</svelte:head>

<div class="min-h-screen bg-muted/25 text-foreground">
	<div class="mx-auto max-w-6xl px-6 sm:px-8 lg:px-10">
		<LandingHeader {monthlyPrice} />

		<main class="py-12 sm:py-16">
			<div class="mx-auto max-w-2xl">
				<header class="text-center">
					<p class="text-sm font-semibold tracking-[0.18em] text-muted-foreground uppercase">
						Thank you
					</p>
					<h1 class="mt-4 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
						{headline()}
					</h1>
					<p class="mx-auto mt-5 max-w-xl text-base leading-7 text-muted-foreground">
						{summary()}
					</p>
				</header>

				<div class="mt-10 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
					<Button class="rounded-none" href={resolve('/app/command')}>Open Command</Button>
					<Button variant="outline" class="rounded-none" href={resolve('/app/settings/billing')}>
						Billing & receipts
					</Button>
					<Button variant="outline" class="rounded-none" href="/">Home</Button>
				</div>

				{#if data.checkoutSync === 'skipped' || data.checkoutSync === 'failed'}
					<p class="mx-auto mt-8 max-w-xl text-center text-sm text-muted-foreground">
						Sync hint: {(data.checkoutSyncReason ?? 'unknown')} — webhook or Billing usually resolves
						this within moments.
					</p>
				{/if}
			</div>
		</main>

		<LandingFooter />
	</div>
</div>
