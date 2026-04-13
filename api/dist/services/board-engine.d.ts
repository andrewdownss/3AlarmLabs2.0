export interface BoardEntry {
    id: string;
    division: string;
    unitName: string;
    assignment: string;
    status: string;
}
export declare function applyCommandToBoard(board: BoardEntry[], command: Record<string, unknown>): BoardEntry[];
//# sourceMappingURL=board-engine.d.ts.map