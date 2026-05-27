import type { Server } from 'socket.io';
import { type BoardColumnState } from './trainer-board-columns.js';
import { type BoardEntry } from '../services/board-engine.js';
export interface LoadedBoardState {
    columns: BoardColumnState[];
    entries: BoardEntry[];
}
export declare function loadBoardState(sessionId: string): Promise<LoadedBoardState>;
export declare function persistBoardState(sessionId: string, columns: BoardColumnState[], entries: BoardEntry[]): Promise<void>;
export declare function applyParsedCommandToBoard(io: Server, sessionId: string, parsedCommand: Record<string, unknown>): Promise<boolean>;
export declare function movePersistedBoardEntry(io: Server, sessionId: string, entryId: string, targetSlotIndex: number): Promise<void>;
export declare function broadcastBoardState(io: Server, sessionId: string, boardColumns: BoardColumnState[], boardEntries: BoardEntry[]): void;
//# sourceMappingURL=board-persistence.d.ts.map