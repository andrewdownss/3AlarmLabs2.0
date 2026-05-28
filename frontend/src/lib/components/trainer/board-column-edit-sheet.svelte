<script lang="ts">
	import * as Sheet from '$lib/components/ui/sheet';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import type { BoardColumnState } from '$lib/trainer-command-board';

	interface Props {
		open: boolean;
		column: BoardColumnState | null;
		onClose: () => void;
		onSave: (values: {
			label: string;
			kind: 'division' | 'group';
			supervisorUnit: string;
		}) => void;
		onClear: () => void;
	}

	let { open = $bindable(false), column, onClose, onSave, onClear }: Props = $props();

	let label = $state('');
	let kind = $state<'division' | 'group'>('group');
	let supervisorUnit = $state('');

	$effect(() => {
		if (!open || !column) return;
		label = column.label || '';
		kind = column.kind === 'division' ? 'division' : 'group';
		supervisorUnit = column.supervisorUnit ?? '';
	});

	function handleSave() {
		onSave({ label: label.trim(), kind, supervisorUnit: supervisorUnit.trim() });
	}

	function handleClear() {
		if (!confirm('Clear this box? All units in it will move to Working Assignments.')) return;
		onClear();
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
			<Sheet.Title class="text-base">Edit board box</Sheet.Title>
			<Sheet.Description class="text-xs">
				Rename the division or group, set a supervisor, or clear the box.
			</Sheet.Description>
		</Sheet.Header>
		<div class="space-y-3 px-4">
			<div>
				<label for="column-label" class="mb-1 block text-xs font-medium">Label</label>
				<Input id="column-label" bind:value={label} placeholder="e.g. Division 2, Fire Attack" class="h-11" />
			</div>
			<div>
				<p class="mb-1 text-xs font-medium">Type</p>
				<div class="flex flex-wrap gap-1.5">
					<button
						type="button"
						onclick={() => (kind = 'division')}
						class="min-h-9 rounded-full border px-3 text-xs font-medium transition-colors {kind ===
						'division'
							? 'border-primary bg-primary text-primary-foreground'
							: 'bg-background hover:bg-muted'}"
					>
						Division (geographic)
					</button>
					<button
						type="button"
						onclick={() => (kind = 'group')}
						class="min-h-9 rounded-full border px-3 text-xs font-medium transition-colors {kind ===
						'group'
							? 'border-primary bg-primary text-primary-foreground'
							: 'bg-background hover:bg-muted'}"
					>
						Group (task-based)
					</button>
				</div>
			</div>
			<div>
				<label for="column-supervisor" class="mb-1 block text-xs font-medium">Supervisor unit</label>
				<Input
					id="column-supervisor"
					bind:value={supervisorUnit}
					placeholder="e.g. Engine 12"
					class="h-11"
				/>
			</div>
		</div>
		<Sheet.Footer class="flex flex-row flex-wrap justify-between gap-2 px-4 pb-2 pt-0">
			<Button variant="destructive" size="sm" class="min-h-10" onclick={handleClear}>
				Clear box
			</Button>
			<div class="flex gap-2">
				<Button variant="outline" size="sm" class="min-h-10" onclick={onClose}>Cancel</Button>
				<Button size="sm" class="min-h-10" onclick={handleSave}>Save</Button>
			</div>
		</Sheet.Footer>
	</Sheet.Content>
</Sheet.Root>
