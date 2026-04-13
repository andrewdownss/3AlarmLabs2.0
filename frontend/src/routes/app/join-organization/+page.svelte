<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
	let code = $state('');

	function normalizeCode(value: string) {
		return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
	}
</script>

<div class="mx-auto flex min-h-[70vh] w-full max-w-md items-center justify-center px-4 py-10">
	<div class="w-full rounded-2xl border bg-card p-6 shadow-sm">
		<div class="space-y-2 text-center">
			<h1 class="text-2xl font-semibold tracking-tight">Join a department</h1>
			<p class="text-sm text-muted-foreground">
				Enter the 5-character code your organization shares (from Team → Department join code).
			</p>
		</div>

		<form method="POST" class="mt-6 space-y-4">
			<div class="space-y-2">
				<label for="code" class="text-sm font-medium">Department code</label>
				<Input
					id="code"
					name="code"
					value={code}
					oninput={(event) => {
						const input = event.currentTarget as HTMLInputElement;
						code = normalizeCode(input.value);
						input.value = code;
					}}
					placeholder="e.g. K7M2P"
					autocomplete="off"
					maxlength={5}
					class="h-12 text-center font-mono text-lg tracking-[0.35em] uppercase"
					required
				/>
			</div>

			{#if form?.error}
				<p class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
					{form.error}
				</p>
			{/if}

			<Button type="submit" class="w-full">Join department</Button>
		</form>

		<p class="mt-6 text-center text-xs text-muted-foreground">
			Invited by email instead?
			<a href="/login" class="font-medium text-foreground underline">Open your invite link</a>
			from your inbox.
		</p>
	</div>
</div>
