<script lang="ts">
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';

	let { form } = $props<{ form?: { error?: string } }>();
</script>

<svelte:head>
	<title>Set up organization — 3 Alarm Labs</title>
</svelte:head>

<div class="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center gap-8 px-4 py-12">
	<div>
		<h1 class="text-2xl font-semibold tracking-tight">Create your organization</h1>
		<p class="mt-2 text-sm text-muted-foreground">
			Choose a name for your crew or department. You can invite members from Team settings after you subscribe to a
			paid plan.
		</p>
	</div>

	<form method="POST" use:enhance class="flex flex-col gap-4">
		<div class="space-y-2">
			<Label for="name">Organization name</Label>
			<Input id="name" name="name" type="text" required placeholder="Engine 1 / Training Dept" maxlength={120} />
		</div>

		{#if form?.error}
			<p class="text-sm text-destructive">{form.error}</p>
		{/if}

		<Button type="submit" class="w-full">Create and continue</Button>
	</form>

	<div class="relative">
		<div class="absolute inset-0 flex items-center">
			<span class="w-full border-t border-border"></span>
		</div>
		<div class="relative flex justify-center text-xs uppercase">
			<span class="bg-background px-2 text-muted-foreground">Or</span>
		</div>
	</div>

	<p class="text-center text-sm text-muted-foreground">
		Joining an existing department?
		<a href={resolve('/app/join-organization')} class="font-medium text-foreground underline">Enter department code</a>
	</p>
</div>
