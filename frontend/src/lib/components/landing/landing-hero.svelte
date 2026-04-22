<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import { proofPoints } from '$lib/landing/landing-content';
	interface Props {
		monthlyPrice: number;
	}

	let { monthlyPrice }: Props = $props();
</script>

<section class="mx-auto max-w-5xl pb-16 pt-10 text-center sm:pt-16">
	<div
		class="mx-auto inline-flex items-center rounded-none border border-border bg-card px-4 py-2 text-xs font-medium text-muted-foreground shadow-sm"
	>
		Self-paced command training for firefighters preparing to lead
	</div>

	<h1 class="mx-auto mt-6 max-w-4xl text-4xl font-semibold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
		Practice command on your own time.
	</h1>

	<p class="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
		Get full access for ${monthlyPrice}/month and train with self-paced command scenarios built for firefighters who want
		more reps, stronger radio communication, and more confidence running command.
	</p>

	<div class="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
		<Button
			size="lg"
			class="min-h-11 w-full rounded-none bg-[#E85D20] px-6 text-white hover:bg-[#D4501A] sm:w-auto"
			href={resolve('/signup')}
		>
			Start for ${monthlyPrice}/month
		</Button>
		<Button size="lg" variant="outline" class="min-h-11 w-full rounded-none sm:w-auto" href={resolve('/pricing')}>
			See ${monthlyPrice}/month pricing
		</Button>
	</div>

	<div class="mt-6 flex flex-wrap items-center justify-center gap-2">
		<div class="rounded-none border border-border bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm">
			${monthlyPrice}/month
		</div>
		{#each proofPoints as item (item)}
			<div class="rounded-none border border-border bg-card px-4 py-2 text-sm text-muted-foreground shadow-sm">
				{item}
			</div>
		{/each}
	</div>

	<div class="mt-12 rounded-none border border-border bg-card p-4 shadow-sm">
		<img src="https://hero.3alarmlabs.com/Ind-View.png" alt="Hero video" width="1000" height="1000" />
	</div>
</section>
