<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
</script>

<section id="departments" class="py-10">
	<div class="rounded-none border border-border bg-primary px-8 py-10 text-primary-foreground shadow-sm sm:px-10">
		<p class="text-sm font-semibold uppercase tracking-[0.18em] text-primary-foreground/80">For fire departments</p>
		<div class="mt-4 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
			<div class="max-w-2xl">
				<h2 class="text-3xl font-semibold tracking-tight sm:text-4xl">Need department access too?</h2>
				<p class="mt-3 text-sm leading-6 text-primary-foreground/85">
					We still support departments and training officers who want to bring command reps to their members through pilot
					programs and department access.
				</p>
			</div>

			<Button variant="secondary" class="w-full shrink-0 rounded-none bg-card text-foreground hover:bg-muted lg:w-auto" href={resolve('/demo')}>
				For Fire Departments
			</Button>
		</div>
	</div>
</section>
