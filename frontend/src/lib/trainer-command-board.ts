/** Fixed command-board columns (order left → right). Reserve = last column (optional / staging). */
export const COMMAND_BOARD_COLUMNS: Array<{ key: string; header: string }> = [
	{ key: 'Basement', header: 'Basement' },
	{ key: 'Div 1', header: 'Div 1' },
	{ key: 'Div 2', header: 'Div 2' },
	{ key: 'Div 3', header: 'Div 3' },
	{ key: 'Roof', header: 'Roof' },
	{ key: 'RIC', header: 'RIC' },
	{ key: 'Med', header: 'Med' },
	{ key: 'Reserve', header: '' }
];

export interface BoardEntryLike {
	division: string;
	unitName: string;
	assignment: string;
	status: string;
	id?: string;
}

/** Entries in this column, top-to-bottom = stable sort by unit name then id. */
export function entriesForColumn(entries: BoardEntryLike[], columnKey: string): BoardEntryLike[] {
	return entries
		.filter((e) => e.division === columnKey)
		.slice()
		.sort((a, b) => {
			const u = a.unitName.localeCompare(b.unitName);
			if (u !== 0) return u;
			return (a.id ?? '').localeCompare(b.id ?? '');
		});
}

/** Entries whose division is not one of the fixed columns (legacy data). */
export function orphanBoardEntries(entries: BoardEntryLike[]): BoardEntryLike[] {
	const keys = new Set(COMMAND_BOARD_COLUMNS.map((c) => c.key));
	return entries.filter((e) => !keys.has(e.division));
}

export function formatUnitAssignmentLine(entry: BoardEntryLike): string {
	const task = entry.assignment?.trim();
	if (task) return `${entry.unitName} — ${task}`;
	return entry.unitName;
}
