<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import {
		TEAM_ACCESS_HREF,
		heroHeadline,
		heroSubheading,
		heroSupportLine
	} from '$lib/landing/landing-content';

	interface Props {
		monthlyPrice: number;
	}

	let { monthlyPrice }: Props = $props();
</script>

<section class="pt-12 pb-16 sm:pt-16 lg:pt-20">
	<div class="grid items-center gap-10 lg:grid-cols-2 lg:gap-12">
		<div class="max-w-xl">
			<p class="text-sm font-semibold tracking-[0.18em] text-muted-foreground uppercase">
				Fire command practice
			</p>

			<h1
				class="mt-4 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-[3.25rem] lg:leading-[1.08]"
			>
				{heroHeadline}
			</h1>

			<p class="mt-5 text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
				{heroSubheading}
			</p>

			<div class="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
				<Button
					size="lg"
					class="min-h-12 w-full rounded-none bg-[#E85D20] px-8 text-base text-white hover:bg-[#D4501A] sm:w-auto"
					href={resolve('/demo')}
				>
					Try the Free Scenario
				</Button>
				<Button
					size="lg"
					variant="outline"
					class="min-h-12 w-full rounded-none px-8 text-base sm:w-auto"
					href={TEAM_ACCESS_HREF}
				>
					Departments & Training Teams
				</Button>
			</div>

			<p class="mt-4 text-sm leading-6 text-muted-foreground">
				{heroSupportLine.replace('$14.99', `$${monthlyPrice.toFixed(2)}`)}
			</p>
		</div>

		<div class="relative">
			<div
				class="overflow-hidden rounded-none border border-border bg-card shadow-sm ring-1 ring-border/60"
			>
				<div class="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
					<span class="h-2.5 w-2.5 rounded-full bg-red-400"></span>
					<span class="h-2.5 w-2.5 rounded-full bg-amber-400"></span>
					<span class="h-2.5 w-2.5 rounded-full bg-emerald-400"></span>
					<span class="ml-2 text-xs font-medium text-muted-foreground">Command — Live preview</span>
				</div>
				<div
					class="relative aspect-16/10 bg-linear-to-br from-slate-900 via-slate-800 to-orange-900/80"
				>
					<div
						class="absolute inset-0 bg-[radial-gradient(circle_at_25%_35%,rgba(255,255,255,0.12),transparent_50%)]"
					></div>
					<div class="absolute inset-0 flex flex-col p-4 sm:p-5">
						<div class="flex items-center justify-between gap-2">
							<span
								class="rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-semibold text-white sm:text-xs"
								>LIVE</span
							>
							<span class="font-mono text-xs text-white/80">04:32</span>
						</div>
						<div class="mt-3 flex-1 rounded-lg border border-white/10 bg-black/30 p-3">
							<p class="text-xs font-semibold text-white/90 sm:text-sm">Residential Working Fire</p>
							<p class="mt-1 text-[10px] text-white/70 sm:text-xs">
								Smoke showing Side Alpha · E1 on scene
							</p>
							<div class="mt-3 grid grid-cols-3 gap-1.5">
								{#each ['Div 1', 'Roof', 'RIC'] as col (col)}
									<div class="rounded border border-white/10 bg-white/5 px-1.5 py-2 text-center">
										<p class="text-[9px] font-semibold tracking-wide text-white/60 uppercase">
											{col}
										</p>
										<p class="mt-1 text-[10px] font-medium text-white/90">E1</p>
									</div>
								{/each}
							</div>
						</div>
						<div class="mt-3 flex items-center justify-between">
							<span class="text-[10px] text-white/60 sm:text-xs">Simulator preview</span>
							<span
								class="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/90 ring-2 ring-red-300/50 sm:h-9 sm:w-9"
								aria-hidden="true"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="h-4 w-4 text-white"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path
										d="M19 10v2a7 7 0 0 1-14 0v-2"
									/><line x1="12" x2="12" y1="19" y2="22" /></svg
								>
							</span>
						</div>
					</div>
					<div
						class="pointer-events-none absolute inset-0 flex items-center justify-center border-2 border-dashed border-white/20 bg-black/20"
					>
						<p class="rounded-md bg-black/50 px-3 py-1.5 text-xs font-medium text-white/80">
							Simulator preview
						</p>
					</div>
				</div>
			</div>
		</div>
	</div>
</section>
