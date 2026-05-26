<script lang="ts">
	import { builtForEveryLevel } from '$lib/landing/landing-content';
</script>

<section id="built-for" class="py-12 sm:py-16">
	<div class="max-w-2xl">
		<p class="text-sm font-semibold tracking-[0.18em] text-muted-foreground uppercase">
			Who it is for
		</p>
		<h2 class="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
			From solo reps to department-wide training
		</h2>
		<p class="mt-4 text-base leading-7 text-muted-foreground">
			Preparing to promote? Running academy drills? Teaching command to clients? 3AlarmLabs
			fits the way firefighters actually make time to train.
		</p>
	</div>

	<div class="mt-8 grid gap-4 md:grid-cols-3">
		{#each builtForEveryLevel as card (card.id)}
			<article class="flex flex-col rounded-none border border-border bg-card p-6 shadow-sm">
				<h3 class="text-xl font-semibold tracking-tight text-foreground">{card.title}</h3>
				<p class="mt-3 text-sm leading-6 text-muted-foreground">{card.description}</p>
				<ul class="mt-5 space-y-2 text-sm text-foreground/90">
					{#each card.bullets as bullet (bullet)}
						<li class="flex items-start gap-2">
							<span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#E85D20]"></span>
							{bullet}
						</li>
					{/each}
				</ul>
			</article>
		{/each}
	</div>
</section>
