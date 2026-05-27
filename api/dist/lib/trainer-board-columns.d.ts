export type BoardColumnKind = 'blank' | 'group' | 'division' | 'fixed';
export interface BoardColumnState {
    slotIndex: number;
    kind: BoardColumnKind;
    label: string;
    supervisorUnit: string | null;
    isFixed?: boolean;
}
export interface SupervisorAssignmentAction {
    unitName: string;
    areaLabel: string;
    areaKind: 'division' | 'group';
    subordinateUnits: string[];
}
export declare const WORKING_ASSIGNMENTS_SLOT_INDEX = 7;
export declare const DEFAULT_BOARD_COLUMNS: BoardColumnState[];
export declare function normalizeBoardColumns(input: unknown): BoardColumnState[];
export declare function cleanBoardLabel(value: unknown): string;
export declare function normalizeBoardColumn(parsed: Record<string, unknown>): string | null;
/** Pull tactical rows from parser output (preferred) or legacy single-unit root fields. */
export declare function extractAssignmentActions(parsed: Record<string, unknown>): Record<string, unknown>[];
export declare function extractSupervisorAssignmentActions(parsed: Record<string, unknown>): SupervisorAssignmentAction[];
export declare function normalizeAreaLabel(value: unknown): string;
export declare function shouldPlaceAssignment(item: Record<string, unknown>, column: string | null): boolean;
/**
 * Text to record as on-scene size-up (session event + UI). Null = no separate size-up for this transmission.
 */
export declare function resolveSizeUpSummary(parsed: Record<string, unknown>, transcript: string): string | null;
//# sourceMappingURL=trainer-board-columns.d.ts.map