<script lang="ts">
	import { deserialize } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Spinner } from '$lib/components/ui/spinner';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let searchQuery = $state('');
	let starting = $state<string | null>(null);
	let deletingId = $state<string | null>(null);

	const filteredScenarios = $derived.by(() => {
		const q = searchQuery.trim().toLowerCase();
		if (!q) return data.scenarios;
		return data.scenarios.filter((scenario) =>
			`${scenario.title} ${scenario.description ?? ''}`.toLowerCase().includes(q)
		);
	});

	const publishedScenarios = $derived(filteredScenarios.filter((s) => s.status === 'published'));
	const scheduledScenarios = $derived(filteredScenarios.filter((s) => s.status === 'scheduled'));
	const draftScenarios = $derived(filteredScenarios.filter((s) => s.status === 'draft'));

	function formatDate(date: Date | string | null | undefined) {
		if (!date) return 'Not scheduled';
		return new Date(date).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	async function handleStartSession(scenarioId: string) {
		if (starting) return;
		starting = scenarioId;
		const fd = new FormData();
		fd.set('scenarioId', scenarioId);
		fd.set('mode', 'self_practice');

		try {
			const resp = await fetch('/app/command?/startSession', {
				method: 'POST',
				body: fd,
				credentials: 'same-origin'
			});
			const result = deserialize(await resp.text());
			if (
				result.type === 'success' &&
				result.data &&
				typeof result.data === 'object' &&
				'sessionId' in result.data
			) {
				window.location.href = `/app/command/sessions/${String((result.data as { sessionId: string }).sessionId)}`;
				return;
			}
			if (result.type === 'failure') {
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

	async function handleDeleteScenario(scenarioId: string) {
		if (
			!confirm(
				'Delete this 3AlarmLabs library scenario? This also deletes any past sessions tied to it.'
			)
		) {
			return;
		}

		deletingId = scenarioId;
		const fd = new FormData();
		fd.set('scenarioId', scenarioId);
		try {
			const resp = await fetch('?/deleteLibraryScenario', {
				method: 'POST',
				body: fd,
				credentials: 'same-origin'
			});
			if (!resp.ok) {
				alert('Could not delete library scenario.');
				return;
			}
			await invalidateAll();
		} finally {
			deletingId = null;
		}
	}
</script>

<svelte:head>
	<title>3AlarmLabs Library | Command</title>
	<meta
		name="description"
		content="Premade self-paced firefighter command simulations by 3AlarmLabs."
	/>
</svelte:head>

<main class="pb-safe mx-auto w-full max-w-6xl px-4 py-6 sm:py-10">
	<div class="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
		<div class="min-w-0">
			<p class="text-sm font-medium text-muted-foreground">
				<a href="/app/command" class="hover:underline">Command</a>
				<span class="mx-1">/</span>
				<span>3AlarmLabs Library</span>
			</p>
			<div class="mt-3 flex flex-wrap items-center gap-2">
				<h1 class="text-2xl font-semibold tracking-tight sm:text-3xl">3AlarmLabs Library</h1>
				<Badge variant="secondary">BY 3ALARMLABS</Badge>
			</div>
			<p class="mt-2 max-w-2xl text-sm text-muted-foreground">
				Premade self-paced simulations from 3AlarmLabs. Run them as many times as you want, or use
				them as references when you author your own.
			</p>
		</div>

		<div class="flex flex-col gap-2 sm:flex-row">
			<Button variant="outline" href="/app/command">Back to Command</Button>
			{#if data.user.isAdmin}
				<form method="POST" action="?/createLibraryScenario">
					<Button type="submit">+ New library scenario</Button>
				</form>
			{/if}
		</div>
	</div>

	<div class="mt-8">
		<Input bind:value={searchQuery} placeholder="Search library simulations..." class="max-w-xl" />
	</div>

	{#snippet scenarioCard(scenario: (typeof data.scenarios)[number], index: number)}
		<div
			class="flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md"
		>
			<div class="h-40 bg-muted">
				{#if scenario.sideAlphaImageUrl}
					<img
						src={scenario.sideAlphaImageUrl}
						alt={scenario.title}
						class="h-full w-full object-cover"
						width="384"
						height="160"
						loading={index === 0 ? 'eager' : 'lazy'}
						decoding="async"
					/>
				{:else}
					<div
						class="flex h-full w-full items-center justify-center text-3xl text-muted-foreground"
					>
						3A
					</div>
				{/if}
			</div>
			<div class="flex flex-1 flex-col p-4">
				<div class="flex flex-wrap items-center gap-2">
					<Badge variant="secondary">BY 3ALARMLABS</Badge>
					{#if scenario.isNewThisWeek}
						<Badge variant="outline">New this week</Badge>
					{/if}
					{#if data.user.isAdmin && scenario.status !== 'published'}
						<Badge variant={scenario.status === 'scheduled' ? 'outline' : 'secondary'}>
							{scenario.status === 'scheduled' ? 'Scheduled' : 'Draft'}
						</Badge>
					{/if}
				</div>

				<h2 class="mt-3 line-clamp-2 text-lg leading-tight font-semibold">{scenario.title}</h2>
				{#if scenario.description}
					<p class="mt-1 line-clamp-2 text-sm text-muted-foreground">{scenario.description}</p>
				{/if}
				<div class="mt-3 flex flex-wrap gap-1.5">
					{#if scenario.constructionType}
						<Badge variant="outline">{scenario.constructionType}</Badge>
					{/if}
					{#if scenario.alarmLevel}
						<Badge variant="secondary">{scenario.alarmLevel}</Badge>
					{/if}
					<span class="text-xs text-muted-foreground">{formatDate(scenario.publishedAt)}</span>
				</div>

				<div class="mt-auto flex flex-col gap-2 pt-5">
					{#if data.user.isAdmin}
						<div class="grid grid-cols-2 gap-2">
							<Button
								class="w-full"
								disabled={starting !== null || scenario.status !== 'published'}
								onclick={() => handleStartSession(scenario.id)}
							>
								{#if starting === scenario.id}
									<Spinner class="mr-2 h-4 w-4" />
								{/if}
								Self Practice
							</Button>
							<Button
								variant="outline"
								class="w-full"
								href={`/app/command/scenarios/${scenario.id}`}
							>
								Edit
							</Button>
						</div>
						<Button
							variant="destructive"
							class="w-full"
							disabled={deletingId === scenario.id}
							onclick={() => handleDeleteScenario(scenario.id)}
						>
							{deletingId === scenario.id ? 'Deleting...' : 'Delete'}
						</Button>
					{:else}
						<Button
							class="w-full"
							disabled={starting !== null || scenario.status !== 'published'}
							onclick={() => handleStartSession(scenario.id)}
						>
							{#if starting === scenario.id}
								<Spinner class="mr-2 h-4 w-4" />
							{/if}
							Self Practice
						</Button>
					{/if}
				</div>
			</div>
		</div>
	{/snippet}

	{#if filteredScenarios.length === 0}
		<div class="mt-8 rounded-xl border border-dashed border-border p-12 text-center">
			<p class="text-lg font-medium text-muted-foreground">
				{searchQuery ? 'No simulations match your search' : 'No library simulations yet'}
			</p>
			<p class="mt-1 text-sm text-muted-foreground">
				{#if data.user.isAdmin}
					Create a draft library scenario to start building the next 3AlarmLabs simulation.
				{:else}
					Check back soon for new premade simulations by 3AlarmLabs.
				{/if}
			</p>
		</div>
	{:else if data.user.isAdmin}
		<div class="mt-8 space-y-10">
			{#if draftScenarios.length > 0}
				<section>
					<h2 class="text-sm font-semibold tracking-[0.18em] text-muted-foreground uppercase">
						Drafts
					</h2>
					<div class="mt-4 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
						{#each draftScenarios as scenario, index (scenario.id)}
							{@render scenarioCard(scenario, index)}
						{/each}
					</div>
				</section>
			{/if}

			{#if scheduledScenarios.length > 0}
				<section>
					<h2 class="text-sm font-semibold tracking-[0.18em] text-muted-foreground uppercase">
						Scheduled
					</h2>
					<div class="mt-4 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
						{#each scheduledScenarios as scenario, index (scenario.id)}
							{@render scenarioCard(scenario, index)}
						{/each}
					</div>
				</section>
			{/if}

			{#if publishedScenarios.length > 0}
				<section>
					<h2 class="text-sm font-semibold tracking-[0.18em] text-muted-foreground uppercase">
						Published
					</h2>
					<div class="mt-4 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
						{#each publishedScenarios as scenario, index (scenario.id)}
							{@render scenarioCard(scenario, index)}
						{/each}
					</div>
				</section>
			{/if}
		</div>
	{:else}
		<section class="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
			{#each publishedScenarios as scenario, index (scenario.id)}
				{@render scenarioCard(scenario, index)}
			{/each}
		</section>
	{/if}
</main>
