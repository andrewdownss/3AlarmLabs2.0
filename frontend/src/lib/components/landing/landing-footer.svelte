<script lang="ts">
	import { base, resolve } from '$app/paths';
	import { seoLinks } from '$lib/landing/landing-content';

	const linkClass = 'text-sm text-muted-foreground transition hover:text-foreground';
</script>

<footer class="border-t border-border py-14">
	<div class="grid gap-10 lg:grid-cols-[1.2fr_2fr]">
		<div>
			<p class="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">3AlarmLabs</p>
			<h3 class="mt-3 text-2xl font-semibold tracking-tight text-foreground">Explore command training resources</h3>
			<p class="mt-4 max-w-md text-sm leading-6 text-muted-foreground">
				Browse the pages below to learn more about command training, promotional prep, and self-paced scenarios.
			</p>
		</div>

		<div class="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
			<div>
				<h4 class="text-sm font-semibold text-foreground">Core Pages</h4>
				<ul class="mt-4 space-y-3">
					{#each seoLinks.core as link (link.href)}
						<li>
							<a href={base + link.href} class={linkClass}>{link.label}</a>
						</li>
					{/each}
				</ul>
			</div>

			<div>
				<h4 class="text-sm font-semibold text-foreground">Use Cases</h4>
				<ul class="mt-4 space-y-3">
					{#each seoLinks.useCases as link (link.href)}
						<li>
							<a href={base + link.href} class={linkClass}>{link.label}</a>
						</li>
					{/each}
				</ul>
			</div>

			<div>
				<h4 class="text-sm font-semibold text-foreground">Features</h4>
				<ul class="mt-4 space-y-3">
					{#each seoLinks.features as link (link.href)}
						<li>
							<a href={base + link.href} class={linkClass}>{link.label}</a>
						</li>
					{/each}
				</ul>
			</div>

			<div>
				<h4 class="text-sm font-semibold text-foreground">Compare</h4>
				<ul class="mt-4 space-y-3">
					{#each seoLinks.comparison as link (link.href)}
						<li>
							<a href={base + link.href} class={linkClass}>{link.label}</a>
						</li>
					{/each}
				</ul>
			</div>
		</div>
	</div>

	<div class="mt-12 flex flex-col gap-3 border-t border-border pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
		<p>&copy; {new Date().getFullYear()} 3AlarmLabs. Command training for firefighters preparing to lead.</p>
		<div class="flex flex-wrap gap-5">
			<a href={resolve('/pricing')} class="hover:text-foreground">Pricing</a>
			<a href={resolve('/demo')} class="hover:text-foreground">Demo</a>
			<a href={resolve('/contact')} class="hover:text-foreground">Contact</a>
			<a href={resolve('/privacy')} class="hover:text-foreground">Privacy</a>
		</div>
	</div>
</footer>
