<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';

	interface Props {
		monthlyPrice: number;
	}

	let { monthlyPrice }: Props = $props();
</script>

<header class="flex items-center justify-between py-6">
	<a href={resolve('/')} class="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-[0.18em] text-foreground">
		<span class="h-2 w-2 shrink-0 rounded-full bg-[#E85D20]" style="animation: pulse-dot 2s infinite"></span>
		3AlarmLabs
	</a>

	<div class="flex items-center gap-2 sm:gap-3">
		<Button
			variant="outline"
			size="sm"
			class="rounded-none"
			href={resolve('/pricing')}
		>
			Pricing
		</Button>
		<Button
			size="sm"
			class="rounded-none bg-[#E85D20] px-4 text-white hover:bg-[#D4501A]"
			href={resolve('/signup')}
		>
			Start for ${monthlyPrice}/month
		</Button>
	</div>
</header>
