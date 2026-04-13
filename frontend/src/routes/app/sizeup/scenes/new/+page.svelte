<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { page } from '$app/state';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let title = $state('');
	let isSubmitting = $state(false);

	const actionData = $derived.by(() => page.form as { formError?: string; fieldErrors?: Record<string, string[]> } | null);
</script>

<svelte:head>
	<title>New Scene | SizeUp | 3AlarmLabs</title>
</svelte:head>

<main class="mx-auto max-w-xl px-4 py-8">
	<div class="mb-6">
		<Button variant="ghost" size="sm" href="/app/sizeup">
			&larr; Back to Dashboard
		</Button>
	</div>

	<div class="mb-4 flex items-center gap-2">
		<Badge variant="outline">Step 1 of 3</Badge>
		<span class="text-sm text-muted-foreground">Name your scene</span>
	</div>

	<Card>
		<CardHeader>
			<CardTitle>Create a New Scene</CardTitle>
		</CardHeader>
		<CardContent>
			<form method="POST" class="flex flex-col gap-4">
				<div>
					<label for="scene-title" class="mb-1.5 block text-sm font-medium">
						Scene Title
					</label>
					<Input
						id="scene-title"
						name="title"
						placeholder="e.g. 123 Main St — 2-story residential"
						required
						bind:value={title}
					/>
				</div>

			{#if actionData?.formError}
				<p class="text-sm text-destructive">{actionData.formError}</p>
			{/if}

				<div class="flex items-center justify-end gap-3">
					<Button variant="outline" href="/app/sizeup">Cancel</Button>
					<Button type="submit" disabled={!title.trim() || isSubmitting}>
						{isSubmitting ? 'Creating…' : 'Continue'}
					</Button>
				</div>
			</form>
		</CardContent>
	</Card>
</main>
