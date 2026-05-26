<script lang="ts">
	import { builtWithFireService } from '$lib/landing/landing-content';
</script>

<section class="py-12 sm:py-16">
	<div
		class="rounded-none border border-border bg-card p-8 shadow-sm sm:p-10 lg:grid lg:grid-cols-[1fr_1.1fr] lg:gap-10 lg:items-start"
	>
		<div>
			<p class="text-sm font-semibold tracking-[0.18em] text-muted-foreground uppercase">
				{builtWithFireService.eyebrow}
			</p>
			<h2 class="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
				{builtWithFireService.title}
			</h2>
			<p class="mt-4 text-base leading-7 text-muted-foreground">
				{builtWithFireService.description}
			</p>
		</div>

		<div class="mt-8 space-y-4 lg:mt-0">
			{#each builtWithFireService.partners as partner (partner.id)}
				<div class="rounded-none border border-border bg-muted/30 px-5 py-4">
					<p class="text-sm font-semibold text-foreground">{partner.label}</p>
					<p class="mt-2 text-sm leading-6 text-muted-foreground">{partner.description}</p>
				</div>
			{/each}
		</div>
	</div>
</section>
