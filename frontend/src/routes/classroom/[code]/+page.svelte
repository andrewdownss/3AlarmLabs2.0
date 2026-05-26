<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
	<title>{data.classroom?.name ?? 'Join classroom'} | 3AlarmLabs</title>
</svelte:head>

<main class="flex min-h-dvh items-start justify-center bg-background px-4 py-10 sm:py-16">
	<section class="w-full max-w-md">
		<div class="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
			<div class="text-center">
				<p class="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
					3AlarmLabs Classroom
				</p>
				{#if data.classroom}
					<p class="mt-2 font-mono text-base font-bold tracking-[0.35em] text-foreground">
						{data.code}
					</p>
					<h1 class="mt-2 text-2xl font-semibold sm:text-3xl">{data.classroom.name}</h1>
					<p class="mt-2 text-sm text-muted-foreground">
						Pick a display name so the instructor can call on you.
					</p>
				{:else}
					<h1 class="mt-2 text-2xl font-semibold sm:text-3xl">Classroom not found</h1>
					<p class="mt-2 text-sm text-muted-foreground">
						We couldn't find an active classroom with code <span class="font-mono font-semibold"
							>{data.code}</span
						>.
					</p>
				{/if}
			</div>

			{#if data.classroom}
				<form method="POST" use:enhance class="mt-6 flex flex-col gap-4">
					<label class="flex flex-col gap-2 text-sm font-medium" for="display-name">
						Display name
						<Input
							id="display-name"
							name="displayName"
							required
							minlength={2}
							maxlength={24}
							placeholder="e.g. Smith, Truck 2"
							class="h-12 text-base"
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
						Join classroom
					</Button>
				</form>

				<p class="mt-6 text-center text-xs leading-5 text-muted-foreground">
					Keep Zoom open for instructor audio. The simulation appears on the next screen — controls
					unlock when the instructor calls on you.
				</p>
			{:else}
				<div class="mt-6 flex flex-col gap-3">
					<Button href="/classroom/join" size="lg" class="min-h-12 text-base font-semibold">
						Try a different code
					</Button>
				</div>
			{/if}
		</div>
	</section>
</main>
