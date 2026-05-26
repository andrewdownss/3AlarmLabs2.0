<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import { freeScenarioSection } from '$lib/landing/landing-content';
</script>

<section id="free-scenario" class="py-12 sm:py-16">
	<article class="rounded-none border border-border bg-card p-6 shadow-sm sm:p-8 lg:p-10">
		<div class="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
			<div>
				<p class="text-sm font-semibold tracking-[0.18em] text-muted-foreground uppercase">
					{freeScenarioSection.eyebrow}
				</p>
				<h2 class="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
					{freeScenarioSection.title}
				</h2>
				<p class="mt-4 text-base leading-7 text-muted-foreground">
					{freeScenarioSection.description}
				</p>
				<ul class="mt-6 space-y-2.5">
					{#each freeScenarioSection.bullets as bullet (bullet)}
						<li class="flex items-start gap-2.5 text-sm text-foreground/90">
							<span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#E85D20]"></span>
							{bullet}
						</li>
					{/each}
				</ul>
			</div>

			<div class="flex flex-col items-start gap-4 rounded-none border border-border bg-muted/30 p-6">
				<p class="text-sm font-semibold text-foreground">Residential Working Fire</p>
				<p class="text-sm leading-6 text-muted-foreground">
					Two-story residential, smoke showing from Side Alpha. Work the size-up, assign units,
					keep up with changing conditions, and finish with an after-action review.
				</p>
				<Button
					size="lg"
					class="min-h-12 w-full rounded-none bg-[#E85D20] text-white hover:bg-[#D4501A] sm:w-auto"
					href={resolve('/demo')}
				>
					{freeScenarioSection.cta}
				</Button>
				<p class="text-xs text-muted-foreground">{freeScenarioSection.radioNote}</p>
				<p class="text-xs text-muted-foreground">No account required to get started.</p>
			</div>
		</div>
	</article>
</section>
