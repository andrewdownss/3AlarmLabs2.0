<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import { pricingPaths } from '$lib/landing/landing-content';

	interface Props {
		monthlyPrice: number;
	}

	let { monthlyPrice }: Props = $props();

	const paths = $derived(pricingPaths(monthlyPrice));
</script>

<section id="team-access" class="py-12 sm:py-16" aria-labelledby="pricing-paths-heading">
	<div class="max-w-2xl">
		<p class="text-sm font-semibold tracking-[0.18em] text-muted-foreground uppercase">
			Ways to start
		</p>
		<h2 id="pricing-paths-heading" class="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
			Start free. Upgrade when the reps are helping.
		</h2>
		<p class="mt-4 text-base leading-7 text-muted-foreground">
			Try a scenario at no cost, subscribe as an individual, or request team access for a
			department, academy, or training company.
		</p>
	</div>

	<div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		{#each paths as path (path.id)}
			<article
				class="flex flex-col rounded-none border bg-card p-6 shadow-sm {path.highlight
					? 'border-2 border-[#E85D20]'
					: 'border-border'}"
			>
				<p class="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
					{path.label}
				</p>
				<h3 class="mt-2 text-lg font-semibold tracking-tight text-foreground">{path.title}</h3>
				<p class="mt-3 text-2xl font-bold text-foreground">{path.price}</p>
				<p class="mt-3 flex-1 text-sm leading-6 text-muted-foreground">{path.description}</p>
				<Button
					class="mt-6 w-full rounded-none {path.highlight
						? 'bg-[#E85D20] text-white hover:bg-[#D4501A]'
						: ''}"
					variant={path.highlight ? 'default' : 'outline'}
					href={path.href.startsWith('mailto:') || path.href.startsWith('#')
						? path.href
						: path.href === '/demo'
							? resolve('/demo')
							: path.href === '/signup?next=%2Fapp%2Fstart-individual'
								? '/signup?next=%2Fapp%2Fstart-individual'
								: path.href}
				>
					{path.cta}
				</Button>
			</article>
		{/each}
	</div>
</section>
