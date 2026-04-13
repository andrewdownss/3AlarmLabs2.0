/** Canonical division keys stored in DB and shown on the command board (column order). */
export declare const BOARD_COLUMN_KEYS: readonly ["Basement", "Div 1", "Div 2", "Div 3", "Roof", "RIC", "Med", "Reserve"];
export type BoardColumnKey = (typeof BOARD_COLUMN_KEYS)[number];
/** True if value is already a canonical column key. */
export declare function isBoardColumnKey(value: string): value is BoardColumnKey;
/**
 * Map parser output (boardColumn, division, location) to a canonical column key, or null.
 */
export declare function normalizeBoardColumn(parsed: Record<string, unknown>): BoardColumnKey | null;
/** Pull tactical rows from parser output (preferred) or legacy single-unit root fields. */
export declare function extractAssignmentActions(parsed: Record<string, unknown>): Record<string, unknown>[];
export declare function shouldPlaceAssignment(item: Record<string, unknown>, column: BoardColumnKey | null): boolean;
/**
 * Text to record as on-scene size-up (session event + UI). Null = no separate size-up for this transmission.
 */
export declare function resolveSizeUpSummary(parsed: Record<string, unknown>, transcript: string): string | null;
//# sourceMappingURL=trainer-board-columns.d.ts.map