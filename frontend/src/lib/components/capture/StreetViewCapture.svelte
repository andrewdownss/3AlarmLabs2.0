<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
	import { env } from '$env/dynamic/public';
	import { Card, CardContent } from '$lib/components/ui/card';
	let hasInitializedGoogleMaps = false;

	//capture meta type
	//This is the type for the capture meta object
	//This is stored in the database and used to display the street view image
	export interface CaptureMeta {
		lat: number;
		lng: number;
		heading: number;
		pitch: number;
		zoom: number;
		panoId?: string;
		formattedAddress?: string;
	}


	let {
		initialAddress = '', 
		initialPosition = { lat: 32.7765, lng: -79.9311 },
		heightPx = 560,
		onChange, //function to call when the capture meta changes
		getCurrentMetaRef //ref to get the current capture meta
	}: {
		initialAddress?: string;
		initialPosition?: { lat: number; lng: number };
		heightPx?: number;
		onChange?: (meta: CaptureMeta) => void;
		/** Ref to get current panorama state at any moment (e.g. at form submit). Ensures capture uses latest view. */
		getCurrentMetaRef?: { current: (() => CaptureMeta | null) | null };
	} = $props();

	let address = $state(''); //address input value
	let inputEl: HTMLInputElement | null = null;
	let panoEl: HTMLDivElement | null = null; //pano element
	let error = $state<string | null>(null); //error message
	let isLoading = $state(true); //loading state

	onMount(async () => {
		if (!panoEl || !inputEl) return;
		address = initialAddress;

		//get the google maps api key from the environment variables
		//make sure its there set is loading to false we have loaded everything at this point
		const apiKey = env.PUBLIC_GOOGLE_MAPS_API_KEY;
		if (!apiKey) {
			error = 'Google Maps API key is not configured. Please contact support.';
			isLoading = false;
			return;
		}

		try {
			//if we haven't initialized the google maps api, initialize it
			if (!hasInitializedGoogleMaps) {
				//set the google maps api key
				setOptions({
					key: apiKey,
					v: 'weekly',
					libraries: ['places']
				});
				hasInitializedGoogleMaps = true; // set is initialized to true
			}

			await importLibrary('maps');
			await importLibrary('places');
		} catch {
			error = 'Failed to load Google Maps. Check your internet connection and try again.';
			isLoading = false;
			return;
		}

		isLoading = false; // set is loading to false we have loaded everything at this point

		//create a new street view panorama
		const panorama = new google.maps.StreetViewPanorama(panoEl, {
			position: initialPosition,
			pov: { heading: 0, pitch: 0 },
			zoom: 1,
			addressControl: false,
			fullscreenControl: false,
			showRoadLabels: true
		});

		// listen for status changes
		// if the status is not ok set the error message
		// if the status is ok set the error message to null
		panorama.addListener('status_changed', () => {
			const status = panorama.getStatus();
			if (status !== google.maps.StreetViewStatus.OK) {
				error = 'No Street View coverage at this location. Try a nearby address.';
			} else {
				error = null;
			}
		});

		//create a new autocomplete object
		//this is used to autocomplete the address input
		const ac = new google.maps.places.Autocomplete(inputEl, {
			fields: ['geometry', 'formatted_address'],
			types: ['geocode']
		});

		let formattedAddress: string | undefined;

		// listen for place changes
		// if the place is not found set the error message
		// if the place is found set the error message to null
		// set the formatted address to the place formatted address
		// set the address to the place formatted address
		// set the panorama position to the place geometry location
		ac.addListener('place_changed', () => {
			const place = ac.getPlace();
			const loc = place.geometry?.location;
			if (!loc) return;

			error = null;
			formattedAddress = place.formatted_address ?? undefined;
			address = place.formatted_address ?? address;
			// set the panorama position to the place geometry location
			panorama.setPosition(loc);
		});

		// get the current capture meta
		// this is used to get the current capture meta
		// this is used to display the street view image
		// this is used to display the street view image
		function getCurrentMeta(): CaptureMeta | null {
			const pos = panorama.getPosition();
			const pov = panorama.getPov();
			const zoom = panorama.getZoom() ?? 1;
			const panoId = panorama.getPano() ?? undefined;
			if (!pos) return null;

			return {
				lat: pos.lat(),
				lng: pos.lng(),
				heading: pov.heading,
				pitch: pov.pitch,
				zoom,
				panoId,
				formattedAddress
			};
		}

		function emit() {
			const meta = getCurrentMeta();
			if (meta) onChange?.(meta);
		}

		if (getCurrentMetaRef) {
			getCurrentMetaRef.current = getCurrentMeta;
		}

		panorama.addListener('position_changed', emit);
		panorama.addListener('pov_changed', emit);
		panorama.addListener('pano_changed', emit);
		panorama.addListener('zoom_changed', emit);

		emit();
	});

	onDestroy(() => {
		if (getCurrentMetaRef) getCurrentMetaRef.current = null;
	});
</script>

<div>
	<Card>
		<CardContent class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
			<input
				bind:this={inputEl}
				bind:value={address}
				class="w-full rounded-md border bg-background px-3 py-2 text-sm"
				placeholder="Search an address…"
			/>
		</CardContent>
	</Card>
</div>

<div class="flex flex-col gap-3">
	{#if error}
		<div
			class="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive"
		>
			{error}
		</div>
	{/if}
	<div
		class="relative overflow-hidden rounded-xl border bg-muted/30"
		style={`height:${heightPx}px;`}
	>
		{#if isLoading}
			<div class="flex h-full w-full items-center justify-center">
				<p class="text-sm text-muted-foreground">Loading Street View…</p>
			</div>
		{/if}
		<div bind:this={panoEl} class="h-full w-full" class:hidden={isLoading && !!error}></div>
	</div>
</div>
