<script lang="ts">
	import { page } from '$app/state';
	import { navigating } from '$app/stores';
	import AppSidebar from '$lib/components/app-sidebar.svelte';
	import MobileTopbar from '$lib/components/mobile-topbar.svelte';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	const isPresentMode = $derived(/\/scenes\/[^/]+\/present\/?$/.test(page.url.pathname));
</script>

{#if isPresentMode}
	{@render children()}
{:else}
	<Sidebar.Provider>
		{#if $navigating}
			<div class="fixed inset-x-0 top-0 z-50 h-0.5 bg-sidebar-primary animate-pulse"></div>
		{/if}
		<AppSidebar {data} />
		<Sidebar.Inset>
			<MobileTopbar />
			<div class="flex-1">
				{@render children()}
			</div>
		</Sidebar.Inset>
	</Sidebar.Provider>
{/if}
