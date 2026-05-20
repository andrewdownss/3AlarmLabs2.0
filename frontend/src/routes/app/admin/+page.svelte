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
	let simulationQuery = $state('');

	const filteredUserSimulations = $derived.by(() => {
		const q = simulationQuery.trim().toLowerCase();
		if (!q) return data.userSimulations;
		return data.userSimulations.filter((simulation) => {
			const owner = simulation.creator;
			const org = simulation.organization;
			return `${simulation.title} ${simulation.description ?? ''} ${owner?.name ?? ''} ${owner?.email ?? ''} ${org?.name ?? ''}`
				.toLowerCase()
				.includes(q);
		});
	});

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
				<form method="POST" action="?/setDemoScenario" class="max-w-xl space-y-4">
					<div>
						<label for="demo-scenario" class="text-sm font-medium">Selected simulation</label>
						<select
							id="demo-scenario"
							name="scenarioId"
							class="mt-2 h-8 w-full rounded-lg border border-border bg-background px-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
						>
							{#each data.libraryScenarios as scenario (scenario.id)}
								<option value={scenario.id} selected={scenario.id === data.demoScenario?.id}>
									{scenario.title} ({formatDate(scenario.publishedAt)})
								</option>
							{/each}
						</select>
					</div>
					<div class="flex flex-wrap gap-2">
						<Button type="submit">Save demo simulation</Button>
						<Button variant="outline" href={resolve('/demo')}>View demo</Button>
					</div>
					<p class="text-xs text-muted-foreground">
						Current:
						{data.demoScenario?.title ?? 'No demo simulation selected'}
					</p>
				</form>
			{/if}
		</CardContent>
	</Card>

	<Card class="mt-6">
		<CardHeader>
			<CardTitle>User simulations</CardTitle>
			<CardDescription>
				View command simulations created by other users. Showing the latest 100 non-library
				simulations.
			</CardDescription>
		</CardHeader>
		<CardContent>
			<div class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<input
					bind:value={simulationQuery}
					placeholder="Search by title, owner, email, or organization..."
					class="h-10 w-full rounded-md border bg-background px-3 text-sm sm:max-w-md"
				/>
				<p class="text-xs text-muted-foreground">
					{filteredUserSimulations.length} of {data.userSimulations.length} simulations
				</p>
			</div>

			{#if filteredUserSimulations.length === 0}
				<div class="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
					{simulationQuery ? 'No simulations match your search.' : 'No user simulations found.'}
				</div>
			{:else}
				<div class="overflow-x-auto rounded-xl border">
					<table class="w-full text-sm">
						<thead
							class="border-b bg-muted/30 text-left text-xs tracking-wide text-muted-foreground uppercase"
						>
							<tr>
								<th class="px-4 py-3">Simulation</th>
								<th class="px-4 py-3">Owner</th>
								<th class="px-4 py-3">Organization</th>
								<th class="px-4 py-3">Updated</th>
								<th class="px-4 py-3 text-right">Actions</th>
							</tr>
						</thead>
						<tbody class="divide-y">
							{#each filteredUserSimulations as simulation (simulation.id)}
								<tr class="align-top">
									<td class="px-4 py-3">
										<p class="font-medium">{simulation.title}</p>
										{#if simulation.description}
											<p class="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
												{simulation.description}
											</p>
										{/if}
										<div class="mt-2 flex flex-wrap gap-1.5">
											{#if simulation.constructionType}
												<Badge variant="outline">{simulation.constructionType}</Badge>
											{/if}
											{#if simulation.alarmLevel}
												<Badge variant="secondary">{simulation.alarmLevel}</Badge>
											{/if}
										</div>
									</td>
									<td class="px-4 py-3">
										{#if simulation.creator}
											<p class="font-medium">{simulation.creator.name}</p>
											<p class="mt-0.5 font-mono text-xs text-muted-foreground">
												{simulation.creator.email}
											</p>
										{:else}
											<span class="text-muted-foreground">Unknown</span>
										{/if}
									</td>
									<td class="px-4 py-3">
										{#if simulation.organization}
											<p class="font-medium">{simulation.organization.name}</p>
											<div class="mt-1 flex flex-wrap gap-1.5">
												<Badge variant="outline">{simulation.organization.planId}</Badge>
											</div>
										{:else}
											<span class="text-muted-foreground">Individual</span>
										{/if}
									</td>
									<td class="px-4 py-3">
										<p class="tabular-nums">{formatDate(simulation.updatedAt)}</p>
										<p class="mt-1 text-xs text-muted-foreground">
											Created {formatDate(simulation.createdAt)}
										</p>
									</td>
									<td class="px-4 py-3 text-right">
										<Button
											size="sm"
											variant="outline"
											href={resolve(`/app/command/scenarios/${simulation.id}`)}
										>
											Edit
										</Button>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</CardContent>
	</Card>
</div>
