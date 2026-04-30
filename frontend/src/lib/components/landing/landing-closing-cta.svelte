<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';

	interface Props {
		monthlyPrice: number;
	}

	let { monthlyPrice }: Props = $props();
	const individualSignupHref = '/signup?next=%2Fapp%2Fstart-individual';
</script>

<section class="py-20">
	<div class="rounded-none border border-border bg-card px-6 py-12 text-center shadow-sm sm:px-10">
		<p class="text-sm font-semibold tracking-[0.18em] text-muted-foreground uppercase">
			Start training
		</p>
		<h2
			class="mx-auto mt-4 max-w-4xl text-4xl font-semibold tracking-tight text-foreground sm:text-6xl"
		>
			Start training for promotion-ready command reps.
		</h2>
		<p class="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
			Get weekly premade simulations, unlimited self-paced reps, and SizeUp practice for ${monthlyPrice}/month
			after your trial.
		</p>

		<div class="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
			<Button
				size="lg"
				class="min-h-11 w-full rounded-none bg-[#E85D20] px-7 text-white hover:bg-[#D4501A] sm:w-auto"
				href={individualSignupHref}
			>
				Start 7-day trial
			</Button>
			<Button
				size="lg"
				variant="outline"
				class="min-h-11 w-full rounded-none sm:w-auto"
				href={resolve('/pricing')}
			>
				See ${monthlyPrice}/month pricing
			</Button>
		</div>
	</div>
</section>
