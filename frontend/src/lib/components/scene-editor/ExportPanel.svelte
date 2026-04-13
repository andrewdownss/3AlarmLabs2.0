<script lang="ts">
	import {
		recordScene,
		ASPECT_RATIOS,
		DURATIONS,
		isExportSupported,
		type SceneExportResult,
		type ExportData,
		type AspectRatio,
		type Duration
	} from '$lib/utils/scene-export';

	interface Props {
		getExportData: () => ExportData | null;
		sceneTitle: string;
		onClose: () => void;
	}

	let { getExportData, sceneTitle, onClose }: Props = $props();

	let selectedRatio: AspectRatio = $state(ASPECT_RATIOS[0]);
	let selectedDuration: Duration = $state(DURATIONS[1]);
	let status = $state<'idle' | 'recording' | 'done' | 'error'>('idle');
	let progress = $state(0);
	let result = $state<SceneExportResult | null>(null);
	let errorMessage = $state('');

	const supported = isExportSupported();

	async function startExport() {
		if (!supported) return;

		status = 'recording';
		progress = 0;
		result = null;
		errorMessage = '';

		try {
			const exportResult = await recordScene({
				getExportData,
				duration: selectedDuration.value,
				outputWidth: selectedRatio.width,
				outputHeight: selectedRatio.height,
				onProgress: (p) => {
					progress = p;
				}
			});

			result = exportResult;
			status = 'done';
		} catch (err) {
			status = 'error';
			errorMessage = err instanceof Error ? err.message : 'Export failed';
		}
	}

	function download() {
		if (!result) return;
		const a = document.createElement('a');
		a.href = result.url;
		const safeName = sceneTitle.replace(/[^a-zA-Z0-9\-_]/g, '_').slice(0, 50);
		a.download = `${safeName}-sizeup.${result.extension}`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	}

	function reset() {
		if (result?.url) URL.revokeObjectURL(result.url);
		result = null;
		status = 'idle';
		progress = 0;
		errorMessage = '';
	}

	function handleClose() {
		reset();
		onClose();
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) handleClose();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && status !== 'recording') handleClose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
	onclick={handleBackdropClick}
>
	<div
		class="mx-4 w-full max-w-md rounded-xl border border-white/10 bg-zinc-900 p-6 shadow-2xl"
		role="dialog"
		aria-modal="true"
		aria-label="Export scene for Instagram"
	>
		<div class="mb-5 flex items-center justify-between">
			<h2 class="text-lg font-semibold text-white">Export for Instagram</h2>
			<button
				type="button"
				onclick={handleClose}
				disabled={status === 'recording'}
				class="rounded-md p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-40"
				aria-label="Close"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M18 6 6 18" />
					<path d="m6 6 12 12" />
				</svg>
			</button>
		</div>

		{#if !supported}
			<p class="text-sm text-red-400">
				MP4 export is not supported in this browser. Please use a recent version of Chrome, Edge,
				or Safari.
			</p>
		{:else if status === 'idle'}
			<div class="mb-4">
				<span class="mb-2 block text-sm font-medium text-white/70">Aspect Ratio</span>
				<div class="flex gap-2">
					{#each ASPECT_RATIOS as ratio}
						<button
							type="button"
							onclick={() => {
								selectedRatio = ratio;
							}}
							class="flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors {selectedRatio.value ===
							ratio.value
								? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
								: 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'}"
						>
							{ratio.label}
						</button>
					{/each}
				</div>
				<p class="mt-1 text-xs text-white/40">
					{selectedRatio.width} &times; {selectedRatio.height}px
				</p>
			</div>

			<div class="mb-6">
				<span class="mb-2 block text-sm font-medium text-white/70">Duration</span>
				<div class="flex gap-2">
					{#each DURATIONS as dur}
						<button
							type="button"
							onclick={() => {
								selectedDuration = dur;
							}}
							class="flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors {selectedDuration.value ===
							dur.value
								? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
								: 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'}"
						>
							{dur.label}
						</button>
					{/each}
				</div>
			</div>

			<button
				type="button"
				onclick={startExport}
				class="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500"
			>
				Export MP4
			</button>
		{:else if status === 'recording'}
			<div class="py-4">
				<div class="mb-3 flex items-center gap-3">
					<div
						class="h-5 w-5 animate-spin rounded-full border-2 border-indigo-400/30 border-t-indigo-400"
					></div>
					<span class="text-sm font-medium text-white/80">Rendering MP4&hellip;</span>
				</div>
				<div class="h-2 overflow-hidden rounded-full bg-white/10">
					<div
						class="h-full rounded-full bg-indigo-500 transition-all duration-200"
						style="width: {Math.round(progress * 100)}%"
					></div>
				</div>
				<p class="mt-2 text-right text-xs text-white/40">{Math.round(progress * 100)}%</p>
			</div>
		{:else if status === 'done' && result}
			<div class="py-4">
				<div class="mb-4 flex items-center gap-2 text-green-400">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
						<path d="m9 11 3 3L22 4" />
					</svg>
					<span class="text-sm font-medium">MP4 export complete!</span>
				</div>

				<div class="mb-4 overflow-hidden rounded-lg border border-white/10 bg-black">
					<!-- svelte-ignore a11y_media_has_caption -->
					<video
						src={result.url}
						class="mx-auto max-h-48"
						controls
						autoplay
						loop
						muted
						playsinline
					></video>
				</div>

				<div class="flex gap-2">
					<button
						type="button"
						onclick={download}
						class="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500"
					>
						Download MP4
					</button>
					<button
						type="button"
						onclick={reset}
						class="rounded-lg border border-white/20 px-4 py-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
					>
						Re-record
					</button>
				</div>

				<p class="mt-3 text-xs text-white/40">
					This export is encoded as an Instagram-friendly `.mp4` file.
				</p>
			</div>
		{:else if status === 'error'}
			<div class="py-4">
				<div class="mb-3 flex items-center gap-2 text-red-400">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<circle cx="12" cy="12" r="10" />
						<line x1="12" x2="12" y1="8" y2="12" />
						<line x1="12" x2="12.01" y1="16" y2="16" />
					</svg>
					<span class="text-sm font-medium">{errorMessage}</span>
				</div>
				<button
					type="button"
					onclick={reset}
					class="rounded-lg border border-white/20 px-4 py-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
				>
					Try Again
				</button>
			</div>
		{/if}
	</div>
</div>
