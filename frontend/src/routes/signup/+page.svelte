<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	interface ActionData {
		formError?: string;
		fieldErrors?: Record<string, string[]>;
		name?: string;
		email?: string;
		next?: string;
	}

	const actionData = $derived.by(() => page.form as ActionData | null);
	const nextParam = $derived.by(() => actionData?.next ?? page.url.searchParams.get('next') ?? '');
</script>

<svelte:head>
	<title>Sign up — 3 Alarm Labs</title>
</svelte:head>

<div class="flex min-h-[100dvh] w-full items-center justify-center px-4 py-6 pb-safe">
	<Card.Root class="mx-auto w-full max-w-sm">
		<Card.Header>
			<div class="flex items-center gap-1.5 text-base font-bold tracking-tight">
				<span class="h-2 w-2 rounded-full bg-[#E85D20]"></span>
				3 Alarm Labs
			</div>
			<Card.Title class="text-2xl">Create your account</Card.Title>
			<Card.Description>Start building training scenarios for free.</Card.Description>
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
					<label class="text-sm font-medium" for="name">Full name</label>
					<Input id="name" name="name" type="text" placeholder="Chief John Smith" value={actionData?.name ?? ''} required />
					{#if actionData?.fieldErrors?.name}
						<p class="text-xs text-destructive">{actionData.fieldErrors.name[0]}</p>
					{/if}
				</div>
				<div class="space-y-1.5">
					<label class="text-sm font-medium" for="email">Email address</label>
					<Input id="email" name="email" type="email" placeholder="chief@department.gov" value={actionData?.email ?? ''} required />
					{#if actionData?.fieldErrors?.email}
						<p class="text-xs text-destructive">{actionData.fieldErrors.email[0]}</p>
					{/if}
				</div>
				<div class="space-y-1.5">
					<label class="text-sm font-medium" for="password">Password</label>
					<Input id="password" name="password" type="password" required />
					{#if actionData?.fieldErrors?.password}
						<p class="text-xs text-destructive">{actionData.fieldErrors.password[0]}</p>
					{:else}
						<p class="text-xs text-muted-foreground">Minimum 8 characters.</p>
					{/if}
				</div>
				<div class="space-y-1.5">
					<label class="text-sm font-medium" for="confirmPassword">Confirm password</label>
					<Input id="confirmPassword" name="confirmPassword" type="password" required />
					{#if actionData?.fieldErrors?.confirmPassword}
						<p class="text-xs text-destructive">{actionData.fieldErrors.confirmPassword[0]}</p>
					{/if}
				</div>
				<Button type="submit" class="w-full bg-[#E85D20] hover:bg-[#D4501A]">Create account</Button>
			</form>
			<div class="mt-4 text-center text-sm text-muted-foreground">
				Already have an account? <a
					href={resolve(
						(nextParam ? '/login?next=' + encodeURIComponent(nextParam) : '/login') as '/login'
					)}
					class="font-medium text-foreground hover:underline"
				>Log in</a>
			</div>
		</Card.Content>
	</Card.Root>
</div>
