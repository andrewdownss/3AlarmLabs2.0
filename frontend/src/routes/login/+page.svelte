<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	interface ActionData {
		formError?: string;
		fieldErrors?: Record<string, string[]>;
	}

	interface ExtendedActionData extends ActionData {
		next?: string;
	}

	const actionData = $derived.by(() => page.form as ExtendedActionData | null);
	const nextParam = $derived.by(() => actionData?.next ?? page.url.searchParams.get('next') ?? '');
</script>

<svelte:head>
	<title>Log in — 3 Alarm Labs</title>
</svelte:head>

<div class="flex min-h-[100dvh] w-full items-center justify-center px-4 py-6 pb-safe">
	<Card.Root class="mx-auto w-full max-w-sm">
		<Card.Header>
			<div class="flex items-center gap-1.5 text-base font-bold tracking-tight">
				<span class="h-2 w-2 rounded-full bg-[#E85D20]"></span>
				3 Alarm Labs
			</div>
			<Card.Title class="text-2xl">Welcome back</Card.Title>
			<Card.Description>Log in to your account to continue.</Card.Description>
		</Card.Header>
		<Card.Content>
			{#if actionData?.formError}
				<div class="mb-4 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
					{actionData.formError}
				</div>
			{/if}
			<form method="POST" class="space-y-4">
				{#if nextParam}
					<input type="hidden" name="next" value={nextParam} />
				{/if}
				<div class="space-y-1.5">
					<label class="text-sm font-medium" for="email">Email address</label>
					<Input id="email" name="email" type="email" placeholder="chief@department.gov" required />
					{#if actionData?.fieldErrors?.email}
						<p class="text-xs text-destructive">{actionData.fieldErrors.email[0]}</p>
					{/if}
				</div>
				<div class="space-y-1.5">
					<label class="text-sm font-medium" for="password">Password</label>
					<Input id="password" name="password" type="password" required />
					{#if actionData?.fieldErrors?.password}
						<p class="text-xs text-destructive">{actionData.fieldErrors.password[0]}</p>
					{/if}
				</div>
				<Button type="submit" class="w-full bg-[#E85D20] hover:bg-[#D4501A]">Log in</Button>
			</form>
			<div class="mt-4 text-center text-sm text-muted-foreground">
				Don't have an account? <a
					href={resolve(
						(nextParam ? '/signup?next=' + encodeURIComponent(nextParam) : '/signup') as '/signup'
					)}
					class="font-medium text-foreground hover:underline"
				>Sign up</a>
			</div>
		</Card.Content>
	</Card.Root>
</div>
