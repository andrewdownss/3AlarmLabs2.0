<script lang="ts">
	import { LandingFooter, LandingHeader } from '$lib/components/landing';
	import { Button } from '$lib/components/ui/button';
	import { PLANS } from '$lib/plans';

	const monthlyPrice = PLANS.individual.monthlyPrice ?? 29;

	const demoMail =
		'mailto:sales@3alarmlabs.com?subject=' +
		encodeURIComponent('Demo request — 3 Alarm Labs') +
		'&body=' +
		encodeURIComponent(
			'Name:\n' +
				'Department:\n' +
				'Role (e.g. training officer, chief, instructor):\n' +
				'Approximate number of members:\n' +
				'Time zones / times that work for a 30-minute demo:\n' +
				'Anything specific you want to see:'
		);
</script>

<svelte:head>
	<title>Request a demo — 3 Alarm Labs</title>
	<meta
		name="description"
		content="Book a 30-minute walkthrough of 3 Alarm Labs for your department. See self-paced and instructor-led command training in action."
	/>
	<link rel="canonical" href="https://3alarmlabs.com/demo" />
	<meta property="og:type" content="website" />
	<meta property="og:title" content="Request a demo — 3 Alarm Labs" />
	<meta
		property="og:description"
		content="Book a 30-minute walkthrough of 3 Alarm Labs for your department."
	/>
	<meta property="og:url" content="https://3alarmlabs.com/demo" />
	<meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<div class="min-h-screen bg-muted/25 text-foreground">
	<div class="mx-auto max-w-6xl px-6 sm:px-8 lg:px-10">
		<LandingHeader {monthlyPrice} />

		<main class="py-12 sm:py-16">
			<div class="mx-auto max-w-3xl">
				<header>
					<p class="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Request a demo</p>
					<h1 class="mt-4 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
						See 3 Alarm Labs for your department.
					</h1>
					<p class="mt-5 text-base leading-7 text-muted-foreground sm:text-lg">
						A 30-minute walkthrough covering instructor-led Command sessions, self-paced scenarios for every member,
						and how after-action review helps officers develop on-shift.
					</p>
				</header>

				<section class="mt-10 grid gap-4 sm:grid-cols-2">
					<article class="rounded-none border border-border bg-card p-6 shadow-sm">
						<h2 class="text-lg font-semibold text-foreground">What we'll cover</h2>
						<ul class="mt-3 space-y-2 text-sm text-muted-foreground">
							<li>Running a live instructor-led command session</li>
							<li>Self-paced scenarios members can run on shift</li>
							<li>Radio capture, transcripts, and replay review</li>
							<li>Shared scenarios, folders, and roles</li>
							<li>How pricing scales with department size</li>
						</ul>
					</article>

					<article class="rounded-none border border-border bg-card p-6 shadow-sm">
						<h2 class="text-lg font-semibold text-foreground">Who it's for</h2>
						<ul class="mt-3 space-y-2 text-sm text-muted-foreground">
							<li>Training officers and chiefs evaluating tools</li>
							<li>Career, combo, and volunteer departments</li>
							<li>Academies and regional training divisions</li>
							<li>Private training companies and instructors</li>
						</ul>
					</article>
				</section>

				<section class="mt-10 rounded-none border border-border bg-primary p-6 text-primary-foreground shadow-sm sm:p-8">
					<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<div class="max-w-xl">
							<h2 class="text-2xl font-semibold tracking-tight">Email to schedule a demo</h2>
							<p class="mt-2 text-sm leading-6 text-primary-foreground/85">
								We'll reply within one business day with a scheduling link and a short intake email so we can tailor
								the walkthrough to your department.
							</p>
						</div>
						<Button
							variant="secondary"
							class="w-full shrink-0 rounded-none bg-card text-foreground hover:bg-muted sm:w-auto"
							href={demoMail}
						>
							Email sales@3alarmlabs.com
						</Button>
					</div>
				</section>

				<section class="mt-10">
					<h2 class="text-xl font-semibold tracking-tight text-foreground">Prefer to self-serve?</h2>
					<p class="mt-2 text-sm leading-6 text-muted-foreground">
						Individual firefighters and acting officers can start self-paced training for ${monthlyPrice}/month without a demo.
					</p>
					<div class="mt-4 flex flex-wrap gap-3">
						<Button class="rounded-none bg-[#E85D20] text-white hover:bg-[#D4501A]" href="/signup">
							Start for ${monthlyPrice}/month
						</Button>
						<Button variant="outline" class="rounded-none" href="/pricing">See pricing</Button>
					</div>
				</section>
			</div>
		</main>

		<LandingFooter />
	</div>
</div>
