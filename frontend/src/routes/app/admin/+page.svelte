<script lang="ts">
	import { resolve } from '$app/paths';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>Admin — 3 Alarm Labs</title>
</svelte:head>

<div class="mx-auto max-w-5xl px-4 py-10">
	<div class="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
		<div>
			<h1 class="text-3xl font-semibold tracking-tight">Admin</h1>
			<p class="mt-1 text-sm text-muted-foreground">User and organization management tools for support and testing.</p>
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
			<CardContent class="text-3xl font-semibold tabular-nums">{data.organizationCount}</CardContent>
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
</div>

