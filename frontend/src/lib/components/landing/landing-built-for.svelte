<script lang="ts">
	import { audienceChips } from '$lib/landing/landing-content';
</script>

<section id="built-for" class="py-20">
	<div
		class="grid gap-10 rounded-none border border-border bg-card p-8 shadow-sm sm:p-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center"
	>
		<div>
			<p class="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Built for</p>
			<h2 class="mt-4 max-w-xl text-3xl font-semibold tracking-tight text-foreground sm:text-5xl">
				Firefighters who want to lead with confidence.
			</h2>
			<p class="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
				Built for firefighters preparing for promotion, acting officers getting more reps, and anyone who wants to become
				more confident running command.
			</p>
		</div>

		<div class="grid grid-cols-2 gap-3">
			{#each audienceChips as item (item)}
				<div class="rounded-none border border-border bg-muted/50 px-5 py-5 text-base font-medium text-foreground/90">
					{item}
				</div>
			{/each}
		</div>
	</div>
</section>
