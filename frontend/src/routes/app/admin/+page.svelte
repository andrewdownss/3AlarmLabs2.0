<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const form = $derived(page.form as { error?: string; success?: boolean } | null | undefined);

	function formatDate(date: Date | string | null): string {
		if (!date) return 'Draft';
		return new Date(date).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}
</script>

<svelte:head>
	<title>Admin — 3AlarmLabs</title>
</svelte:head>

<div class="mx-auto max-w-5xl px-4 py-10">
	<div class="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
		<div>
			<h1 class="text-3xl font-semibold tracking-tight">Admin</h1>
			<p class="mt-1 text-sm text-muted-foreground">
				User and organization management tools for support and testing.
			</p>
		</div>
		<div class="flex flex-wrap gap-2">
			<Button variant="outline" href={resolve('/app/admin/users')}>Users</Button>
			<Button variant="outline" href={resolve('/app/admin/organizations')}>Organizations</Button>
		</div>
	</div>

	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<Card>
			<CardHeader class="pb-2">
				<CardTitle class="text-sm font-medium">Users</CardTitle>
				<CardDescription>Total accounts</CardDescription>
			</CardHeader>
			<CardContent class="text-3xl font-semibold tabular-nums">{data.userCount}</CardContent>
		</Card>
		<Card>
			<CardHeader class="pb-2">
				<CardTitle class="text-sm font-medium">New users (30d)</CardTitle>
				<CardDescription>Signups in last 30 days</CardDescription>
			</CardHeader>
			<CardContent class="text-3xl font-semibold tabular-nums">{data.newUserCount30d}</CardContent>
		</Card>
		<Card>
			<CardHeader class="pb-2">
				<CardTitle class="text-sm font-medium">Organizations</CardTitle>
				<CardDescription>Total orgs</CardDescription>
			</CardHeader>
			<CardContent class="text-3xl font-semibold tabular-nums">{data.organizationCount}</CardContent
			>
		</Card>
		<Card>
			<CardHeader class="pb-2">
				<CardTitle class="text-sm font-medium">Plans</CardTitle>
				<CardDescription>Organization breakdown</CardDescription>
			</CardHeader>
			<CardContent class="flex flex-wrap gap-2">
				{#if data.orgPlanCounts.length === 0}
					<span class="text-sm text-muted-foreground">No organizations</span>
				{:else}
					{#each data.orgPlanCounts as row (row.planId)}
						<Badge variant="secondary">
							{row.planId}: {row.count}
						</Badge>
					{/each}
				{/if}
			</CardContent>
		</Card>
	</div>

	<Card class="mt-6">
		<CardHeader>
			<CardTitle>Demo simulation</CardTitle>
			<CardDescription>
				Choose which 3AlarmLabs library simulation powers the public /demo page.
			</CardDescription>
		</CardHeader>
		<CardContent>
			{#if form?.error}
				<div
					class="mb-4 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive"
				>
					{form.error}
				</div>
			{:else if form?.success}
				<div
					class="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300"
				>
					Demo simulation updated.
				</div>
			{/if}

			{#if data.libraryScenarios.length === 0}
				<p class="text-sm text-muted-foreground">
					No library simulations exist yet. Create one from the 3AlarmLabs Library page first.
				</p>
				<Button class="mt-4" href={resolve('/app/command/library')}>Open library</Button>
			{:else}
				<form method="POST" action="?/setDemoScenario" class="grid gap-4 lg:grid-cols-[1fr_auto]">
					<div>
						<label for="demo-scenario" class="text-sm font-medium">Selected simulation</label>
						<select
							id="demo-scenario"
							name="scenarioId"
							class="mt-2 h-11 w-full rounded-md border bg-background px-3 text-sm"
						>
							{#each data.libraryScenarios as scenario (scenario.id)}
								<option value={scenario.id} selected={scenario.id === data.demoScenario?.id}>
									{scenario.title} ({formatDate(scenario.publishedAt)})
								</option>
							{/each}
						</select>
						<p class="mt-2 text-xs text-muted-foreground">
							Current:
							{data.demoScenario?.title ?? 'No demo simulation selected'}
						</p>
					</div>
					<div class="flex items-end gap-2">
						<Button type="submit" class="min-h-11">Save demo simulation</Button>
						<Button variant="outline" class="min-h-11" href={resolve('/demo')}>View demo</Button>
					</div>
				</form>
			{/if}
		</CardContent>
	</Card>
</div>
