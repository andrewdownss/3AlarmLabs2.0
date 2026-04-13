<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import { PLANS } from '$lib/plans';
</script>

<svelte:head>
	<title>3 Alarm Labs — Fire Training Platform</title>
	<meta name="description" content="Build realistic fire training scenarios and run command simulations for your crew." />
</svelte:head>

<div class="min-h-screen bg-background text-foreground">
	<nav class="fixed left-0 right-0 top-0 z-100 flex h-[60px] items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur-md md:px-12">
		<a href={resolve('/')} class="flex items-center gap-1.5 text-base font-bold tracking-tight">
			<span class="h-2 w-2 rounded-full bg-[#E85D20]" style="animation: pulse-dot 2s infinite"></span>
			3 Alarm Labs
		</a>
		<div class="flex items-center gap-2">
			<Button variant="ghost" size="sm" href={resolve('/login')}>Log in</Button>
			<Button size="sm" href={resolve('/signup')}>Get started</Button>
		</div>
	</nav>

	<section class="relative flex min-h-screen flex-col items-center justify-center px-4 pb-20 pt-[120px] text-center md:px-12" style="background: radial-gradient(ellipse 70% 50% at 50% 30%, rgba(232,93,32,0.06) 0%, transparent 65%)">
		<h1 class="mb-5 max-w-[800px] text-[clamp(42px,6vw,72px)] font-bold leading-[1.08] tracking-[-0.03em]">
			Train on <span class="text-[#E85D20]">real streets.</span><br />
			Command with <span class="text-[#E85D20]">confidence.</span>
		</h1>

		<p class="mx-auto mb-9 max-w-[520px] text-[17px] text-muted-foreground">
			Build realistic fire scenarios with Google Street View, and run command simulations with real-time radio, AI transcription, and after-action review.
		</p>

		<div class="mb-14 flex w-full max-w-md flex-col gap-3 sm:mx-auto sm:max-w-none sm:flex-row sm:flex-wrap sm:justify-center sm:gap-4">
			<Button size="lg" class="min-h-12 w-full bg-[#E85D20] hover:bg-[#D4501A] sm:w-auto" href={resolve('/signup')}>Try free — no credit card</Button>
			<Button size="lg" variant="outline" class="min-h-12 w-full sm:w-auto" href="#tools">See our tools</Button>
			<Button size="lg" variant="ghost" class="min-h-12 w-full sm:w-auto" href="#pricing">Pricing</Button>
		</div>

		<div id="tools" class="grid w-full max-w-4xl gap-6 md:grid-cols-2">
			<a href={resolve('/app/sizeup')} class="group flex flex-col items-center rounded-xl border bg-card p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
				<div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 text-3xl">
					🔥
				</div>
				<h3 class="mb-2 text-xl font-bold">SizeUp</h3>
				<p class="text-center text-sm text-muted-foreground">
					Build fire and smoke scenarios on real Street View captures. Present to your crew in one click.
				</p>
			</a>
			<a href={resolve('/app/command')} class="group flex flex-col items-center rounded-xl border bg-card p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
				<div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-3xl">
					📻
				</div>
				<h3 class="mb-2 text-xl font-bold">Command</h3>
				<p class="text-center text-sm text-muted-foreground">
					Run live command simulations with radio input, AI transcription, and real-time incident command boards.
				</p>
			</a>
		</div>
	</section>

	<section id="pricing" class="border-t bg-muted/20 px-4 py-20 md:px-12">
		<div class="mx-auto max-w-5xl">
			<h2 class="text-center text-3xl font-bold tracking-tight">Pricing</h2>
			<p class="mx-auto mt-2 max-w-xl text-center text-muted-foreground">
				Unlimited SizeUp on paid plans. Command includes self-practice on every tier; instructor-led sessions for Team and
				above.
			</p>
			<div class="mt-12 grid gap-6 md:grid-cols-3">
				<div class="rounded-xl border bg-card p-6 shadow-sm">
					<h3 class="text-lg font-semibold">{PLANS.individual.name}</h3>
					<p class="mt-2 text-3xl font-bold">
						${PLANS.individual.monthlyPrice}<span class="text-base font-normal text-muted-foreground">/mo</span>
					</p>
					<p class="text-sm text-muted-foreground">${PLANS.individual.annualPrice}/yr billed yearly</p>
					<ul class="mt-4 space-y-2 text-sm text-muted-foreground">
						<li>1 seat · Self-practice Command</li>
						<li>Unlimited SizeUp scenes</li>
					</ul>
					<Button class="mt-6 w-full" href={resolve('/signup')}>Get started</Button>
				</div>
				<div class="rounded-xl border-2 border-[#E85D20] bg-card p-6 shadow-md">
					<h3 class="text-lg font-semibold">{PLANS.team.name}</h3>
					<p class="mt-2 text-3xl font-bold">
						${PLANS.team.monthlyPrice}<span class="text-base font-normal text-muted-foreground">/mo</span>
					</p>
					<p class="text-sm text-muted-foreground">${PLANS.team.annualPrice}/yr billed yearly</p>
					<ul class="mt-4 space-y-2 text-sm text-muted-foreground">
						<li>Up to 3 members</li>
						<li>Instructor-led Command</li>
						<li>Folders · Share links</li>
					</ul>
					<Button class="mt-6 w-full bg-[#E85D20] hover:bg-[#D4501A]" href={resolve('/signup')}>Get started</Button>
				</div>
				<div class="rounded-xl border bg-card p-6 shadow-sm">
					<h3 class="text-lg font-semibold">{PLANS.instructor.name}</h3>
					<p class="mt-2 text-3xl font-bold">
						${PLANS.instructor.monthlyPrice}<span class="text-base font-normal text-muted-foreground">/mo</span>
					</p>
					<p class="text-sm text-muted-foreground">${PLANS.instructor.annualPrice}/yr billed yearly</p>
					<ul class="mt-4 space-y-2 text-sm text-muted-foreground">
						<li>Up to 15 members</li>
						<li>Video export</li>
						<li>For training providers</li>
					</ul>
					<Button class="mt-6 w-full" variant="outline" href={resolve('/signup')}>Get started</Button>
				</div>
			</div>
			<div class="mt-10 rounded-xl border border-dashed bg-background p-6 text-center">
				<h3 class="font-semibold">{PLANS.enterprise.name}</h3>
				<p class="mt-1 text-sm text-muted-foreground">Volume licensing, invoicing, and custom terms.</p>
				<a
					href="mailto:sales@3alarmlabs.com?subject=Enterprise%20pricing"
					class="mt-4 inline-block text-sm font-medium text-[#E85D20] underline"
				>
					Contact sales
				</a>
			</div>
		</div>
	</section>

	<footer class="flex flex-col items-center justify-between gap-3 border-t px-4 py-10 md:flex-row md:px-12">
		<div class="flex items-center gap-1.5 text-[15px] font-bold tracking-tight">
			<span class="h-2 w-2 rounded-full bg-[#E85D20]"></span>
			3 Alarm Labs
		</div>
		<div class="flex flex-wrap items-center justify-center gap-4 text-[13px] text-muted-foreground">
			<a href={resolve('/privacy')} class="underline hover:text-foreground">Privacy</a>
			<span>&copy; {new Date().getFullYear()} 3 Alarm Labs</span>
		</div>
	</footer>
</div>
