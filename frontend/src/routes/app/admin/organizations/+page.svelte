<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let query = $state('');
	const form = $derived(page.form as { error?: string; success?: boolean } | null | undefined);

	const filteredOrgs = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (!q) return data.organizations;
		return data.organizations.filter((o) => {
			return (
				o.name.toLowerCase().includes(q) ||
				o.id.toLowerCase().includes(q) ||
				(o.owner?.email ?? '').toLowerCase().includes(q)
			);
		});
	});
</script>

<svelte:head>
	<title>Admin — Organizations</title>
</svelte:head>

<div class="mx-auto max-w-6xl px-4 py-10">
	<div class="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
		<div>
			<h1 class="text-3xl font-semibold tracking-tight">Organizations</h1>
			<p class="mt-1 text-sm text-muted-foreground">Manage plans and membership at the org level.</p>
		</div>
		<div class="flex flex-wrap gap-2">
			<Button variant="outline" href={resolve('/app/admin')}>Admin</Button>
			<Button variant="outline" href={resolve('/app/admin/users')}>Users</Button>
		</div>
	</div>

	{#if form?.error}
		<div class="mb-4 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
			{form.error}
		</div>
	{/if}

	<div class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
		<Input placeholder="Search by name, id, owner email…" bind:value={query} class="sm:max-w-sm" />
		<p class="text-xs text-muted-foreground">{filteredOrgs.length} orgs</p>
	</div>

	<div class="overflow-x-auto rounded-xl border bg-card shadow-sm">
		<table class="w-full text-sm">
			<thead class="border-b bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
				<tr>
					<th class="px-4 py-3">Organization</th>
					<th class="px-4 py-3">Owner</th>
					<th class="px-4 py-3">Members</th>
					<th class="px-4 py-3">Plan</th>
					<th class="px-4 py-3">Stripe</th>
					<th class="px-4 py-3 text-right">Actions</th>
				</tr>
			</thead>
			<tbody class="divide-y">
				{#each filteredOrgs as o (o.id)}
					<tr class="align-top">
						<td class="px-4 py-3">
							<p class="font-medium">{o.name}</p>
							<p class="mt-0.5 font-mono text-xs text-muted-foreground">{o.id}</p>
							<p class="mt-2 text-xs text-muted-foreground">
								Created {o.createdAt.toLocaleDateString()}
							</p>
						</td>
						<td class="px-4 py-3">
							{#if o.owner}
								<p class="font-medium">{o.owner.name}</p>
								<p class="mt-0.5 font-mono text-xs text-muted-foreground">{o.owner.email}</p>
							{:else}
								<p class="text-muted-foreground">—</p>
							{/if}
						</td>
						<td class="px-4 py-3">
							<Badge variant="secondary">{o.memberCount}</Badge>
						</td>
						<td class="px-4 py-3">
							<form method="POST" action="?/changePlan" class="flex items-center gap-2">
								<input type="hidden" name="organizationId" value={o.id} />
								<select
									name="planId"
									class="h-9 rounded-md border bg-background px-2 text-sm"
									aria-label="Plan"
								>
									{#each data.planIds as pid (pid)}
										<option value={pid} selected={pid === o.planId}>{pid}</option>
									{/each}
								</select>
								<Button type="submit" size="sm" variant="outline">Save</Button>
							</form>
						</td>
						<td class="px-4 py-3">
							{#if o.stripeSubscriptionId}
								<Badge variant="outline">subscribed</Badge>
								<p class="mt-1 font-mono text-xs text-muted-foreground">{o.stripeSubscriptionId}</p>
							{:else if o.stripeCustomerId}
								<Badge variant="outline">customer</Badge>
								<p class="mt-1 font-mono text-xs text-muted-foreground">{o.stripeCustomerId}</p>
							{:else}
								<span class="text-muted-foreground">—</span>
							{/if}
							{#if o.stripeCurrentPeriodEnd}
								<p class="mt-2 text-xs text-muted-foreground">
									Period ends {o.stripeCurrentPeriodEnd.toLocaleDateString()}
								</p>
							{/if}
						</td>
						<td class="px-4 py-3">
							<div class="flex flex-col items-end gap-2">
								<form
									method="POST"
									action="?/deleteOrganization"
									onsubmit={(e) => {
										if (!confirm(`Delete organization ${o.name}? This cannot be undone.`)) e.preventDefault();
									}}
								>
									<input type="hidden" name="organizationId" value={o.id} />
									<Button type="submit" size="sm" variant="destructive">Delete</Button>
								</form>
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

