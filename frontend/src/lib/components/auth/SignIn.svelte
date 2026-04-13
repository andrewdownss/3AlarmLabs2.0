<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { FieldGroup, Field, FieldLabel } from '$lib/components/ui/field/index.js';

	// field errors type
	// email: string[]
	// password: string[]

	//This is the sign in form component
	

	type FieldErrors = {
		email?: string[];
		password?: string[];
	};

	let {
		fieldErrors = {},
		formError
	}: {
		fieldErrors?: FieldErrors;
		formError?: string;
	} = $props();

	const id = $props.id();
</script>

<Card.Root class="mx-auto w-full max-w-sm">
	<Card.Header>
		<Card.Title class="text-2xl">Login</Card.Title>
		<Card.Description>Enter your email below to login to your account</Card.Description>
	</Card.Header>
	<Card.Content>
		{#if formError}
			<p class="mb-3 text-sm text-destructive">{formError}</p>
		{/if}
		<form method="POST">
			<FieldGroup>
				<Field>
					<FieldLabel for="email-{id}">Email</FieldLabel>
					<Input id="email-{id}" name="email" type="email" placeholder="m@example.com" required />
					{#if fieldErrors.email?.length}
						<p class="mt-1 text-sm text-destructive">{fieldErrors.email[0]}</p>
					{/if}
				</Field>
			<Field>
				<div class="flex items-center justify-between">
					<FieldLabel for="password-{id}">Password</FieldLabel>
					
				</div>
				<Input id="password-{id}" name="password" type="password" required />
				{#if fieldErrors.password?.length}
					<p class="mt-1 text-sm text-destructive">{fieldErrors.password[0]}</p>
				{/if}
			</Field>
				<Field>
					<Button type="submit" class="w-full">Login</Button>
				</Field>
			</FieldGroup>
		</form>
		<div class="mt-4 text-center text-sm text-muted-foreground">
			Don't have an account?
			<a href="/signup" class="font-medium text-foreground hover:underline">Sign up free</a>
		</div>
		<div class="mt-2 text-center text-sm text-muted-foreground">
			<a href="/forgot-password" class="hover:underline">Forgot password?</a>
		</div>
	</Card.Content>
</Card.Root>
