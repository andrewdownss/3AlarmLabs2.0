<script lang="ts">
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { Button } from '$lib/components/ui/button';
</script>

<article
	class="flex min-h-[340px] flex-col justify-between border border-border bg-card p-6 shadow-sm transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-px hover:border-muted-foreground/30 hover:shadow-md"
>
	<div>
		<div
			class="flex h-12 w-12 items-center justify-center border border-border bg-muted"
		>
			<PlusIcon class="h-5 w-5 text-foreground" />
		</div>
		<h3 class="mt-6 text-2xl font-semibold tracking-tight">Create new scene</h3>
		<p class="mt-2 text-sm leading-6 text-muted-foreground">
			Start with Street View or upload your own building imagery to create a new scenario.
		</p>
	</div>
	<div class="space-y-3 pt-6">
		<Button class="w-full" href="/app/sizeup/scenes/new">Start builder</Button>
		<p class="text-xs text-muted-foreground/70">
			Capture building sides, place conditions, and get it presentation-ready.
		</p>
	</div>
</article>
