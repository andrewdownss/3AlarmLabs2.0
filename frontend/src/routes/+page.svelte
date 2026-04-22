<script lang="ts">
	import { PLANS } from '$lib/plans';
	import {
		LandingHeader,
		LandingHero,
		LandingValueProps,
		LandingBuiltFor,
		LandingHowItWorks,
		LandingReviewSection,
		LandingDepartments,
		LandingClosingCta,
		LandingFooter
	} from '$lib/components/landing';

	const monthlyPrice = PLANS.individual.monthlyPrice ?? 29;
</script>

<svelte:head>
	<title>3AlarmLabs — Self-paced command training for firefighters</title>
	<meta
		name="description"
		content="Practice incident command on your own time with self-paced scenarios, radio reps, and replay review. Full access for individual firefighters."
	/>
</svelte:head>

<div class="min-h-screen bg-muted/25 text-foreground">
	<div class="mx-auto max-w-6xl px-6 sm:px-8 lg:px-10">
		<LandingHeader {monthlyPrice} />

		<main>
			<LandingHero {monthlyPrice} />
			<LandingValueProps />
			<LandingBuiltFor />
			<LandingHowItWorks />
			<LandingReviewSection />
			<LandingDepartments />
			<LandingClosingCta {monthlyPrice} />
		</main>

		<LandingFooter />
	</div>
</div>
