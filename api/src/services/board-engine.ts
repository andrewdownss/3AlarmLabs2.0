import {
	WORKING_ASSIGNMENTS_SLOT_INDEX,
	cleanBoardLabel,
	normalizeAreaLabel,
	normalizeBoardColumn,
	normalizeBoardColumns,
	type BoardColumnState,
	type SupervisorAssignmentAction
} from '../lib/trainer-board-columns.js';

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

export function applyTaskAssignment(
	columnsInput: unknown,
	entriesInput: BoardEntry[],
	action: TaskAssignmentAction
): BoardState {
	const columns = normalizeBoardColumns(columnsInput);
	const entries = entriesInput.map((entry) => ({ ...entry }));
	const unitName = cleanBoardLabel(action.unitName);
	if (!unitName) return { columns, entries };

	const assignment = cleanBoardLabel(action.assignment ?? '');
	const requestedLabel =
		normalizeBoardColumn(action as unknown as Record<string, unknown>) ??
		(assignment ? normalizeAreaLabel(assignment) : 'Working Assignments');
	const slot = resolveSlot(columns, requestedLabel, { createIfMissing: requestedLabel !== 'Working Assignments' });
	const division = slot.label || 'Working Assignments';
	const idx = entries.findIndex((entry) => sameUnit(entry.unitName, unitName));
	const nextEntry: BoardEntry = {
		id: idx >= 0 ? entries[idx].id : action.id ?? crypto.randomUUID(),
		slotIndex: slot.slotIndex,
		division,
		unitName,
		assignment,
		location: cleanBoardLabel(action.location ?? ''),
		status: cleanBoardLabel(action.status ?? 'Assigned') || 'Assigned'
	};

	if (idx >= 0) entries[idx] = nextEntry;
	else entries.push(nextEntry);

	return { columns, entries };
}

export function applySupervisorAssignment(
	columnsInput: unknown,
	entriesInput: BoardEntry[],
	action: SupervisorAssignmentAction
): BoardState {
	const columns = normalizeBoardColumns(columnsInput);
	const entries = entriesInput.map((entry) => ({ ...entry }));
	const unitName = cleanBoardLabel(action.unitName);
	const areaLabel = normalizeAreaLabel(action.areaLabel);
	if (!unitName || !areaLabel) return { columns, entries };

	const subordinateUnits = action.subordinateUnits.map(cleanBoardLabel).filter(Boolean);
	const slot =
		findSlotByLabel(columns, areaLabel) ??
		findFirstEntrySlot(columns, entries, subordinateUnits) ??
		findEntrySlot(columns, entries, unitName) ??
		firstBlankSlot(columns) ??
		columns[WORKING_ASSIGNMENTS_SLOT_INDEX];

	slot.kind = action.areaKind;
	slot.label = areaLabel;
	slot.supervisorUnit = unitName;

	const division = slot.label;
	for (const subordinate of subordinateUnits) {
		const idx = entries.findIndex((entry) => sameUnit(entry.unitName, subordinate));
		if (idx >= 0) {
			entries[idx] = { ...entries[idx], slotIndex: slot.slotIndex, division };
		}
	}

	const supervisorIdx = entries.findIndex((entry) => sameUnit(entry.unitName, unitName));
	const supervisorEntry: BoardEntry = {
		id: supervisorIdx >= 0 ? entries[supervisorIdx].id : crypto.randomUUID(),
		slotIndex: slot.slotIndex,
		division,
		unitName,
		assignment: `${areaLabel} supervisor`,
		location: '',
		status: 'Operating'
	};
	if (supervisorIdx >= 0) entries[supervisorIdx] = { ...entries[supervisorIdx], ...supervisorEntry };
	else entries.push(supervisorEntry);

	return { columns, entries };
}

export function renameBoardColumn(columnsInput: unknown, slotIndex: number, label: string, kind: 'division' | 'group'): BoardColumnState[] {
	const columns = normalizeBoardColumns(columnsInput);
	const slot = columns.find((column) => column.slotIndex === slotIndex && !column.isFixed);
	if (!slot) return columns;
	slot.kind = kind;
	slot.label = normalizeAreaLabel(label);
	return columns;
}

export function setColumnSupervisor(
	columnsInput: unknown,
	slotIndex: number,
	unitName: string,
	kind: 'division' | 'group',
	label?: string
): BoardColumnState[] {
	const columns = normalizeBoardColumns(columnsInput);
	const slot = columns.find((column) => column.slotIndex === slotIndex && !column.isFixed);
	if (!slot) return columns;
	slot.kind = kind;
	if (label) slot.label = normalizeAreaLabel(label);
	slot.supervisorUnit = cleanBoardLabel(unitName) || null;
	return columns;
}

export function clearBoardColumn(columnsInput: unknown, entriesInput: BoardEntry[], slotIndex: number): BoardState {
	const columns = normalizeBoardColumns(columnsInput);
	const entries = entriesInput.map((entry) => ({ ...entry }));
	const slot = columns.find((column) => column.slotIndex === slotIndex && !column.isFixed);
	const workingSlot = columns[WORKING_ASSIGNMENTS_SLOT_INDEX];
	if (!slot) return { columns, entries };
	for (const entry of entries) {
		if (entry.slotIndex === slot.slotIndex) {
			entry.slotIndex = workingSlot.slotIndex;
			entry.division = workingSlot.label;
		}
	}
	slot.kind = 'blank';
	slot.label = '';
	slot.supervisorUnit = null;
	return { columns, entries };
}

export function moveBoardEntry(columnsInput: unknown, entriesInput: BoardEntry[], entryId: string, targetSlotIndex: number): BoardState {
	const columns = normalizeBoardColumns(columnsInput);
	const entries = entriesInput.map((entry) => ({ ...entry }));
	const slot = columns.find((column) => column.slotIndex === targetSlotIndex) ?? columns[WORKING_ASSIGNMENTS_SLOT_INDEX];
	const idx = entries.findIndex((entry) => entry.id === entryId);
	if (idx >= 0) {
		entries[idx] = { ...entries[idx], slotIndex: slot.slotIndex, division: slot.label || 'Working Assignments' };
	}
	return { columns, entries };
}

function resolveSlot(columns: BoardColumnState[], label: string, options: { createIfMissing: boolean }): BoardColumnState {
	const fixedOrExisting = findSlotByLabel(columns, label);
	if (fixedOrExisting) return fixedOrExisting;
	if (!options.createIfMissing) return columns[WORKING_ASSIGNMENTS_SLOT_INDEX];
	const blank = firstBlankSlot(columns);
	if (!blank) return columns[WORKING_ASSIGNMENTS_SLOT_INDEX];
	blank.kind = 'group';
	blank.label = label;
	blank.supervisorUnit = null;
	return blank;
}

function findSlotByLabel(columns: BoardColumnState[], label: string): BoardColumnState | undefined {
	const normalized = cleanBoardLabel(label).toLowerCase();
	return columns.find((column) => cleanBoardLabel(column.label).toLowerCase() === normalized);
}

function firstBlankSlot(columns: BoardColumnState[]): BoardColumnState | undefined {
	return columns.find((column) => !column.isFixed && column.kind === 'blank');
}

function findFirstEntrySlot(columns: BoardColumnState[], entries: BoardEntry[], unitNames: string[]): BoardColumnState | undefined {
	for (const unitName of unitNames) {
		const slot = findEntrySlot(columns, entries, unitName);
		if (slot && !slot.isFixed) return slot;
	}
	return undefined;
}

function findEntrySlot(columns: BoardColumnState[], entries: BoardEntry[], unitName: string): BoardColumnState | undefined {
	const entry = entries.find((item) => sameUnit(item.unitName, unitName));
	if (entry?.slotIndex != null) return columns.find((column) => column.slotIndex === entry.slotIndex);
	return entry ? findSlotByLabel(columns, entry.division) : undefined;
}

function sameUnit(a: string, b: string): boolean {
	return cleanBoardLabel(a).toLowerCase() === cleanBoardLabel(b).toLowerCase();
}
