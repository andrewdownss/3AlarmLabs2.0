<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import {
		TEAM_ACCESS_HREF,
		heroHeadline,
		heroPreviewImageUrl,
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
					<span class="ml-2 text-xs font-medium text-muted-foreground">Command simulator</span>
				</div>
				<div class="relative aspect-16/10 bg-muted">
					<img
						src={heroPreviewImageUrl}
						alt="3AlarmLabs command simulator showing a residential working fire with smoke and flames on Side Alpha"
						class="absolute inset-0 h-full w-full object-cover object-top"
						width="1600"
						height="1000"
						loading="eager"
						decoding="async"
					/>
				</div>
			</div>
		</div>
	</div>
</section>
