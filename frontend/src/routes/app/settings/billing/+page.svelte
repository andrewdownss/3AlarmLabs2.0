<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Spinner } from '$lib/components/ui/spinner';
	import { PLANS, type BillingInterval, type PlanId } from '$lib/plans';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const tiers: PlanId[] = [
		'individual',
		'small_firehouse',
		'medium_firehouse',
		'large_firehouse',
		'training_company'
	];

	let loading = $state<string | null>(null);

	function priceLabel(planId: PlanId): string {
		const p = PLANS[planId];
		if (planId === 'training_company') return '$4,999+/yr';
		if (p.monthlyPrice !== null && p.annualPrice !== null) return `$${p.monthlyPrice}/mo or $${p.annualPrice}/yr`;
		if (p.annualPrice !== null) return `$${p.annualPrice}/yr`;
		return 'Contact sales';
	}

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

	async function startCheckout(planId: PlanId, billingInterval: BillingInterval) {
		if (!data.organization?.id) return;
		const key = `checkout:${planId}:${billingInterval}`;
		loading = key;
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
						{#if loading === 'portal'}
							<Spinner class="mr-2 h-4 w-4" />
							Opening…
						{:else}
							Manage billing & invoices
						{/if}
					</Button>
				</div>
			{/if}
		</section>

		<h2 class="mb-4 text-lg font-semibold">Recommended limits</h2>
		<div class="overflow-x-auto rounded-xl border bg-card shadow-sm">
			<table class="min-w-[820px] w-full text-left text-sm">
				<thead class="border-b bg-muted/30">
					<tr>
						<th class="px-4 py-3 font-semibold">Tier</th>
						<th class="px-4 py-3 font-semibold">Price</th>
						<th class="px-4 py-3 font-semibold">Good limits</th>
						<th class="px-4 py-3 font-semibold">Best for</th>
						<th class="px-4 py-3 text-right font-semibold">Action</th>
					</tr>
				</thead>
				<tbody>
					{#each tiers as pid (pid)}
						{@const p = PLANS[pid]}
						<tr class="border-b last:border-b-0">
							<td class="px-4 py-4 align-top font-semibold">{p.name}</td>
							<td class="px-4 py-4 align-top text-muted-foreground">{priceLabel(pid)}</td>
							<td class="px-4 py-4 align-top text-muted-foreground">{p.limitsSummary}</td>
							<td class="px-4 py-4 align-top text-muted-foreground">{p.bestFor}</td>
							<td class="px-4 py-4 align-top">
								<div class="flex justify-end gap-2">
									{#if data.planConfig.id === pid}
										<Button size="sm" variant="outline" disabled={true}>Current</Button>
									{:else if !p.canSelfServeCheckout}
										<Button
											size="sm"
											variant="outline"
											href="mailto:sales@3alarmlabs.com?subject=Training%20Company%20pricing"
										>
											Contact sales
										</Button>
									{:else}
										{#each p.checkoutIntervals as interval (interval)}
											{@const key = `checkout:${pid}:${interval}`}
											<Button
												size="sm"
												variant={interval === 'month' ? 'default' : 'outline'}
												disabled={loading !== null}
												onclick={() => startCheckout(pid, interval)}
											>
												{#if loading === key}
													<Spinner class="mr-2 h-4 w-4" />
													Redirecting…
												{:else}
													{interval === 'month' ? 'Monthly' : 'Yearly'}
												{/if}
											</Button>
										{/each}
									{/if}
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<p class="mt-8 text-center text-xs text-muted-foreground">
			<a href={resolve('/')} class="underline">Pricing overview</a>
			·
			<a href={resolve('/privacy')} class="underline">Privacy</a>
		</p>
	{/if}
</div>
