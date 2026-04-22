<script lang="ts">
	import { resolve } from '$app/paths';
	import { LandingFooter, LandingHeader } from '$lib/components/landing';
	import { Button } from '$lib/components/ui/button';
	import { proofPoints } from '$lib/landing/landing-content';

	export interface MarketingTemplateProps {
		monthlyPrice: number;
		heroEyebrow: string;
		heroTitle: string;
		heroDescription: string;
		bodyHtml: string;
	}

	let { monthlyPrice, heroEyebrow, heroTitle, heroDescription, bodyHtml }: MarketingTemplateProps =
		$props();
</script>

<div class="min-h-screen bg-muted/25 text-foreground">
	<div class="mx-auto max-w-6xl px-6 sm:px-8 lg:px-10">
		<LandingHeader {monthlyPrice} />

		<main class="mx-auto w-full max-w-3xl pb-16 pt-10 sm:pb-20 sm:pt-12">
			<article class="rounded-none bg-background px-4 py-10 sm:px-10 sm:py-12">
				<header>
					<div
						class="inline-flex items-center rounded-none border border-border bg-card px-4 py-2 text-xs font-medium text-muted-foreground shadow-sm"
					>
						{heroEyebrow}
					</div>

					<h1 class="mt-6 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
						{heroTitle}
					</h1>

					<p class="mt-5 text-base leading-7 text-muted-foreground sm:text-lg">{heroDescription}</p>

					<div class="mt-6 flex flex-wrap items-center gap-2">
						<div
							class="rounded-none border border-border bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm"
						>
							${monthlyPrice}/month
						</div>
						{#each proofPoints as item (item)}
							<div
								class="rounded-none border border-border bg-card px-4 py-2 text-sm text-muted-foreground shadow-sm"
							>
								{item}
							</div>
						{/each}
					</div>
				</header>

				{#if bodyHtml}
					<div
						class="prose prose-slate mt-10 max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-a:text-[#E85D20] hover:prose-a:text-[#D4501A] prose-a:no-underline hover:prose-a:underline"
					>
						{@html bodyHtml}
					</div>
				{:else}
					<div class="mt-10 rounded-none border border-dashed border-border bg-muted/40 p-6 text-sm text-muted-foreground">
						Content for this page hasn't been written yet. Author it in
						<code class="rounded-none bg-background px-1 py-0.5">src/lib/marketing/content/</code>
						as a Markdown file.
					</div>
				{/if}

				<section class="mt-12">
					<div class="rounded-none border border-border bg-muted/30 p-6 shadow-sm">
						<div class="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
							<div class="min-w-0">
								<h2 class="text-2xl font-semibold tracking-tight text-foreground">Start practicing now</h2>
								<p class="mt-2 text-sm leading-6 text-muted-foreground">
									Self-paced scenarios with replay review so you can build confidence and improve each run.
								</p>
							</div>

							<div class="flex flex-col gap-3 sm:flex-row sm:items-center">
								<Button
									class="rounded-none bg-[#E85D20] text-white hover:bg-[#D4501A]"
									href={resolve('/signup')}
								>
									Start for ${monthlyPrice}/month
								</Button>
								<Button variant="outline" class="rounded-none" href={resolve('/pricing')}>
									See ${monthlyPrice}/month pricing
								</Button>
							</div>
						</div>
					</div>
				</section>
			</article>
		</main>

		<LandingFooter />
	</div>
</div>
