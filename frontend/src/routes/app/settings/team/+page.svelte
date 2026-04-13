<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { page } from '$app/state';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let email = $state('');
	let copyHint = $state('');

	const form = $derived(
		page.form as
			| { error?: string; inviteUrl?: string; success?: boolean }
			| null
			| undefined
	);

	async function copyText(value: string) {
		try {
			await navigator.clipboard.writeText(value);
			copyHint = 'Copied to clipboard';
			setTimeout(() => {
				copyHint = '';
			}, 2000);
		} catch {
			copyHint = 'Unable to copy — select and copy manually';
		}
	}
</script>

<div class="mx-auto max-w-3xl px-4 py-10">
	<div class="mb-8">
		<h1 class="text-3xl font-semibold tracking-tight">Team &amp; invites</h1>
		<p class="mt-1 text-sm text-muted-foreground">
			Share a department code for quick signup, invite by email, or copy an invite link. Email invites must match the
			member’s login address.
		</p>
	</div>

	{#if !data.isOwner}
		<div class="rounded-xl border bg-card p-6 shadow-sm">
			<p class="text-sm text-muted-foreground">
				Ask your lead for a <strong>department code</strong> or email invite. Then join the department and use
				session codes for instructor-led training.
			</p>
			<div class="mt-4 flex flex-wrap gap-2">
				<Button variant="outline" href="/app/join-organization">Join department</Button>
				<Button variant="outline" href="/app/command/join">Join session</Button>
			</div>
		</div>
	{:else}
		<div class="space-y-8">
			<section class="rounded-xl border bg-card p-6 shadow-sm">
				<h2 class="text-lg font-semibold">{data.organization.name}</h2>
				<p class="mt-1 text-sm text-muted-foreground">
					Plan: <Badge variant="secondary">{data.plan.name}</Badge>
					<span class="ml-2">
						{data.memberCount} / {data.plan.maxUsers === -1 ? '∞' : data.plan.maxUsers} seats used
					</span>
				</p>
				{#if !data.canInvite}
					<p class="mt-3 text-sm text-amber-800 dark:text-amber-200">
						You’ve reached the member limit for this plan.
						<a href="/app/settings/billing" class="font-medium underline">Upgrade</a> to invite more people.
					</p>
				{/if}

				{#if data.plan.maxUsers <= 1}
					<p class="mt-3 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
						<strong class="text-foreground">Individual plan</strong> — solo workspace. Upgrade to Team or Instructor to
						invite members and run instructor-led sessions with your crew.
					</p>
				{/if}

				<div class="mt-6 rounded-lg border bg-muted/30 px-4 py-4">
					<h3 class="text-sm font-semibold">Department join code</h3>
					<p class="mt-1 text-xs text-muted-foreground">
						Anyone with this code can join your department (until you’re at the member limit). They use
						<strong>Command → Join department</strong>.
					</p>
					<p class="mt-3 text-center font-mono text-3xl font-bold tracking-[0.35em] sm:text-left">
						{data.organization.joinCode ?? '—'}
					</p>
					<div class="mt-3 flex flex-wrap items-center gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={!data.organization.joinCode}
							onclick={() => copyText(data.organization.joinCode ?? '')}
						>
							Copy code
						</Button>
						<form
							method="POST"
							action="?/regenerateOrgJoinCode"
							onsubmit={(event) => {
								if (
									!confirm(
										'Generate a new department code? The old code will stop working for new joiners.'
									)
								) {
									event.preventDefault();
								}
							}}
						>
							<Button type="submit" variant="outline" size="sm">New code</Button>
						</form>
					</div>
				</div>

				{#if form?.error}
					<div class="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
						{form.error}
					</div>
				{/if}

				{#if form?.success && form.inviteUrl}
					<div class="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm dark:border-emerald-900 dark:bg-emerald-950/40">
						<p class="font-medium text-emerald-900 dark:text-emerald-100">Invite ready</p>
						<p class="mt-1 break-all font-mono text-xs text-emerald-900/90 dark:text-emerald-100/90">
							{form.inviteUrl}
						</p>
						<Button class="mt-2" size="sm" variant="outline" type="button" onclick={() => copyText(form.inviteUrl ?? '')}>
							Copy invite link
						</Button>
					</div>
				{/if}

				{#if form?.inviteUrl && !form.success}
					<div class="mt-4 rounded-lg border bg-muted/50 px-4 py-3 text-sm">
						<p class="font-medium">Share this link</p>
						<p class="mt-1 break-all font-mono text-xs">{form.inviteUrl}</p>
						<Button class="mt-2" size="sm" variant="outline" type="button" onclick={() => copyText(form.inviteUrl ?? '')}>
							Copy
						</Button>
					</div>
				{/if}

				<form method="POST" action="?/invite" class="mt-6 space-y-3">
					<label class="text-sm font-medium" for="email">Invite by email</label>
					<div class="flex flex-col gap-2 sm:flex-row">
						<Input
							id="email"
							name="email"
							type="email"
							bind:value={email}
							placeholder="firefighter@department.gov"
							autocomplete="off"
							disabled={!data.canInvite}
							class="flex-1"
						/>
						<Button type="submit" disabled={!data.canInvite || !email.trim()}>Send invite</Button>
					</div>
					<p class="text-xs text-muted-foreground">
						We’ll email a one-click link. You can also copy the link from the confirmation message if email is slow.
					</p>
				</form>
				{#if copyHint}
					<p class="mt-2 text-xs text-muted-foreground">{copyHint}</p>
				{/if}
			</section>

			<section class="rounded-xl border bg-card p-6 shadow-sm">
				<h3 class="text-sm font-semibold">Members</h3>
				<ul class="mt-4 divide-y rounded-lg border">
					{#each data.members as m (m.id)}
						<li class="flex items-center justify-between gap-4 px-4 py-3 text-sm">
							<div class="min-w-0">
								<p class="font-medium">{m.user.name}</p>
								<p class="truncate text-xs text-muted-foreground">{m.user.email}</p>
							</div>
							<Badge variant={m.role === 'owner' ? 'default' : 'outline'}>{m.role}</Badge>
						</li>
					{/each}
				</ul>
			</section>

			{#if data.pendingInvites.length > 0}
				<section class="rounded-xl border bg-card p-6 shadow-sm">
					<h3 class="text-sm font-semibold">Pending invites</h3>
					<ul class="mt-4 space-y-2 text-sm text-muted-foreground">
						{#each data.pendingInvites as inv (inv.id)}
							<li class="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
								<span>{inv.email}</span>
								<span class="text-xs">Expires {inv.expiresAt.toLocaleDateString()}</span>
							</li>
						{/each}
					</ul>
				</section>
			{/if}
		</div>
	{/if}
</div>
