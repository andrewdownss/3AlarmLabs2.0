<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { authClient } from '$lib/auth-client';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import HomeIcon from '@lucide/svelte/icons/home';
	import MessageSquareIcon from '@lucide/svelte/icons/message-square';
	import LayoutListIcon from '@lucide/svelte/icons/layout-list';
	import CreditCardIcon from '@lucide/svelte/icons/credit-card';
	import UsersIcon from '@lucide/svelte/icons/users';
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import type { LayoutData } from '../../routes/app/$types';

	interface Props {
		data: LayoutData;
	}

	let { data }: Props = $props();

	const isActive = $derived.by(
		() => (href: string) => page.url.pathname === href || page.url.pathname.startsWith(`${href}/`)
	);

	interface NavItem {
		label: string;
		href: string;
		icon: typeof HomeIcon;
	}

	const navItems: NavItem[] = $derived.by(() => {
		const items: NavItem[] = [
			{ label: 'SizeUp', href: '/app/sizeup', icon: HomeIcon },
			{ label: 'Command', href: '/app/command', icon: MessageSquareIcon }
		];
		if (data.user?.isAdmin) {
			items.push({ label: 'Admin', href: '/app/admin', icon: LayoutListIcon });
		}
		if (data.isOrgOwner) {
			items.push({ label: 'Billing', href: '/app/settings/billing', icon: CreditCardIcon });
			items.push({ label: 'Team', href: '/app/settings/team', icon: UsersIcon });
		}
		return items;
	});

	async function handleLogout() {
		try {
			await authClient.signOut();
		} catch (err) {
			console.error('[logout] signOut failed', err);
		}
		window.location.assign(resolve('/login'));
	}
</script>

<Sidebar.Root collapsible="icon">
	<Sidebar.Header>
		<div class="flex items-center gap-3 px-2 py-2">
			<div
				class="flex h-10 w-10 shrink-0 items-center justify-center bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground"
			>
				3A
			</div>
			<div class="min-w-0 group-data-[collapsible=icon]:hidden">
				<div class="text-base font-semibold tracking-tight">3AlarmLabs</div>
				<div class="truncate text-sm text-sidebar-foreground/60">
					Workspace: {data.organization?.name ?? 'Individual'}
				</div>
			</div>
		</div>
	</Sidebar.Header>

	<Sidebar.Content>
		<Sidebar.Group>
			<Sidebar.GroupContent>
				<div class="px-2 group-data-[collapsible=icon]:hidden">
					<div class="border border-sidebar-border bg-sidebar-accent/50 p-4">
						<div class="text-sm font-medium">{data.user.name}</div>
						<div class="mt-1 text-sm text-sidebar-foreground/60">
							{data.planConfig.name}
						</div>
					</div>
				</div>
			</Sidebar.GroupContent>
		</Sidebar.Group>

		<Sidebar.Group>
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					{#each navItems as item (item.href)}
						<Sidebar.MenuItem>
							<Sidebar.MenuButton
								isActive={isActive(item.href)}
								tooltipContent={item.label}
								class="h-11 px-4 py-3 text-sm font-medium text-sidebar-foreground/70 data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground"
							>
								{#snippet child({ props })}
									<!-- eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic nav href -->
								<a href={resolve(item.href as any)} {...props}>
										<item.icon class="h-5 w-5" />
										<span>{item.label}</span>
									</a>
								{/snippet}
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
					{/each}
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>
	</Sidebar.Content>

	<Sidebar.Footer>
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton
					onclick={handleLogout}
					tooltipContent="Logout"
					class="h-11 justify-center border border-sidebar-border px-4 py-3 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent"
				>
					<LogOutIcon class="h-4 w-4" />
					<span>Logout</span>
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Footer>
</Sidebar.Root>
