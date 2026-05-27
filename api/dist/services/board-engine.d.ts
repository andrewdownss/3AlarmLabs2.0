import { type BoardColumnState, type SupervisorAssignmentAction } from '../lib/trainer-board-columns.js';
export interface BoardEntry {
    id: string;
    slotIndex?: number | null;
    division: string;
    unitName: string;
    assignment: string | null;
    location?: string | null;
    status: string;
}
export interface TaskAssignmentAction {
    id?: string;
    unitName: string;
    assignment?: string | null;
    boardColumn?: string | null;
    division?: string | null;
    location?: string | null;
    status?: string | null;
}
export interface BoardState {
    columns: BoardColumnState[];
    entries: BoardEntry[];
}
export declare function applyTaskAssignment(columnsInput: unknown, entriesInput: BoardEntry[], action: TaskAssignmentAction): BoardState;
export declare function applySupervisorAssignment(columnsInput: unknown, entriesInput: BoardEntry[], action: SupervisorAssignmentAction): BoardState;
export declare function renameBoardColumn(columnsInput: unknown, slotIndex: number, label: string, kind: 'division' | 'group'): BoardColumnState[];
export declare function setColumnSupervisor(columnsInput: unknown, slotIndex: number, unitName: string, kind: 'division' | 'group', label?: string): BoardColumnState[];
export declare function clearBoardColumn(columnsInput: unknown, entriesInput: BoardEntry[], slotIndex: number): BoardState;
export declare function moveBoardEntry(columnsInput: unknown, entriesInput: BoardEntry[], entryId: string, targetSlotIndex: number): BoardState;
//# sourceMappingURL=board-engine.d.ts.map