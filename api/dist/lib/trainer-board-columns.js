export const WORKING_ASSIGNMENTS_SLOT_INDEX = 7;
export const DEFAULT_BOARD_COLUMNS = [
    { slotIndex: 0, kind: 'blank', label: '', supervisorUnit: null },
    { slotIndex: 1, kind: 'blank', label: '', supervisorUnit: null },
    { slotIndex: 2, kind: 'blank', label: '', supervisorUnit: null },
    { slotIndex: 3, kind: 'blank', label: '', supervisorUnit: null },
    { slotIndex: 4, kind: 'fixed', label: 'Roof', supervisorUnit: null, isFixed: true },
    { slotIndex: 5, kind: 'fixed', label: 'Med', supervisorUnit: null, isFixed: true },
    { slotIndex: 6, kind: 'fixed', label: 'RIC', supervisorUnit: null, isFixed: true },
    {
        slotIndex: WORKING_ASSIGNMENTS_SLOT_INDEX,
        kind: 'fixed',
        label: 'Working Assignments',
        supervisorUnit: null,
        isFixed: true
    }
];
export function normalizeBoardColumns(input) {
    const bySlot = new Map();
    if (Array.isArray(input)) {
        for (const item of input) {
            if (!item || typeof item !== 'object' || Array.isArray(item))
                continue;
            const slotIndex = Number(item.slotIndex);
            if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex > 7)
                continue;
            bySlot.set(slotIndex, item);
        }
    }
    return DEFAULT_BOARD_COLUMNS.map((fallback) => {
        const raw = bySlot.get(fallback.slotIndex);
        if (!raw)
            return { ...fallback };
        const isFixed = fallback.isFixed === true;
        const rawKind = raw.kind;
        const kind = isFixed
            ? 'fixed'
            : rawKind === 'group' || rawKind === 'division'
                ? rawKind
                : 'blank';
        const label = isFixed ? fallback.label : cleanBoardLabel(raw.label ?? '');
        return {
            slotIndex: fallback.slotIndex,
            kind,
            label: kind === 'blank' ? '' : label,
            supervisorUnit: cleanBoardLabel(raw.supervisorUnit ?? '') || null,
            isFixed
        };
    });
}
export function cleanBoardLabel(value) {
    return String(value ?? '').trim().replace(/\s+/g, ' ');
}
export function normalizeBoardColumn(parsed) {
    const raw = [parsed.boardColumn, parsed.division, parsed.location]
        .map((v) => (v == null ? '' : String(v).trim()))
        .find((s) => s.length > 0);
    if (!raw)
        return null;
    const t = raw.toLowerCase().replace(/\s+/g, ' ');
    const ifMatch = (patterns, key) => patterns.some((p) => t === p || t.includes(p)) ? key : null;
    const fixed = ifMatch(['roof', 'rooftop', 'on the roof', 'aerial', 'vertical vent', 'ladder pipe', 'roof operations'], 'Roof') ??
        ifMatch(['ric', 'rapid intervention', 'rit', 'fast team'], 'RIC') ??
        ifMatch(['med', 'medical', 'ems', 'rehab'], 'Med') ??
        ifMatch(['working assignments', 'staging', 'staged', 'reserve', 'pool', 'unassigned', 'other'], 'Working Assignments');
    if (fixed)
        return fixed;
    const divisionLabel = parseDivisionLabel(t);
    if (divisionLabel)
        return divisionLabel;
    return titleCaseLabel(raw);
}
/** Match geographic division labels without treating "div" as a prefix of "division". */
function parseDivisionLabel(t) {
    const divisionLong = t.match(/\bdivision\s+([a-z0-9]+)\b/);
    if (divisionLong?.[1])
        return `Division ${divisionLong[1].toUpperCase()}`;
    const divShort = t.match(/\bdiv\s+([a-z0-9]+)\b/);
    if (divShort?.[1])
        return `Division ${divShort[1].toUpperCase()}`;
    const floorMatch = t.match(/\b(?:floor|fl)\s+([a-z0-9]+)\b/);
    if (floorMatch?.[1])
        return `Division ${floorMatch[1].toUpperCase()}`;
    // Speech-to-text sometimes drops the leading "d" / "div"
    const isionMatch = t.match(/\b(?:d)?ision\s+([a-z0-9]+)\b/);
    if (isionMatch?.[1])
        return `Division ${isionMatch[1].toUpperCase()}`;
    return null;
}
/** Pull tactical rows from parser output (preferred) or legacy single-unit root fields. */
export function extractAssignmentActions(parsed) {
    const raw = parsed.assignments;
    if (Array.isArray(raw) && raw.length > 0) {
        return raw.filter((x) => x !== null && typeof x === 'object' && !Array.isArray(x));
    }
    const unit = parsed.unitName;
    if (unit != null && String(unit).trim() !== '') {
        return [
            {
                unitName: parsed.unitName,
                assignment: parsed.assignment,
                boardColumn: parsed.boardColumn,
                division: parsed.division,
                location: parsed.location,
                status: parsed.status
            }
        ];
    }
    return [];
}
export function extractSupervisorAssignmentActions(parsed) {
    const raw = parsed.supervisorAssignments;
    if (!Array.isArray(raw))
        return [];
    return raw
        .filter((x) => x !== null && typeof x === 'object' && !Array.isArray(x))
        .map((item) => {
        const unitName = cleanBoardLabel(item.unitName);
        const areaLabel = normalizeAreaLabel(item.areaLabel ?? item.boardColumn ?? item.division);
        const areaKind = String(item.areaKind ?? '').toLowerCase() === 'group' ? 'group' : 'division';
        const subordinateUnits = Array.isArray(item.subordinateUnits)
            ? item.subordinateUnits.map(cleanBoardLabel).filter(Boolean)
            : [];
        return { unitName, areaLabel, areaKind, subordinateUnits };
    })
        .filter((item) => item.unitName && item.areaLabel);
}
export function normalizeAreaLabel(value) {
    const direct = cleanBoardLabel(value);
    if (!direct)
        return '';
    const normalized = normalizeBoardColumn({ boardColumn: direct });
    return normalized ?? titleCaseLabel(direct);
}
export function shouldPlaceAssignment(item, column) {
    if (!item.unitName || String(item.unitName).trim() === '')
        return false;
    return Boolean(column || String(item.assignment ?? '').trim().length > 0);
}
/**
 * Text to record as on-scene size-up (session event + UI). Null = no separate size-up for this transmission.
 */
export function resolveSizeUpSummary(parsed, transcript) {
    const direct = String(parsed.sizeUpSummary ?? '').trim();
    if (direct)
        return direct;
    const mt = String(parsed.messageType ?? '').toLowerCase();
    if (mt === 'size_up') {
        const s = String(parsed.summary ?? transcript).trim();
        return s || null;
    }
    return null;
}
function titleCaseLabel(value) {
    return cleanBoardLabel(value)
        .toLowerCase()
        .split(' ')
        .map((part) => {
        if (part.length <= 3 && /^[a-z0-9]+$/.test(part))
            return part.toUpperCase();
        return part.charAt(0).toUpperCase() + part.slice(1);
    })
        .join(' ');
}
//# sourceMappingURL=trainer-board-columns.js.map