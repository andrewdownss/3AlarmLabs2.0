<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { PLANS, type PlanId } from '$lib/plans';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const paidPlans: PlanId[] = ['individual', 'team', 'instructor'];

	let loading = $state<'portal' | 'checkout' | null>(null);

	async function openPortal() {
		if (!data.organization?.id) return;
		loading = 'portal';
		try {
			const res = await fetch('/api/stripe/portal', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'same-origin',
				body: JSON.stringify({ organizationId: data.organization.id })
			});
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				alert((err as { message?: string }).message ?? 'Could not open billing portal');
				return;
			}
			const { url } = (await res.json()) as { url?: string };
			if (url) window.location.href = url;
		} finally {
			loading = null;
		}
	}

	async function startCheckout(planId: PlanId, billingInterval: 'month' | 'year') {
		if (!data.organization?.id) return;
		loading = 'checkout';
		try {
			const res = await fetch('/api/stripe/checkout', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'same-origin',
				body: JSON.stringify({
					organizationId: data.organization.id,
					planId,
					billingInterval
				})
			});
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				alert((err as { message?: string }).message ?? 'Could not start checkout');
				return;
			}
			const { url } = (await res.json()) as { url?: string };
			if (url) window.location.href = url;
		} finally {
			loading = null;
		}
	}
</script>

<svelte:head>
	<title>Billing — 3 Alarm Labs</title>
</svelte:head>

<div class="mx-auto max-w-4xl px-4 py-10">
	<div class="mb-8">
		<h1 class="text-3xl font-semibold tracking-tight">Billing</h1>
		<p class="mt-1 text-sm text-muted-foreground">
			Choose a plan for <strong class="text-foreground">{data.organization?.name ?? 'your organization'}</strong>.
		</p>
	</div>

	{#if data.checkoutStatus === 'success'}
		<p class="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
			Payment successful — your subscription will update in a moment. Refresh if your plan badge doesn’t change.
		</p>
	{:else if data.checkoutStatus === 'cancel'}
		<p class="mb-6 rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
			Checkout was cancelled. No charges were made.
		</p>
	{/if}

	{#if !data.isOrgOwner}
		<div class="rounded-xl border bg-card p-6 shadow-sm">
			<p class="text-sm text-muted-foreground">
				Only the organization owner can manage billing. Ask your lead to upgrade, or contact
				<a href="mailto:support@3alarmlabs.com" class="font-medium underline">support@3alarmlabs.com</a>.
			</p>
		</div>
	{:else}
		<section class="mb-10 rounded-xl border bg-card p-6 shadow-sm">
			<h2 class="text-lg font-semibold">Current plan</h2>
			<div class="mt-3 flex flex-wrap items-center gap-2">
				<Badge variant="secondary">{data.planConfig.name}</Badge>
				{#if data.organization?.stripeSubscriptionId}
					<span class="text-sm text-muted-foreground">Active subscription</span>
				{/if}
				{#if data.organization?.stripeCurrentPeriodEnd}
					<span class="text-sm text-muted-foreground">
						Current period ends {data.organization.stripeCurrentPeriodEnd.toLocaleDateString()}
					</span>
				{/if}
			</div>
			{#if data.organization?.stripeCustomerId}
				<div class="mt-4">
					<Button
						type="button"
						variant="outline"
						disabled={loading !== null}
						onclick={openPortal}
					>
						{loading === 'portal' ? 'Opening…' : 'Manage billing & invoices'}
					</Button>
				</div>
			{/if}
		</section>

		<h2 class="mb-4 text-lg font-semibold">Upgrade or change plan</h2>
		<div class="grid gap-4 md:grid-cols-3">
			{#each paidPlans as pid (pid)}
				{@const p = PLANS[pid]}
				<div class="flex flex-col rounded-xl border bg-card p-5 shadow-sm">
					<h3 class="text-base font-semibold">{p.name}</h3>
					<p class="mt-1 text-sm text-muted-foreground">
						{#if pid === 'individual'}
							Unlimited SizeUp · Command self-practice
						{:else if pid === 'team'}
							Unlimited SizeUp · Up to 3 members · Instructor-led
						{:else}
							Unlimited SizeUp · Up to 15 members · Instructor-led · Video export
						{/if}
					</p>
					<p class="mt-3 text-sm">
						<span class="text-2xl font-bold">${p.monthlyPrice}</span>
						<span class="text-muted-foreground">/mo</span>
					</p>
					<p class="text-xs text-muted-foreground">or ${p.annualPrice}/yr (save ~2 months)</p>
					<div class="mt-4 flex flex-1 flex-col justify-end gap-2">
						<Button
							class="w-full"
							disabled={loading !== null || data.planConfig.id === pid}
							onclick={() => startCheckout(pid, 'month')}
						>
							{loading === 'checkout' ? 'Redirecting…' : data.planConfig.id === pid ? 'Current' : 'Subscribe monthly'}
						</Button>
						<Button
							type="button"
							variant="outline"
							class="w-full"
							disabled={loading !== null || data.planConfig.id === pid}
							onclick={() => startCheckout(pid, 'year')}
						>
							Subscribe yearly
						</Button>
					</div>
				</div>
			{/each}
		</div>

		<section class="mt-10 rounded-xl border border-dashed bg-muted/20 p-6">
			<h3 class="font-semibold">Fire department / Academy</h3>
			<p class="mt-1 text-sm text-muted-foreground">
				Custom seats, invoicing, and usage. Contact us for a quote.
			</p>
			<Button class="mt-4" variant="outline" href="mailto:sales@3alarmlabs.com?subject=Enterprise%20pricing">
				Contact sales
			</Button>
		</section>

		<p class="mt-8 text-center text-xs text-muted-foreground">
			<a href={resolve('/')} class="underline">Pricing overview</a>
			·
			<a href={resolve('/privacy')} class="underline">Privacy</a>
		</p>
	{/if}
</div>
