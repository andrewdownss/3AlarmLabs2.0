export function applyCommandToBoard(board, command) {
    const unitName = String(command.unitName ?? '');
    if (!unitName)
        return board;
    const entry = {
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
//# sourceMappingURL=board-engine.js.map