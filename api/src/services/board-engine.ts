export interface BoardEntry {
	id: string;
	division: string;
	unitName: string;
	assignment: string;
	status: string;
}

export function applyCommandToBoard(board: BoardEntry[], command: Record<string, unknown>): BoardEntry[] {
	const unitName = String(command.unitName ?? '');
	if (!unitName) return board;

	const entry: BoardEntry = {
		id: String(command.id ?? crypto.randomUUID()),
		division: String(command.division ?? 'Unassigned'),
		unitName,
		assignment: String(command.assignment ?? ''),
		status: String(command.status ?? 'Assigned')
	};

	const idx = board.findIndex(e => e.unitName === unitName);
	if (idx >= 0) {
		board[idx] = entry;
		return [...board];
	}
	return [...board, entry];
}
