import { browser } from '$app/environment';
import { DEMO_REPLAY_STORAGE_KEY } from './constants';

export interface DemoReplayEvent {
	id: string;
	type: string;
	text: string;
	time: string;
	atSecond: number;
}

export interface DemoReplayBoardEntry {
	id: string;
	division: string;
	unitName: string;
	assignment: string;
	status: string;
}

export interface DemoReplayPayload {
	version: 1;
	scenarioTitle: string;
	scenarioId: string | null;
	startedAt: string;
	endedAt: string;
	durationSeconds: number;
	events: DemoReplayEvent[];
	boardEntries: DemoReplayBoardEntry[];
	radioSecondsUsed: number;
}

export function saveDemoReplay(payload: DemoReplayPayload): void {
	if (!browser) return;
	try {
		localStorage.setItem(DEMO_REPLAY_STORAGE_KEY, JSON.stringify(payload));
	} catch {
		/* quota or private mode */
	}
}

export function loadDemoReplay(): DemoReplayPayload | null {
	if (!browser) return null;
	try {
		const raw = localStorage.getItem(DEMO_REPLAY_STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as DemoReplayPayload;
		if (parsed?.version !== 1) return null;
		return parsed;
	} catch {
		return null;
	}
}

export function clearDemoReplay(): void {
	if (!browser) return;
	try {
		localStorage.removeItem(DEMO_REPLAY_STORAGE_KEY);
	} catch {
		/* ignore */
	}
}
