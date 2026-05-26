<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import { TEAM_ACCESS_HREF } from '$lib/landing/landing-content';

	interface Props {
		monthlyPrice: number;
	}

	let { monthlyPrice }: Props = $props();
</script>

<section class="py-16 sm:py-20">
	<div class="rounded-none border border-border bg-card px-6 py-12 text-center shadow-sm sm:px-10">
		<p class="text-sm font-semibold tracking-[0.18em] text-muted-foreground uppercase">
			Ready when you are
		</p>
		<h2
			class="mx-auto mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl"
		>
			Get the command reps now, not after the hard call.
		</h2>
		<p class="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
			Run the free scenario today, or explore team access for your department or training
			company. Individual plans start at ${monthlyPrice.toFixed(2)}/month.
		</p>

		<div class="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
			<Button
				size="lg"
				class="min-h-11 w-full rounded-none bg-[#E85D20] px-7 text-white hover:bg-[#D4501A] sm:w-auto"
				href={resolve('/demo')}
			>
				Try the Free Scenario
			</Button>
			<Button
				size="lg"
				variant="outline"
				class="min-h-11 w-full rounded-none px-7 sm:w-auto"
				href={TEAM_ACCESS_HREF}
			>
				Departments & Training Teams
			</Button>
		</div>
	</div>
</section>
