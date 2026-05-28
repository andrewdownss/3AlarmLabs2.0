<script lang="ts">
	import * as Sheet from '$lib/components/ui/sheet';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';

	interface BoardEntryDraft {
		unitName: string;
		division: string;
		assignment: string;
		status: string;
	}

	interface Props {
		open: boolean;
		entry: BoardEntryDraft | null;
		boxChoices: string[];
		statusChoices: string[];
		statusColors: Record<string, string>;
		onClose: () => void;
		onSave: (patch: { division: string; assignment: string; status: string }) => void;
		onRemove: () => void;
	}

	let {
		open = $bindable(false),
		entry,
		boxChoices,
		statusChoices,
		statusColors,
		onClose,
		onSave,
		onRemove
	}: Props = $props();

	let division = $state('');
	let assignment = $state('');
	let status = $state('Assigned');

	$effect(() => {
		if (!open || !entry) return;
		division = entry.division;
		assignment = entry.assignment;
		status = entry.status;
	});

	function handleSave() {
		onSave({ division, assignment: assignment.trim(), status });
	}

	function handleRemove() {
		if (!confirm(`Remove ${entry?.unitName ?? 'this unit'} from the board?`)) return;
		onRemove();
	}
</script>

<Sheet.Root
	bind:open
	onOpenChange={(isOpen) => {
		if (!isOpen) onClose();
	}}
>
	<Sheet.Content side="bottom" class="rounded-t-2xl pb-[max(env(safe-area-inset-bottom),1rem)]">
		<Sheet.Header class="text-left">
			<Sheet.Title class="text-base">Edit {entry?.unitName ?? 'unit'}</Sheet.Title>
			<Sheet.Description class="text-xs">
				Move the unit, change its task, update status, or remove it from the board.
			</Sheet.Description>
		</Sheet.Header>
		<div class="space-y-3 px-4">
			<div>
				<p class="mb-1 text-xs font-medium">Board box</p>
				<div class="flex flex-wrap gap-1.5">
					{#each boxChoices as box (box)}
						<button
							type="button"
							onclick={() => (division = box)}
							class="min-h-9 rounded-full border px-3 text-xs font-medium transition-colors {division ===
							box
								? 'border-primary bg-primary text-primary-foreground'
								: 'bg-background hover:bg-muted'}"
						>
							{box}
						</button>
					{/each}
				</div>
			</div>
			<div>
				<label for="entry-assignment" class="mb-1 block text-xs font-medium">Assignment</label>
				<Input id="entry-assignment" bind:value={assignment} class="h-11" />
			</div>
			<div>
				<p class="mb-1 text-xs font-medium">Status</p>
				<div class="flex flex-wrap gap-1.5">
					{#each statusChoices as choice (choice)}
						<button
							type="button"
							onclick={() => (status = choice)}
							class="min-h-9 rounded-full border px-3 text-xs font-medium transition-colors {status ===
							choice
								? `border-transparent ${statusColors[choice] ?? 'bg-foreground text-background'}`
								: 'bg-background hover:bg-muted'}"
						>
							{choice}
						</button>
					{/each}
				</div>
			</div>
		</div>
		<Sheet.Footer class="flex flex-row flex-wrap justify-between gap-2 px-4 pb-2 pt-0">
			<Button variant="destructive" size="sm" class="min-h-10" onclick={handleRemove}>
				Remove unit
			</Button>
			<div class="flex gap-2">
				<Button variant="outline" size="sm" class="min-h-10" onclick={onClose}>Cancel</Button>
				<Button size="sm" class="min-h-10" onclick={handleSave}>Save</Button>
			</div>
		</Sheet.Footer>
	</Sheet.Content>
</Sheet.Root>
