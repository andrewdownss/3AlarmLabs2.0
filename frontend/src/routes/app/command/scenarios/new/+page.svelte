<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { page } from '$app/state';

	const actionData = $derived.by(() => page.form as any);
</script>

<div class="mx-auto w-full max-w-2xl px-4 py-6 pb-safe sm:py-10">
	<div class="mb-6">
		<h1 class="text-3xl font-semibold tracking-tight">New Scenario</h1>
		<p class="mt-1 text-sm text-muted-foreground">Configure the basics of your command training scenario.</p>
	</div>

	{#if actionData?.formError}
		<div class="mb-4 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{actionData.formError}</div>
	{/if}

	<Card.Root>
		<Card.Header>
			<Card.Title>Scenario Details</Card.Title>
		</Card.Header>
		<Card.Content>
			<form method="POST" class="space-y-4">
				<div class="space-y-1.5">
					<label class="text-sm font-medium" for="title">Title *</label>
					<Input id="title" name="title" required placeholder="e.g., 2-Story Residential Structure Fire" />
				</div>
				<div class="space-y-1.5">
					<label class="text-sm font-medium" for="description">Description</label>
					<textarea id="description" name="description" class="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="Brief description of the scenario..."></textarea>
				</div>
				<div class="grid gap-4 sm:grid-cols-2">
					<div class="space-y-1.5">
						<label class="text-sm font-medium" for="constructionType">Construction Type</label>
						<select id="constructionType" name="constructionType" class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
							<option value="">Select...</option>
							<option value="Type I - Fire Resistive">Type I - Fire Resistive</option>
							<option value="Type II - Non-Combustible">Type II - Non-Combustible</option>
							<option value="Type III - Ordinary">Type III - Ordinary</option>
							<option value="Type IV - Heavy Timber">Type IV - Heavy Timber</option>
							<option value="Type V - Wood Frame">Type V - Wood Frame</option>
						</select>
					</div>
					<div class="space-y-1.5">
						<label class="text-sm font-medium" for="alarmLevel">Alarm Level</label>
						<select id="alarmLevel" name="alarmLevel" class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
							<option value="">Select...</option>
							<option value="1st Alarm">1st Alarm</option>
							<option value="2nd Alarm">2nd Alarm</option>
							<option value="3rd Alarm">3rd Alarm</option>
							<option value="All Hands">All Hands</option>
						</select>
					</div>
				</div>
				<div class="grid gap-4 sm:grid-cols-2">
					<div class="space-y-1.5">
						<label class="text-sm font-medium" for="address">Address</label>
						<Input id="address" name="address" placeholder="42 Main St, Boonton NJ" />
					</div>
					<div class="space-y-1.5">
						<label class="text-sm font-medium" for="occupancyType">Occupancy Type</label>
						<Input id="occupancyType" name="occupancyType" placeholder="e.g., Single Family Residential" />
					</div>
				</div>
				<div class="flex justify-between pt-4">
					<Button variant="outline" href="/app/command">Cancel</Button>
					<Button type="submit">Create & Configure Images</Button>
				</div>
			</form>
		</Card.Content>
	</Card.Root>
</div>
