<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { proofPoints } from '$lib/landing/landing-content';
	interface Props {
		monthlyPrice: number;
	}

	let { monthlyPrice }: Props = $props();
	const individualSignupHref = '/signup?next=%2Fapp%2Fstart-individual';
</script>

<section class="mx-auto max-w-5xl pt-12 pb-16 text-center sm:pt-20">
	<div
		class="mx-auto inline-flex items-center rounded-none border border-border bg-card px-4 py-2 text-xs font-medium text-muted-foreground"
	>
		Self-paced command training for firefighters preparing to lead
	</div>

	<h1
		class="mx-auto mt-6 max-w-4xl text-4xl font-semibold tracking-tight text-foreground sm:text-6xl lg:text-7xl"
	>
		Practice command on your own time.
	</h1>

	<p class="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
		Get weekly premade simulations, unlimited self-paced command reps, and SizeUp practice built for
		firefighters who want to promote and lead with confidence.
	</p>

	<div class="mt-8 flex flex-col items-center justify-center gap-3">
		<Button
			size="lg"
			class="min-h-12 w-full rounded-none bg-[#E85D20] px-8 text-base text-white hover:bg-[#D4501A] sm:w-auto"
			href={individualSignupHref}
		>
			Start 7-day trial
		</Button>
		<p class="text-sm text-muted-foreground">${monthlyPrice}/month after trial. Cancel anytime.</p>
	</div>

	<div class="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
		{#each proofPoints as item, index (item)}
			<span>{item}</span>
			{#if index < proofPoints.length - 1}
				<span class="hidden h-1 w-1 rounded-full bg-muted-foreground/35 sm:inline-block"></span>
			{/if}
		{/each}
	</div>

	<div class="mt-12 rounded-none border border-border bg-card p-4 shadow-sm">
		<img
			src="https://hero.3alarmlabs.com/Ind-View.png"
			alt="Hero video"
			width="1000"
			height="1000"
		/>
	</div>
</section>
