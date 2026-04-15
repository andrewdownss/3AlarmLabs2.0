<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { authClient } from '$lib/auth-client';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import type { PageData, ActionData } from './$types';

	let { data, form = null }: { data: PageData; form?: ActionData } = $props();

	const token = $derived(page.params.token ?? '');
	const inviteNext = $derived(token ? `/invite/${token}` : '/invite');

	async function signOutAndContinue() {
		try {
			await authClient.signOut();
		} catch (err) {
			console.error('[logout] signOut failed', err);
		}
		const loginPath = resolve('/login');
		window.location.assign(`${loginPath}?next=${encodeURIComponent(inviteNext)}`);
	}
</script>

<svelte:head>
	<title>Organization invite — 3 Alarm Labs</title>
</svelte:head>

<div class="flex min-h-screen w-full items-center justify-center px-4 py-10">
	<Card.Root class="mx-auto w-full max-w-md">
		<Card.Header>
			<Card.Title class="text-2xl">Join a department</Card.Title>
			<Card.Description>
				{#if data.status === 'invalid'}
					This invite link is not valid.
				{:else if data.status === 'expired'}
					This invite to <strong>{data.orgName}</strong> has expired.
				{:else if data.status === 'need_auth'}
					You’ve been invited to join <strong>{data.orgName}</strong>.
				{:else if data.status === 'wrong_account'}
					This invite was sent to a different email than the account you’re using.
				{:else if data.status === 'already_member'}
					You’re already part of <strong>{data.orgName}</strong>.
				{:else if data.status === 'ready'}
					Join <strong>{data.orgName}</strong> with your account.
				{/if}
			</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-4">
			{#if form?.error}
				<div class="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
					{form.error}
				</div>
			{/if}

			{#if data.status === 'invalid'}
				<p class="text-sm text-muted-foreground">Ask your instructor for a new invite link.</p>
				<Button class="w-full" href="/login">Go to log in</Button>
			{:else if data.status === 'expired'}
				<p class="text-sm text-muted-foreground">Ask an organization owner to send a new invitation.</p>
				<Button class="w-full" href="/app/command">Back to Command</Button>
			{:else if data.status === 'need_auth'}
				<p class="text-sm text-muted-foreground">
					This invite is for <span class="font-medium text-foreground">{data.maskedEmail}</span>. Use that email when
					you sign in or create an account.
				</p>
				<div class="flex flex-col gap-2 sm:flex-row">
					<Button class="flex-1 bg-[#E85D20] hover:bg-[#D4501A]" href="/login?next={encodeURIComponent(data.nextPath)}">
						Log in
					</Button>
					<Button class="flex-1" variant="outline" href="/signup?next={encodeURIComponent(data.nextPath)}">
						Create account
					</Button>
				</div>
			{:else if data.status === 'wrong_account'}
				<p class="text-sm text-muted-foreground">
					Sign in as <span class="font-medium text-foreground">{data.expectedEmail}</span> to accept this invite.
				</p>
				<Button type="button" class="w-full" variant="outline" onclick={signOutAndContinue}>
					Sign out and continue
				</Button>
			{:else if data.status === 'already_member'}
				<p class="text-sm text-muted-foreground">You can join instructor-led sessions from Command.</p>
				<Button class="w-full bg-[#E85D20] hover:bg-[#D4501A]" href="/app/command/join">Join a session</Button>
			{:else if data.status === 'ready'}
				<form method="POST" action="?/accept" class="space-y-3">
					<input type="hidden" name="next" value="/app/command/join" />
					<Button type="submit" class="w-full bg-[#E85D20] hover:bg-[#D4501A]">Accept invite</Button>
				</form>
			{/if}
		</Card.Content>
	</Card.Root>
</div>
