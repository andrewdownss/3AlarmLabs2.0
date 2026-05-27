export type BoardColumnKind = 'blank' | 'group' | 'division' | 'fixed';

export interface BoardColumnState {
	slotIndex: number;
	key: string;
	kind: BoardColumnKind;
	label: string;
	header: string;
	supervisorUnit: string | null;
	isFixed?: boolean;
	colorClass: string;
}

const DEFAULT_COLUMNS: Array<Omit<BoardColumnState, 'key' | 'header' | 'colorClass'>> = [
	{ slotIndex: 0, kind: 'blank', label: '', supervisorUnit: null },
	{ slotIndex: 1, kind: 'blank', label: '', supervisorUnit: null },
	{ slotIndex: 2, kind: 'blank', label: '', supervisorUnit: null },
	{ slotIndex: 3, kind: 'blank', label: '', supervisorUnit: null },
	{ slotIndex: 4, kind: 'fixed', label: 'Roof', supervisorUnit: null, isFixed: true },
	{ slotIndex: 5, kind: 'fixed', label: 'Med', supervisorUnit: null, isFixed: true },
	{ slotIndex: 6, kind: 'fixed', label: 'RIC', supervisorUnit: null, isFixed: true },
	{ slotIndex: 7, kind: 'fixed', label: 'Working Assignments', supervisorUnit: null, isFixed: true }
];

const SLOT_COLORS = [
	'border-slate-300 bg-slate-50/80',
	'border-blue-300 bg-blue-50/80',
	'border-amber-300 bg-amber-50/80',
	'border-emerald-300 bg-emerald-50/80',
	'border-purple-300 bg-purple-50/80',
	'border-pink-300 bg-pink-50/80',
	'border-red-300 bg-red-50/80',
	'border-zinc-300 bg-zinc-50/80'
];

export const COMMAND_BOARD_COLUMNS = buildBoardColumns();

export function buildBoardColumns(input: unknown = []): BoardColumnState[] {
	const bySlot = new Map<number, Partial<BoardColumnState>>();
	if (Array.isArray(input)) {
		for (const raw of input) {
			if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
			const slotIndex = Number((raw as { slotIndex?: unknown }).slotIndex);
			if (Number.isInteger(slotIndex) && slotIndex >= 0 && slotIndex <= 7) {
				bySlot.set(slotIndex, raw as Partial<BoardColumnState>);
			}
		}
	}

	return DEFAULT_COLUMNS.map((fallback) => {
		const raw = bySlot.get(fallback.slotIndex);
		const isFixed = fallback.isFixed === true;
		const kind = isFixed
			? 'fixed'
			: raw?.kind === 'division' || raw?.kind === 'group'
				? raw.kind
				: 'blank';
		const label = isFixed ? fallback.label : kind === 'blank' ? '' : cleanLabel(raw?.label);
		const header = label || '(empty)';
		return {
			...fallback,
			kind,
			label,
			key: String(fallback.slotIndex),
			header,
			supervisorUnit: cleanLabel(raw?.supervisorUnit) || null,
			colorClass: colorForColumn(fallback.slotIndex, kind, isFixed)
		};
	});
}

export function commandBoardHeader(column: { header: string }): string {
	return column.header;
}

export interface BoardEntryLike {
	division: string;
	slotIndex?: number | null;
	unitName: string;
	assignment: string | null;
	status: string;
	id?: string;
}

/** Entries in this column, top-to-bottom = stable sort by unit name then id. */
export function entriesForColumn(entries: BoardEntryLike[], column: string | number | { slotIndex: number; label: string }): BoardEntryLike[] {
	const slotIndex = typeof column === 'object' ? column.slotIndex : typeof column === 'number' ? column : null;
	const label = typeof column === 'object' ? column.label : typeof column === 'string' ? column : '';
	return entries
		.filter((e) => (slotIndex != null ? e.slotIndex === slotIndex || (!e.slotIndex && e.division === label) : e.division === label))
		.slice()
		.sort((a, b) => {
			const u = a.unitName.localeCompare(b.unitName);
			if (u !== 0) return u;
			return (a.id ?? '').localeCompare(b.id ?? '');
		});
}

/** Entries whose division is not one of the fixed columns (legacy data). */
export function orphanBoardEntries(entries: BoardEntryLike[]): BoardEntryLike[] {
	const keys = new Set(COMMAND_BOARD_COLUMNS.map((c) => c.label));
	return entries.filter((e) => !keys.has(e.division));
}

export function formatUnitAssignmentLine(entry: BoardEntryLike): string {
	const task = entry.assignment?.trim();
	if (task) return `${entry.unitName} — ${task}`;
	return entry.unitName;
}

function cleanLabel(value: unknown): string {
	return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function colorForColumn(slotIndex: number, kind: BoardColumnKind, isFixed: boolean): string {
	if (isFixed) return SLOT_COLORS[slotIndex] ?? 'border-zinc-300 bg-zinc-50/80';
	if (kind === 'blank') return 'border-slate-200 bg-slate-50/60';
	if (kind === 'division') return SLOT_COLORS[slotIndex] ?? 'border-blue-300 bg-blue-50/80';
	return SLOT_COLORS[slotIndex] ?? 'border-emerald-300 bg-emerald-50/80';
}
