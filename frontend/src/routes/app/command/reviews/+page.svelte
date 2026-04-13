<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function formatDateTime(d: Date | string) {
		return new Date(d).toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	function roleForSession(session: (typeof data.sessions)[number]): string | null {
		if (session.mode === 'self_practice') return null;
		if (session.instructorId === data.userId) return 'Instructor';
		return 'Student';
	}
</script>

<svelte:head>
	<title>Past simulations | 3AlarmLabs</title>
	<meta
		name="description"
		content="Review previous command training sessions: timeline, radio traffic, and final command board."
	/>
</svelte:head>

<main class="mx-auto w-full max-w-5xl px-4 py-6 pb-safe sm:py-10">
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div class="min-w-0">
			<h1 class="text-2xl font-semibold tracking-tight sm:text-3xl">Past simulations</h1>
			<p class="mt-1 text-sm text-muted-foreground">
				Open a session to see the timeline, radio, and command board.
			</p>
		</div>
		<Button variant="outline" class="min-h-11 w-full shrink-0 sm:w-auto" href="/app/command">Back to Command</Button>
	</div>

	<div class="mt-8 space-y-4">
		{#if data.sessions.length === 0}
			<div class="rounded-xl border border-dashed border-border p-12 text-center">
				<p class="text-lg font-medium text-muted-foreground">No simulations yet</p>
				<p class="mt-1 text-sm text-muted-foreground">
					Run a scenario from Command, then return here to review it.
				</p>
				<Button class="mt-4" href="/app/command">Go to Command</Button>
			</div>
		{:else}
			{#each data.sessions as session, index (session.id)}
				{@const roleLabel = roleForSession(session)}
				<div class="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center">
					<div class="h-24 w-full shrink-0 overflow-hidden rounded-lg bg-muted sm:h-20 sm:w-32">
						{#if session.scenario?.sideAlphaImageUrl}
							<img
								src={session.scenario.sideAlphaImageUrl}
								alt={session.scenario.title}
								class="h-full w-full object-cover"
								width="128"
								height="80"
								sizes="(max-width: 639px) 100vw, 128px"
								decoding="async"
								loading={index === 0 ? 'eager' : 'lazy'}
								fetchpriority={index === 0 ? 'high' : undefined}
							/>
						{:else}
							<div class="flex h-full w-full items-center justify-center text-2xl text-muted-foreground">🏠</div>
						{/if}
					</div>
					<div class="min-w-0 flex-1">
						<h2 class="text-lg font-semibold leading-tight">
							{session.scenario?.title ?? 'Unknown scenario'}
						</h2>
						<p class="mt-1 text-sm text-muted-foreground">{formatDateTime(session.startedAt)}</p>
						<div class="mt-2 flex flex-wrap gap-1.5">
							<Badge variant="outline">
								{session.mode === 'self_practice' ? 'Self practice' : 'Instructor-led'}
							</Badge>
							{#if roleLabel}
								<Badge variant="secondary">{roleLabel}</Badge>
							{/if}
							{#if session.endedAt}
								<Badge variant="outline" class="border-green-200 bg-green-50 text-green-900">Completed</Badge>
							{:else}
								<Badge variant="outline" class="border-amber-200 bg-amber-50 text-amber-900">In progress</Badge>
							{/if}
						</div>
					</div>
					<div class="w-full shrink-0 sm:w-auto">
						<Button class="min-h-11 w-full sm:w-auto" href="/app/command/sessions/{session.id}/review">Open review</Button>
					</div>
				</div>
			{/each}
		{/if}
	</div>
</main>
