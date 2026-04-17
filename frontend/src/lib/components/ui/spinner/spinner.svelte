<script lang="ts">
	import Loader2 from '@lucide/svelte/icons/loader-2';
	import { cn } from '$lib/utils';

	interface Props {
		class?: string;
		size?: number;
		color?: string;
		strokeWidth?: number;
	}

	let { class: className, ...rest }: Props = $props();
</script>

<Loader2
	{...rest}
	class={cn('animate-spin', className)}
	aria-label="Loading"
/>

