<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { fireGoogleAdsConversion } from '$lib/google-ads';
	import { env } from '$env/dynamic/public';
	import { onMount } from 'svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	onMount(() => {
		if (!data.conversionId) return;

		fireGoogleAdsConversion({
			sendTo: env.PUBLIC_GOOGLE_ADS_SIGNUP_SEND_TO ?? '',
			dedupeKey: `gtag_signup_conversion_${data.conversionId}`,
			transactionId: data.conversionId
		});
	});
</script>

<svelte:head>
	<title>Account created — 3AlarmLabs</title>
	<meta name="robots" content="noindex,nofollow" />
</svelte:head>

<div class="pb-safe flex min-h-[100dvh] w-full items-center justify-center px-4 py-6">
	<Card.Root class="mx-auto w-full max-w-sm">
		<Card.Header>
			<div class="flex items-center gap-1.5 text-base font-bold tracking-tight">
				<span class="h-2 w-2 rounded-full bg-[#E85D20]"></span>
				3AlarmLabs
			</div>
			<Card.Title class="text-2xl">You're all set</Card.Title>
			<Card.Description>
				Your account is ready. Continue to start training or finish setting up billing.
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<Button class="w-full bg-[#E85D20] hover:bg-[#D4501A]" href={data.next}>
				Continue
			</Button>
		</Card.Content>
	</Card.Root>
</div>
