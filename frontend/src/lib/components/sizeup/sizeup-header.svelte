<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import SearchIcon from '@lucide/svelte/icons/search';

	interface Props {
		sceneCount: number;
		planName: string;
		canCreate: boolean;
		searchQuery: string;
	}

	let { sceneCount, planName, canCreate, searchQuery = $bindable() }: Props = $props();
</script>

<div class="border border-border bg-background/90 px-6 py-6 backdrop-blur-sm sm:px-8 sm:py-7">
	<div class="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
		<div>
			<div class="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
				Scene Management
			</div>
			<h1 class="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">SizeUp Dashboard</h1>
			<p class="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
				{sceneCount} scene{sceneCount === 1 ? '' : 's'}
				<Badge variant="outline" class="ml-1">{planName}</Badge>
			</p>
		</div>
		<div class="flex w-full flex-col gap-3 sm:flex-row xl:w-auto">
			<div class="relative min-w-0 sm:min-w-[300px]">
				<SearchIcon
					class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
				/>
				<Input
					type="search"
					placeholder="Search scenes…"
					class="h-11 w-full pl-10"
					bind:value={searchQuery}
				/>
			</div>
			{#if canCreate}
				<Button class="h-11 shrink-0" href="/app/sizeup/scenes/new">
					<PlusIcon class="mr-1.5 h-4 w-4" />
					New Scene
				</Button>
			{/if}
		</div>
	</div>
</div>
