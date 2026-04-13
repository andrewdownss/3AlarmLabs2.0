/** Canonical division keys stored in DB and shown on the command board (column order). */
export const BOARD_COLUMN_KEYS = [
	'Basement',
	'Div 1',
	'Div 2',
	'Div 3',
	'Roof',
	'RIC',
	'Med',
	'Reserve'
] as const;

export type BoardColumnKey = (typeof BOARD_COLUMN_KEYS)[number];

const KEY_SET = new Set<string>(BOARD_COLUMN_KEYS);

/** True if value is already a canonical column key. */
export function isBoardColumnKey(value: string): value is BoardColumnKey {
	return KEY_SET.has(value);
}

/**
 * Map parser output (boardColumn, division, location) to a canonical column key, or null.
 */
export function normalizeBoardColumn(parsed: Record<string, unknown>): BoardColumnKey | null {
	const raw = [parsed.boardColumn, parsed.division, parsed.location]
		.map((v) => (v == null ? '' : String(v).trim()))
		.find((s) => s.length > 0);
	if (!raw) return null;
	if (isBoardColumnKey(raw)) return raw;

	const t = raw.toLowerCase().replace(/\s+/g, ' ');

	const ifMatch = (patterns: string[], key: BoardColumnKey): boolean =>
		patterns.some((p) => t === p || t.includes(p));

	if (ifMatch(['basement', 'below grade', 'cellar'], 'Basement')) return 'Basement';
	if (
		ifMatch(['div 1', 'division 1', 'div1', 'd1', 'first division', 'floor 1', '1st floor'], 'Div 1')
	)
		return 'Div 1';
	if (ifMatch(['div 2', 'division 2', 'div2', 'd2', 'second division', 'floor 2', '2nd floor'], 'Div 2'))
		return 'Div 2';
	if (ifMatch(['div 3', 'division 3', 'div3', 'd3', 'third division', 'floor 3', '3rd floor'], 'Div 3'))
		return 'Div 3';
	if (ifMatch(['roof', 'rooftop', 'on the roof', 'aerial', 'vertical vent', 'ladder pipe', 'roof operations'], 'Roof'))
		return 'Roof';
	if (ifMatch(['ric', 'rapid intervention', 'rit', 'fast team'], 'RIC')) return 'RIC';
	if (ifMatch(['med', 'medical', 'ems', 'rehab'], 'Med')) return 'Med';
	if (ifMatch(['staging', 'staged', 'reserve', 'pool', 'unassigned', 'other'], 'Reserve'))
		return 'Reserve';

	return null;
}

/** Pull tactical rows from parser output (preferred) or legacy single-unit root fields. */
export function extractAssignmentActions(parsed: Record<string, unknown>): Record<string, unknown>[] {
	const raw = parsed.assignments;
	if (Array.isArray(raw) && raw.length > 0) {
		return raw.filter((x): x is Record<string, unknown> => x !== null && typeof x === 'object' && !Array.isArray(x));
	}
	const unit = parsed.unitName;
	if (unit != null && String(unit).trim() !== '') {
		return [
			{
				unitName: parsed.unitName,
				assignment: parsed.assignment,
				boardColumn: parsed.boardColumn,
				division: parsed.division,
				location: parsed.location,
				status: parsed.status
			}
		];
	}
	return [];
}

export function shouldPlaceAssignment(item: Record<string, unknown>, column: BoardColumnKey | null): boolean {
	if (!item.unitName || String(item.unitName).trim() === '') return false;
	if (!column) return false;
	return String(item.assignment ?? '').trim().length > 0;
}

/**
 * Text to record as on-scene size-up (session event + UI). Null = no separate size-up for this transmission.
 */
export function resolveSizeUpSummary(parsed: Record<string, unknown>, transcript: string): string | null {
	const direct = String(parsed.sizeUpSummary ?? '').trim();
	if (direct) return direct;
	const mt = String(parsed.messageType ?? '').toLowerCase();
	if (mt === 'size_up') {
		const s = String(parsed.summary ?? transcript).trim();
		return s || null;
	}
	return null;
}
