<script lang="ts">
	import { howItWorks } from '$lib/landing/landing-content';
</script>

<section id="how-it-works" class="py-8">
	<div class="max-w-2xl">
		<p class="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">How it works</p>
		<h2 class="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
			Simple, repeatable, built for reps.
		</h2>
	</div>

	<div class="mt-8 grid gap-4 md:grid-cols-3">
		{#each howItWorks as item (item.step)}
			<div class="rounded-none border border-border bg-card p-6 shadow-sm">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-none bg-primary text-xs font-semibold text-primary-foreground"
				>
					{item.step}
				</div>
				<h3 class="mt-5 text-lg font-semibold text-foreground">{item.title}</h3>
				<p class="mt-3 text-sm leading-6 text-muted-foreground">{item.description}</p>
			</div>
		{/each}
	</div>
</section>
