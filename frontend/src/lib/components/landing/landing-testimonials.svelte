<script lang="ts">
	import { testimonials } from '$lib/landing/landing-content';
</script>

<section class="py-12 sm:py-16" aria-labelledby="testimonials-heading">
	<div class="max-w-2xl">
		<p class="text-sm font-semibold tracking-[0.18em] text-muted-foreground uppercase">
			Field notes
		</p>
		<h2 id="testimonials-heading" class="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
			What firefighters and instructors notice first
		</h2>
	</div>

	<div class="mt-8 grid gap-4 md:grid-cols-2">
		{#each testimonials as item (item.id)}
			<blockquote class="flex h-full flex-col rounded-none border border-border bg-card p-6 shadow-sm">
				<p class="flex-1 text-base leading-7 text-foreground/90">&ldquo;{item.quote}&rdquo;</p>
				<footer class="mt-6 border-t border-border pt-4">
					<p class="text-sm font-semibold text-foreground">{item.name}</p>
					<p class="mt-0.5 text-sm text-muted-foreground">{item.role}</p>
					<p class="text-xs text-muted-foreground">{item.org}</p>
				</footer>
			</blockquote>
		{/each}
	</div>
</section>
