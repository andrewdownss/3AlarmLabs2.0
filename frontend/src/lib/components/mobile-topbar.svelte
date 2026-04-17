<script lang="ts">
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
</script>

<header
	class="sticky top-0 z-30 flex items-center justify-between border-b border-sidebar-border bg-background px-4 py-4 lg:hidden"
>
	<div>
		<div class="text-base font-semibold">3AlarmLabs</div>
		<div class="text-sm text-muted-foreground">Dashboard</div>
	</div>
	<Sidebar.Trigger />
</header>
