import { WORKING_ASSIGNMENTS_SLOT_INDEX, cleanBoardLabel, normalizeAreaLabel, normalizeBoardColumn, normalizeBoardColumns } from '../lib/trainer-board-columns.js';
export function applyTaskAssignment(columnsInput, entriesInput, action) {
    const columns = normalizeBoardColumns(columnsInput);
    const entries = entriesInput.map((entry) => ({ ...entry }));
    const unitName = cleanBoardLabel(action.unitName);
    if (!unitName)
        return { columns, entries };
    const assignment = cleanBoardLabel(action.assignment ?? '');
    const requestedLabel = normalizeBoardColumn(action) ??
        (assignment ? normalizeAreaLabel(assignment) : 'Working Assignments');
    const slot = resolveSlot(columns, requestedLabel, { createIfMissing: requestedLabel !== 'Working Assignments' });
    const division = slot.label || 'Working Assignments';
    const idx = entries.findIndex((entry) => sameUnit(entry.unitName, unitName));
    const nextEntry = {
        id: idx >= 0 ? entries[idx].id : action.id ?? crypto.randomUUID(),
        slotIndex: slot.slotIndex,
        division,
        unitName,
        assignment,
        location: cleanBoardLabel(action.location ?? ''),
        status: cleanBoardLabel(action.status ?? 'Assigned') || 'Assigned'
    };
    if (idx >= 0)
        entries[idx] = nextEntry;
    else
        entries.push(nextEntry);
    return { columns, entries };
}
export function applySupervisorAssignment(columnsInput, entriesInput, action) {
    const columns = normalizeBoardColumns(columnsInput);
    const entries = entriesInput.map((entry) => ({ ...entry }));
    const unitName = cleanBoardLabel(action.unitName);
    const areaLabel = normalizeAreaLabel(action.areaLabel);
    if (!unitName || !areaLabel)
        return { columns, entries };
    const subordinateUnits = action.subordinateUnits.map(cleanBoardLabel).filter(Boolean);
    const slot = findSlotByLabel(columns, areaLabel) ??
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
    const supervisorEntry = {
        id: supervisorIdx >= 0 ? entries[supervisorIdx].id : crypto.randomUUID(),
        slotIndex: slot.slotIndex,
        division,
        unitName,
        assignment: `${areaLabel} supervisor`,
        location: '',
        status: 'Operating'
    };
    if (supervisorIdx >= 0)
        entries[supervisorIdx] = { ...entries[supervisorIdx], ...supervisorEntry };
    else
        entries.push(supervisorEntry);
    return { columns, entries };
}
export function renameBoardColumn(columnsInput, slotIndex, label, kind) {
    const columns = normalizeBoardColumns(columnsInput);
    const slot = columns.find((column) => column.slotIndex === slotIndex && !column.isFixed);
    if (!slot)
        return columns;
    slot.kind = kind;
    slot.label = normalizeAreaLabel(label);
    return columns;
}
export function setColumnSupervisor(columnsInput, slotIndex, unitName, kind, label) {
    const columns = normalizeBoardColumns(columnsInput);
    const slot = columns.find((column) => column.slotIndex === slotIndex && !column.isFixed);
    if (!slot)
        return columns;
    slot.kind = kind;
    if (label)
        slot.label = normalizeAreaLabel(label);
    slot.supervisorUnit = cleanBoardLabel(unitName) || null;
    return columns;
}
export function clearBoardColumn(columnsInput, entriesInput, slotIndex) {
    const columns = normalizeBoardColumns(columnsInput);
    const entries = entriesInput.map((entry) => ({ ...entry }));
    const slot = columns.find((column) => column.slotIndex === slotIndex && !column.isFixed);
    const workingSlot = columns[WORKING_ASSIGNMENTS_SLOT_INDEX];
    if (!slot)
        return { columns, entries };
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
export function moveBoardEntry(columnsInput, entriesInput, entryId, targetSlotIndex) {
    const columns = normalizeBoardColumns(columnsInput);
    const entries = entriesInput.map((entry) => ({ ...entry }));
    const slot = columns.find((column) => column.slotIndex === targetSlotIndex) ?? columns[WORKING_ASSIGNMENTS_SLOT_INDEX];
    const idx = entries.findIndex((entry) => entry.id === entryId);
    if (idx >= 0) {
        entries[idx] = { ...entries[idx], slotIndex: slot.slotIndex, division: slot.label || 'Working Assignments' };
    }
    return { columns, entries };
}
function resolveSlot(columns, label, options) {
    const fixedOrExisting = findSlotByLabel(columns, label);
    if (fixedOrExisting)
        return fixedOrExisting;
    if (!options.createIfMissing)
        return columns[WORKING_ASSIGNMENTS_SLOT_INDEX];
    const blank = firstBlankSlot(columns);
    if (!blank)
        return columns[WORKING_ASSIGNMENTS_SLOT_INDEX];
    blank.kind = 'group';
    blank.label = label;
    blank.supervisorUnit = null;
    return blank;
}
function findSlotByLabel(columns, label) {
    const normalized = cleanBoardLabel(label).toLowerCase();
    return columns.find((column) => cleanBoardLabel(column.label).toLowerCase() === normalized);
}
function firstBlankSlot(columns) {
    return columns.find((column) => !column.isFixed && column.kind === 'blank');
}
function findFirstEntrySlot(columns, entries, unitNames) {
    for (const unitName of unitNames) {
        const slot = findEntrySlot(columns, entries, unitName);
        if (slot && !slot.isFixed)
            return slot;
    }
    return undefined;
}
function findEntrySlot(columns, entries, unitName) {
    const entry = entries.find((item) => sameUnit(item.unitName, unitName));
    if (entry?.slotIndex != null)
        return columns.find((column) => column.slotIndex === entry.slotIndex);
    return entry ? findSlotByLabel(columns, entry.division) : undefined;
}
function sameUnit(a, b) {
    return cleanBoardLabel(a).toLowerCase() === cleanBoardLabel(b).toLowerCase();
}
//# sourceMappingURL=board-engine.js.map