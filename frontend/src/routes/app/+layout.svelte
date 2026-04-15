<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { authClient } from '$lib/auth-client';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import MenuIcon from '@lucide/svelte/icons/menu';
	import XIcon from '@lucide/svelte/icons/x';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	let mobileMenuOpen = $state(false);

	const isActive = $derived.by(
		() => (href: string) => page.url.pathname === href || page.url.pathname.startsWith(`${href}/`)
	);

	function closeMobileMenu() {
		mobileMenuOpen = false;
	}

	async function handleLogout() {
		try {
			await authClient.signOut();
		} finally {
			await goto(resolve('/login'));
		}
	}

	$effect(() => {
		void page.url.pathname;
		closeMobileMenu();
	});
</script>

<div class="flex min-h-dvh flex-col bg-background">
	<header class="border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
		<div
			class="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))] sm:gap-4 sm:py-4"
		>
			<div class="min-w-0">
				<a href={resolve('/app/sizeup')} class="text-lg font-semibold tracking-tight">3AlarmLabs</a>
				<div class="mt-1 hidden flex-col gap-1 text-sm text-muted-foreground md:flex">
					<div class="flex flex-wrap items-center gap-2">
						<span>{data.user.name}</span>
						<Badge variant="outline">{data.planConfig.name}</Badge>
					</div>
					{#if data.organization}
						<div class="flex flex-wrap items-center gap-2 text-xs">
							<span class="text-muted-foreground">Workspace:</span>
							<span class="font-medium text-foreground">{data.organization.name}</span>
						</div>
					{:else}
						<div class="flex flex-wrap items-center gap-2 text-xs">
							<span class="text-muted-foreground">Workspace:</span>
							<span class="font-medium text-foreground">Individual</span>
						</div>
					{/if}
				</div>
			</div>

			<nav class="hidden flex-wrap items-center gap-2 md:flex">
				<Button
					variant={isActive('/app/sizeup') ? 'default' : 'outline'}
					size="sm"
					href={resolve('/app/sizeup')}
				>
					SizeUp
				</Button>
				<Button
					variant={isActive('/app/command') ? 'default' : 'outline'}
					size="sm"
					href={resolve('/app/command')}
				>
					Command
				</Button>
				{#if data.user?.isAdmin}
					<Button
						variant={isActive('/app/admin') ? 'default' : 'outline'}
						size="sm"
						href={resolve('/app/admin')}
					>
						Admin
					</Button>
				{/if}
				{#if data.isOrgOwner}
					<Button
						variant={isActive('/app/settings/billing') ? 'default' : 'outline'}
						size="sm"
						href={resolve('/app/settings/billing')}
					>
						Billing
					</Button>
					<Button
						variant={isActive('/app/settings/team') ? 'default' : 'outline'}
						size="sm"
						href={resolve('/app/settings/team')}
					>
						Team
					</Button>
				{/if}
				<Button variant="outline" size="sm" onclick={handleLogout}>Logout</Button>
			</nav>

			<button
				type="button"
				class="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-input bg-background text-foreground transition-colors hover:bg-accent hover:text-accent-foreground md:hidden"
				aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
				aria-expanded={mobileMenuOpen}
				onclick={() => (mobileMenuOpen = !mobileMenuOpen)}
			>
				{#if mobileMenuOpen}
					<XIcon class="h-5 w-5" />
				{:else}
					<MenuIcon class="h-5 w-5" />
				{/if}
			</button>
		</div>

		{#if mobileMenuOpen}
			<div
				class="fixed inset-0 z-40 bg-black/50 md:hidden"
				aria-hidden="true"
				onclick={closeMobileMenu}
			></div>
			<nav
				class="pb-safe fixed inset-x-0 top-0 z-50 flex max-h-[min(100dvh,100vh)] flex-col gap-0 overflow-y-auto border-b bg-background px-4 pt-16 shadow-lg md:hidden"
			>
				<div class="mb-3 space-y-2 text-sm text-muted-foreground">
					<div class="flex flex-wrap items-center gap-2">
						<span>{data.user.name}</span>
						<Badge variant="outline">{data.planConfig.name}</Badge>
					</div>
					{#if data.organization}
						<p class="text-xs font-medium text-foreground">{data.organization.name}</p>
					{:else}
						<p class="text-xs font-medium text-foreground">Individual</p>
					{/if}
				</div>
				<a
					href={resolve('/app/sizeup')}
					class="flex min-h-[48px] items-center rounded-md px-3 py-3 text-base font-medium transition-colors {isActive(
						'/app/sizeup'
					)
						? 'bg-primary text-primary-foreground'
						: 'hover:bg-accent'}"
					onclick={closeMobileMenu}
				>
					SizeUp
				</a>
				<a
					href={resolve('/app/command')}
					class="flex min-h-[48px] items-center rounded-md px-3 py-3 text-base font-medium transition-colors {isActive(
						'/app/command'
					)
						? 'bg-primary text-primary-foreground'
						: 'hover:bg-accent'}"
					onclick={closeMobileMenu}
				>
					Command
				</a>
				{#if data.user?.isAdmin}
					<a
						href={resolve('/app/admin')}
						class="flex min-h-[48px] items-center rounded-md px-3 py-3 text-base font-medium transition-colors {isActive(
							'/app/admin'
						)
							? 'bg-primary text-primary-foreground'
							: 'hover:bg-accent'}"
						onclick={closeMobileMenu}
					>
						Admin
					</a>
				{/if}
				{#if data.isOrgOwner}
					<a
						href={resolve('/app/settings/billing')}
						class="flex min-h-[48px] items-center rounded-md px-3 py-3 text-base font-medium transition-colors {isActive(
							'/app/settings/billing'
						)
							? 'bg-primary text-primary-foreground'
							: 'hover:bg-accent'}"
						onclick={closeMobileMenu}
					>
						Billing
					</a>
					<a
						href={resolve('/app/settings/team')}
						class="flex min-h-[48px] items-center rounded-md px-3 py-3 text-base font-medium transition-colors {isActive(
							'/app/settings/team'
						)
							? 'bg-primary text-primary-foreground'
							: 'hover:bg-accent'}"
						onclick={closeMobileMenu}
					>
						Team
					</a>
				{/if}
				<button
					type="button"
					class="mt-2 flex min-h-[48px] w-full items-center rounded-md px-3 py-3 text-left text-base font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
					onclick={() => {
						closeMobileMenu();
						handleLogout();
					}}
				>
					Logout
				</button>
			</nav>
		{/if}
	</header>

	<div class="min-h-0 flex-1">
		{@render children()}
	</div>
</div>
