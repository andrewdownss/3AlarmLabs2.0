<script lang="ts">
	import { valueProps } from '$lib/landing/landing-content';
</script>

<section class="py-8">
	<div class="grid gap-4 md:grid-cols-3">
		{#each valueProps as item (item.title)}
			<div class="rounded-none border border-border bg-card p-6 shadow-sm">
				<h2 class="text-xl font-semibold tracking-tight text-foreground">{item.title}</h2>
				<p class="mt-3 text-sm leading-6 text-muted-foreground">{item.description}</p>
			</div>
		{/each}
	</div>
</section>
