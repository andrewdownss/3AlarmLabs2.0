import type { Server } from 'socket.io';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { trainerCommandBoardEntries, trainerSessions } from '../db/schema/trainer.js';
import {
	DEFAULT_BOARD_COLUMNS,
	extractAssignmentActions,
	extractSupervisorAssignmentActions,
	normalizeBoardColumn,
	normalizeBoardColumns,
	shouldPlaceAssignment,
	type BoardColumnState
} from './trainer-board-columns.js';
import {
	applySupervisorAssignment,
	applyTaskAssignment,
	moveBoardEntry,
	type BoardEntry
} from '../services/board-engine.js';

export interface LoadedBoardState {
	columns: BoardColumnState[];
	entries: BoardEntry[];
}

export async function loadBoardState(sessionId: string): Promise<LoadedBoardState> {
	const [session] = await db
		.select({ boardColumnsJson: trainerSessions.boardColumnsJson })
		.from(trainerSessions)
		.where(eq(trainerSessions.id, sessionId))
		.limit(1);
	const entries = await db
		.select()
		.from(trainerCommandBoardEntries)
		.where(eq(trainerCommandBoardEntries.sessionId, sessionId));
	const columns = normalizeBoardColumns(session?.boardColumnsJson);
	const shouldInfer = !Array.isArray(session?.boardColumnsJson) || session.boardColumnsJson.length === 0;
	if (!shouldInfer) return { columns, entries: entries as BoardEntry[] };

	const inferred = inferColumnsFromEntries(columns, entries as BoardEntry[]);
	await persistBoardState(sessionId, inferred.columns, inferred.entries);
	return inferred;
}

export async function persistBoardState(
	sessionId: string,
	columns: BoardColumnState[],
	entries: BoardEntry[]
): Promise<void> {
	await db
		.update(trainerSessions)
		.set({ boardColumnsJson: normalizeBoardColumns(columns) })
		.where(eq(trainerSessions.id, sessionId));

	for (const entry of entries) {
		const existing = await db
			.select({ id: trainerCommandBoardEntries.id })
			.from(trainerCommandBoardEntries)
			.where(
				and(
					eq(trainerCommandBoardEntries.sessionId, sessionId),
					eq(trainerCommandBoardEntries.unitName, entry.unitName)
				)
			)
			.limit(1);
		const values = {
			slotIndex: entry.slotIndex ?? null,
			division: entry.division,
			assignment: entry.assignment ?? '',
			location: entry.location ?? '',
			status: entry.status,
			lastUpdatedAt: new Date()
		};
		if (existing[0]) {
			await db.update(trainerCommandBoardEntries).set(values).where(eq(trainerCommandBoardEntries.id, existing[0].id));
		} else {
			await db.insert(trainerCommandBoardEntries).values({
				id: entry.id,
				sessionId,
				unitName: entry.unitName,
				...values
			});
		}
	}
}

export async function applyParsedCommandToBoard(
	io: Server,
	sessionId: string,
	parsedCommand: Record<string, unknown>
): Promise<boolean> {
	let { columns, entries } = await loadBoardState(sessionId);
	let changed = false;

	for (const action of extractAssignmentActions(parsedCommand)) {
		const boardColumn = normalizeBoardColumn(action);
		if (!shouldPlaceAssignment(action, boardColumn)) continue;
		({ columns, entries } = applyTaskAssignment(columns, entries, {
			unitName: String(action.unitName),
			assignment: String(action.assignment ?? ''),
			boardColumn,
			division: String(action.division ?? ''),
			location: String(action.location ?? ''),
			status: String(action.status ?? 'Assigned').trim() || 'Assigned'
		}));
		changed = true;
	}

	for (const action of extractSupervisorAssignmentActions(parsedCommand)) {
		({ columns, entries } = applySupervisorAssignment(columns, entries, action));
		changed = true;
	}

	if (!changed) return false;
	await persistBoardState(sessionId, columns, entries);
	broadcastBoardState(io, sessionId, columns, entries);
	return true;
}

export async function movePersistedBoardEntry(
	io: Server,
	sessionId: string,
	entryId: string,
	targetSlotIndex: number
): Promise<void> {
	const state = await loadBoardState(sessionId);
	const next = moveBoardEntry(state.columns, state.entries, entryId, targetSlotIndex);
	await persistBoardState(sessionId, next.columns, next.entries);
	broadcastBoardState(io, sessionId, next.columns, next.entries);
}

export function broadcastBoardState(
	io: Server,
	sessionId: string,
	boardColumns: BoardColumnState[],
	boardEntries: BoardEntry[]
): void {
	io.to(`session:${sessionId}`).emit('trainer:board:updated', {
		boardColumns,
		entries: boardEntries,
		entry: boardEntries.at(-1) ?? null
	});
}

function inferColumnsFromEntries(columnsInput: BoardColumnState[], entriesInput: BoardEntry[]): LoadedBoardState {
	const columns = normalizeBoardColumns(columnsInput);
	const entries = entriesInput.map((entry) => ({ ...entry }));
	for (const entry of entries) {
		const label = normalizeBoardColumn({ boardColumn: entry.division }) ?? entry.division;
		let slot = columns.find((column) => column.label.toLowerCase() === label.toLowerCase());
		if (!slot) {
			slot = columns.find((column) => !column.isFixed && column.kind === 'blank');
			if (slot) {
				slot.kind = label.toLowerCase().includes('division') ? 'division' : 'group';
				slot.label = label;
			}
		}
		if (!slot) slot = columns[DEFAULT_BOARD_COLUMNS.length - 1];
		entry.slotIndex = slot.slotIndex;
		entry.division = slot.label;
	}
	return { columns, entries };
}
