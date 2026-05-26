<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let code = $state(data.prefilledCode);

	function normalizeCode(value: string) {
		return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
	}
</script>

<svelte:head>
	<title>Join Classroom | 3AlarmLabs</title>
</svelte:head>

<main class="flex min-h-[100dvh] items-start justify-center bg-background px-4 py-10 sm:py-16">
	<section class="w-full max-w-md">
		<div class="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
			<div class="text-center">
				<p class="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
					3AlarmLabs Classroom
				</p>
				<h1 class="mt-2 text-2xl font-semibold sm:text-3xl">Join a classroom</h1>
				<p class="mt-2 text-sm text-muted-foreground">
					Enter the 5-character code from your instructor.
				</p>
			</div>

			<form method="POST" use:enhance class="mt-6 flex flex-col gap-4">
				<label class="flex flex-col gap-2 text-sm font-medium" for="classroom-code">
					Classroom code
					<input
						id="classroom-code"
						name="code"
						bind:value={code}
						oninput={(event) => {
							const input = event.currentTarget as HTMLInputElement;
							code = normalizeCode(input.value);
							input.value = code;
						}}
						placeholder="A3X9K"
						autocomplete="off"
						maxlength="5"
						required
						class="h-14 rounded-md border bg-background px-4 text-center font-mono text-2xl uppercase tracking-[0.4em] outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
					/>
				</label>

				{#if form?.error}
					<p
						class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
					>
						{form.error}
					</p>
				{/if}

				<Button type="submit" size="lg" class="min-h-12 text-base font-semibold">
					Continue
				</Button>
			</form>

			<p class="mt-6 text-center text-xs leading-5 text-muted-foreground">
				No account needed. On the next screen you'll enter a display name, then watch the
				simulation while keeping Zoom open for instructor audio.
			</p>
		</div>
	</section>
</main>
