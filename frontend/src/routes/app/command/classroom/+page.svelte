<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
	<title>Classrooms | Command</title>
</svelte:head>

<main class="mx-auto flex max-w-5xl flex-col gap-6 p-4 md:p-8">
	<section class="rounded-3xl border bg-card p-6 shadow-sm">
		<p class="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">Command Classroom</p>
		<h1 class="mt-2 text-3xl font-bold">Live training classrooms</h1>
		<p class="mt-2 max-w-2xl text-muted-foreground">
			Create a classroom code for anonymous students, load simulations, and call on one student at a time.
		</p>
	</section>

	{#if !data.canHostClassroom}
		<section class="rounded-3xl border border-amber-300 bg-amber-50 p-6 text-amber-950">
			<h2 class="text-xl font-bold">Classroom mode is not included on {data.planName}</h2>
			<p class="mt-2">Upgrade to Medium Firehouse, Large Firehouse, or Training Company to host classrooms.</p>
		</section>
	{:else}
		<section class="rounded-3xl border bg-card p-6 shadow-sm">
			<h2 class="text-xl font-bold">Create classroom</h2>
			<form method="POST" action="?/create" use:enhance class="mt-4 flex flex-col gap-3 sm:flex-row">
				<input
					name="name"
					placeholder="e.g. Monday night company drill"
					class="min-w-0 flex-1 rounded-xl border bg-background px-4 py-3"
				/>
				<button type="submit" class="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground">
					Start classroom
				</button>
			</form>
			{#if form?.error}
				<p class="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
					{form.error}
				</p>
			{/if}
			<p class="mt-3 text-sm text-muted-foreground">Your plan supports up to {data.maxClassroomSeats} connected students.</p>
		</section>
	{/if}

	<section class="rounded-3xl border bg-card p-6 shadow-sm">
		<h2 class="text-xl font-bold">Active classrooms</h2>
		<div class="mt-4 grid gap-3">
			{#each data.classrooms as classroom}
				<a
					href={`/app/command/classroom/${classroom.id}`}
					class="rounded-2xl border p-4 transition hover:border-primary"
				>
					<div class="flex items-center justify-between gap-3">
						<div>
							<h3 class="font-semibold">{classroom.name}</h3>
							<p class="text-sm text-muted-foreground">Code {classroom.code}</p>
						</div>
						<span class="rounded-full bg-muted px-3 py-1 text-sm">Open</span>
					</div>
				</a>
			{:else}
				<p class="text-muted-foreground">No active classrooms yet.</p>
			{/each}
		</div>
	</section>
</main>
