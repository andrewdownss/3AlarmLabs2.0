<script lang="ts">
	import { whyBullets } from '$lib/landing/landing-content';
</script>

<section class="grid gap-10 py-20 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
	<div class="rounded-none border border-border bg-card p-4 shadow-sm">
		<img src="https://hero.3alarmlabs.com/review.png" alt="Review" width="1000" height="1000" />
	</div>

	<div>
		<p class="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Why firefighters use it</p>
		<h2 class="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-5xl">
			Train for promotion. Build confidence. Get more reps.
		</h2>
		<div class="mt-6 space-y-3">
			{#each whyBullets as line (line)}
				<div class="rounded-none border border-border bg-card px-5 py-4 text-sm text-foreground/90 shadow-sm">
					{line}
				</div>
			{/each}
		</div>
	</div>
</section>
