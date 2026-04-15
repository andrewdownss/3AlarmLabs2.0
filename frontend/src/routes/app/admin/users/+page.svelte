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

	const filteredUsers = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (!q) return data.users;
		return data.users.filter((u) => {
			const org = u.organizationMemberships?.[0]?.organization;
			return (
				u.email.toLowerCase().includes(q) ||
				u.name.toLowerCase().includes(q) ||
				(org?.name ?? '').toLowerCase().includes(q)
			);
		});
	});
</script>

<svelte:head>
	<title>Admin — Users</title>
</svelte:head>

<div class="mx-auto max-w-6xl px-4 py-10">
	<div class="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
		<div>
			<h1 class="text-3xl font-semibold tracking-tight">Users</h1>
			<p class="mt-1 text-sm text-muted-foreground">Manage memberships and troubleshoot accounts.</p>
		</div>
		<div class="flex flex-wrap gap-2">
			<Button variant="outline" href={resolve('/app/admin')}>Admin</Button>
			<Button variant="outline" href={resolve('/app/admin/organizations')}>Organizations</Button>
		</div>
	</div>

	{#if form?.error}
		<div class="mb-4 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
			{form.error}
		</div>
	{/if}

	<div class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
		<Input
			name="q"
			placeholder="Search by name, email, org…"
			bind:value={query}
			class="sm:max-w-sm"
		/>
		<p class="text-xs text-muted-foreground">{filteredUsers.length} users</p>
	</div>

	<div class="overflow-x-auto rounded-xl border bg-card shadow-sm">
		<table class="w-full text-sm">
			<thead class="border-b bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
				<tr>
					<th class="px-4 py-3">User</th>
					<th class="px-4 py-3">Organization</th>
					<th class="px-4 py-3">Plan</th>
					<th class="px-4 py-3">Joined</th>
					<th class="px-4 py-3 text-right">Actions</th>
				</tr>
			</thead>
			<tbody class="divide-y">
				{#each filteredUsers as u (u.id)}
					{@const membership = u.organizationMemberships?.[0]}
					{@const org = membership?.organization}
					<tr class="align-top">
						<td class="px-4 py-3">
							<p class="font-medium">{u.name}</p>
							<p class="mt-0.5 font-mono text-xs text-muted-foreground">{u.email}</p>
							<div class="mt-2 flex flex-wrap gap-2">
								{#if u.isAdmin}
									<Badge variant="default">admin</Badge>
								{/if}
								{#if membership?.role}
									<Badge variant="outline">{membership.role}</Badge>
								{/if}
							</div>
						</td>
						<td class="px-4 py-3">
							{#if org}
								<p class="font-medium">{org.name}</p>
								<p class="mt-0.5 font-mono text-xs text-muted-foreground">{org.id}</p>
							{:else}
								<p class="text-muted-foreground">—</p>
							{/if}
						</td>
						<td class="px-4 py-3">
							{#if org}
								<Badge variant="secondary">{org.planId}</Badge>
							{:else}
								<span class="text-muted-foreground">—</span>
							{/if}
						</td>
						<td class="px-4 py-3">
							<p class="tabular-nums">{u.createdAt.toLocaleDateString()}</p>
						</td>
						<td class="px-4 py-3">
							<div class="flex flex-col items-end gap-2">
								<form method="POST" action="?/moveUser" class="flex items-center gap-2">
									<input type="hidden" name="userId" value={u.id} />
									<select
										name="organizationId"
										class="h-9 rounded-md border bg-background px-2 text-sm"
										aria-label="Organization"
									>
										{#each data.organizations as o (o.id)}
											<option value={o.id} selected={o.id === org?.id}>{o.name}</option>
										{/each}
									</select>
									<Button type="submit" size="sm" variant="outline">Move</Button>
								</form>

								<form
									method="POST"
									action="?/deleteUser"
									onsubmit={(e) => {
										if (!confirm(`Delete user ${u.email}? This cannot be undone.`)) e.preventDefault();
									}}
								>
									<input type="hidden" name="userId" value={u.id} />
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

