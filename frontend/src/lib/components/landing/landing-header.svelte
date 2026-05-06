<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';

	interface Props {
		monthlyPrice: number;
	}

	let { monthlyPrice }: Props = $props();
	const individualSignupHref = '/signup?next=%2Fapp%2Fstart-individual';
</script>

<header class="flex items-center justify-between py-6">
	<a
		href={resolve('/')}
		class="flex items-center gap-1.5 text-sm font-semibold tracking-[0.18em] text-foreground uppercase"
	>
		<span
			class="h-2 w-2 shrink-0 rounded-full bg-[#E85D20]"
			style="animation: pulse-dot 2s infinite"
		></span>
		3AlarmLabs
	</a>

	<div class="flex items-center gap-2 sm:gap-3">
		<a href={resolve('/pricing')} class="px-2 text-sm font-medium text-muted-foreground hover:text-foreground">
			Pricing
		</a>
		<Button
			variant="outline"
			size="sm"
			class="rounded-none"
			href={resolve('/login')}
		>
			Log in
		</Button>
		<Button
			size="sm"
			class="rounded-none bg-[#E85D20] px-4 text-white hover:bg-[#D4501A]"
			href={individualSignupHref}
		>
			Start trial
		</Button>
	</div>
</header>
