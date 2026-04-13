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

<div class="mx-auto flex min-h-[70dvh] w-full max-w-md items-center justify-center px-4 py-6 pb-safe sm:py-10">
	<div class="w-full rounded-2xl border bg-card p-6 shadow-sm">
		<div class="space-y-2 text-center">
			<h1 class="text-2xl font-semibold tracking-tight">Join Instructor-Led Session</h1>
			<p class="text-sm text-muted-foreground">Enter the 5-character code from your instructor.</p>
		</div>

		<form method="POST" class="mt-6 space-y-4">
			<div class="space-y-2">
				<label for="code" class="text-sm font-medium">Join Code</label>
				<Input
					id="code"
					name="code"
					value={code}
					oninput={(event) => {
						const input = event.currentTarget as HTMLInputElement;
						code = normalizeCode(input.value);
						input.value = code;
					}}
					placeholder="A3X9K"
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

			<Button type="submit" class="w-full">Join Session</Button>
		</form>

		<div class="mt-6 rounded-lg border bg-muted/40 px-4 py-3 text-left text-xs text-muted-foreground">
			<p class="font-medium text-foreground">Need to join the department first?</p>
			<p class="mt-1">
				Use the <a href="/app/join-organization" class="font-medium text-foreground underline">5-character department code</a>
				from your instructor, or open the email invite from <strong>Team</strong>. Then return here with the session
				code.
			</p>
		</div>
	</div>
</div>
