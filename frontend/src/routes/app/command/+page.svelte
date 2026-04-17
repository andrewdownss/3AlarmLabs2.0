<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Spinner } from '$lib/components/ui/spinner';
	import { deserialize } from '$app/forms';
	import { invalidate } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let deletingId = $state<string | null>(null);
	let starting = $state<string | null>(null);

	async function handleDelete(id: string) {
		if (!confirm('Delete this scenario?')) return;
		deletingId = id;
		try {
			const fd = new FormData();
			fd.set('scenarioId', id);
			await fetch('?/deleteScenario', { method: 'POST', body: fd, credentials: 'same-origin' });
			await invalidate('command:scenarios');
		} finally { deletingId = null; }
	}

	async function handleStartSession(scenarioId: string, mode: 'self_practice' | 'instructor_led') {
		if (starting) return;
		starting = `${scenarioId}:${mode}`;
		const fd = new FormData();
		fd.set('scenarioId', scenarioId);
		fd.set('mode', mode);
		try {
			const resp = await fetch('?/startSession', { method: 'POST', body: fd, credentials: 'same-origin' });
			const result = deserialize(await resp.text());
			if (result.type === 'success' && result.data && typeof result.data === 'object' && 'sessionId' in result.data) {
				const sessionId = String((result.data as { sessionId: string }).sessionId);
				if (mode === 'instructor_led') {
					window.location.href = `/app/command/sessions/${sessionId}/instruct`;
				} else {
					window.location.href = `/app/command/sessions/${sessionId}`;
				}
			} else if (result.type === 'failure') {
				const err =
					result.data && typeof result.data === 'object' && 'error' in result.data
						? String((result.data as { error?: string }).error)
						: 'Could not start session';
				alert(err);
			}
		} finally {
			starting = null;
		}
	}

	function formatDate(date: Date | string) {
		return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}
</script>

<svelte:head>
	<title>Command | 3AlarmLabs</title>
	<meta
		name="description"
		content="Build and run firefighter command simulations—self practice, instructor-led sessions, and after-action review."
	/>
</svelte:head>

<main class="mx-auto w-full max-w-5xl px-4 py-6 pb-safe sm:py-10">
	<div class="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
		<div class="min-w-0">
			<h1 class="text-2xl font-semibold tracking-tight sm:text-3xl">Command</h1>
			<p class="mt-1 text-sm text-muted-foreground">Build and run firefighter command simulations.</p>
		</div>
		<div class="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
			<Button variant="outline" class="min-h-11 w-full sm:w-auto" href="/app/command/reviews">Past simulations</Button>
			<Button variant="outline" class="min-h-11 w-full sm:w-auto" href="/app/join-organization">Join department</Button>
			<Button variant="outline" class="min-h-11 w-full sm:w-auto" href="/app/command/join">Join session</Button>
			<Button
				class="col-span-2 min-h-11 w-full sm:col-span-1 sm:w-auto"
				variant={data.canCreateScenario ? 'default' : 'outline'}
				disabled={!data.canCreateScenario}
				href={data.canCreateScenario ? '/app/command/scenarios/new' : resolve('/app/settings/billing')}
			>
				+ New Scenario
			</Button>
		</div>
	</div>

	{#if !data.canCreateScenario}
		<div class="mt-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
			You’ve reached the active scenario limit for the <strong>{data.planConfig.name}</strong> plan.
			<a href={resolve('/app/settings/billing')} class="font-medium underline">Upgrade</a> to create more.
		</div>
	{/if}

	<div class="mt-8 space-y-4">
		{#if data.scenarios.length === 0}
			<div class="rounded-xl border border-dashed border-border p-12 text-center">
				<p class="text-lg font-medium text-muted-foreground">No scenarios yet</p>
				<p class="mt-1 text-sm text-muted-foreground">Create your first command training scenario to get started.</p>
				<Button class="mt-4" href="/app/command/scenarios/new">Create Scenario</Button>
			</div>
		{:else}
			{#each data.scenarios as scenario, index (scenario.id)}
				<div class="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md sm:flex-row sm:items-center">
					<div class="h-40 w-full shrink-0 overflow-hidden rounded-lg bg-muted sm:h-20 sm:w-32">
						{#if scenario.sideAlphaImageUrl}
							<img
								src={scenario.sideAlphaImageUrl}
								alt={scenario.title}
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
						<h2 class="truncate text-lg font-semibold">{scenario.title}</h2>
						{#if scenario.description}
							<p class="mt-0.5 truncate text-sm text-muted-foreground">{scenario.description}</p>
						{/if}
						<div class="mt-2 flex flex-wrap gap-1.5">
							{#if scenario.constructionType}
								<Badge variant="outline">{scenario.constructionType}</Badge>
							{/if}
							{#if scenario.alarmLevel}
								<Badge variant="secondary">{scenario.alarmLevel}</Badge>
							{/if}
							<span class="text-xs text-muted-foreground">{formatDate(scenario.createdAt)}</span>
						</div>
					</div>
					<div class="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:shrink-0 sm:flex-row">
						<Button
							class="min-h-11 w-full sm:w-auto"
							size="sm"
							disabled={starting !== null}
							onclick={() => handleStartSession(scenario.id, 'self_practice')}
						>
							{#if starting === `${scenario.id}:self_practice`}
								<Spinner class="mr-2 h-4 w-4" />
							{/if}
							Self Practice
						</Button>
						{#if data.planConfig.canInstructorLedCommand}
							<Button
								class="min-h-11 w-full sm:w-auto"
								size="sm"
								variant="outline"
								disabled={starting !== null}
								onclick={() => handleStartSession(scenario.id, 'instructor_led')}
							>
								{#if starting === `${scenario.id}:instructor_led`}
									<Spinner class="mr-2 h-4 w-4" />
								{/if}
								Instructor-Led
							</Button>
						{:else}
							<Button
								class="min-h-11 w-full sm:w-auto"
								size="sm"
								variant="outline"
								href={resolve('/app/settings/billing')}
								title="Upgrade to Team or Instructor for instructor-led sessions"
								>Upgrade for Instructor-Led</Button>
						{/if}
						<Button class="min-h-11 w-full sm:w-auto" size="sm" variant="outline" href={`/app/command/scenarios/${scenario.id}`}>Edit</Button>
						<button type="button" onclick={() => handleDelete(scenario.id)} disabled={deletingId === scenario.id} class="inline-flex h-11 w-11 items-center justify-center justify-self-end rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50 sm:h-8 sm:w-8" aria-label="Delete">
							{#if deletingId === scenario.id}
								<Spinner class="h-4 w-4" />
							{:else}
								<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
							{/if}
						</button>
					</div>
				</div>
			{/each}
		{/if}
	</div>
</main>
