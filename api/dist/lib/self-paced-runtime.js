/**
 * Self-paced timeline runtime — pure-ish helpers that operate on a session
 * snapshot + scenario config. Stateful side effects (DB writes, broadcasts)
 * happen here so callers (HTTP routes, the background poller, the socket
 * handler) all share one code path.
 */
import { and, asc, eq, isNull, lte } from "drizzle-orm";
import { db } from "../db/index.js";
import { classrooms, trainerCommandBoardEntries, trainerScenarios, trainerScheduledEvents, trainerSessionEvents, trainerSessions, } from "../db/schema/trainer.js";
import { formatDispatchUpdateWithUnit, matchesAssignment, parseSelfPacedConfig, simulationElapsedMs, } from "./self-paced.js";
import { applyStateDispatch } from "./state-dispatch.js";
async function loadSession(sessionId) {
    const [row] = await db
        .select({
        id: trainerSessions.id,
        scenarioId: trainerSessions.scenarioId,
        hasStarted: trainerSessions.hasStarted,
        startedAt: trainerSessions.startedAt,
        pausedAt: trainerSessions.pausedAt,
        accumulatedPauseMs: trainerSessions.accumulatedPauseMs,
        endedAt: trainerSessions.endedAt,
        simulationOutcome: trainerSessions.simulationOutcome,
    })
        .from(trainerSessions)
        .where(eq(trainerSessions.id, sessionId))
        .limit(1);
    return row ?? null;
}
async function loadConfig(scenarioId) {
    const [row] = await db
        .select({ config: trainerScenarios.selfPacedConfigJson })
        .from(trainerScenarios)
        .where(eq(trainerScenarios.id, scenarioId))
        .limit(1);
    return parseSelfPacedConfig(row?.config ?? null);
}
async function loadDispatchedTimelineIds(sessionId) {
    const rows = await db
        .select({ payloadJson: trainerSessionEvents.payloadJson })
        .from(trainerSessionEvents)
        .where(and(eq(trainerSessionEvents.sessionId, sessionId), eq(trainerSessionEvents.eventType, "timeline_event_dispatched")));
    const out = new Set();
    for (const r of rows) {
        const id = r.payloadJson?.ruleId;
        if (typeof id === "string")
            out.add(id);
    }
    return out;
}
async function loadCompletedExpectedIds(sessionId) {
    const rows = await db
        .select({
        payloadJson: trainerSessionEvents.payloadJson,
        eventType: trainerSessionEvents.eventType,
    })
        .from(trainerSessionEvents)
        .where(eq(trainerSessionEvents.sessionId, sessionId));
    const out = new Set();
    for (const r of rows) {
        if (r.eventType === "expected_action_completed" ||
            r.eventType === "expected_action_delayed") {
            const id = r.payloadJson?.actionId;
            if (typeof id === "string")
                out.add(id);
        }
    }
    return out;
}
async function loadScheduledCompletionKeys(sessionId) {
    const rows = await db
        .select({
        ruleId: trainerScheduledEvents.ruleId,
        payloadJson: trainerScheduledEvents.payloadJson,
    })
        .from(trainerScheduledEvents)
        .where(and(eq(trainerScheduledEvents.sessionId, sessionId), eq(trainerScheduledEvents.kind, "assignment_completion")));
    const out = new Set();
    for (const r of rows) {
        if (r.ruleId)
            out.add(r.ruleId);
        const completionKey = r.payloadJson
            ?.completionKey;
        if (typeof completionKey === "string")
            out.add(completionKey);
    }
    return out;
}
/**
 * Runs every scripted check that depends on simulation time:
 * - timeline events whose offset has passed
 * - assignment-completion fires whose `fireAt` has passed
 * - missed expected-action deadlines
 * - time-limit timeout
 *
 * Idempotent — safe to call from a tick endpoint or background poller.
 */
export async function runTimelineTick(io, sessionId, now = new Date()) {
    const session = await loadSession(sessionId);
    if (!session || session.endedAt || !session.hasStarted || session.pausedAt)
        return;
    const config = await loadConfig(session.scenarioId);
    if (!config)
        return;
    const elapsedMs = simulationElapsedMs(session, now);
    const elapsedSec = Math.floor(elapsedMs / 1000);
    await dispatchDueTimelineEvents(io, session, config, elapsedSec);
    await fireDueScheduledEvents(io, session, now);
    await flagMissedExpectedActions(sessionId, config, elapsedSec);
    if (config.endConditions.onTimeExpired &&
        typeof config.timeLimitSeconds === "number" &&
        elapsedSec >= config.timeLimitSeconds) {
        await endSession(io, sessionId, {
            outcome: "timeout",
            reason: "time_limit_reached",
        });
    }
    else if (config.endConditions.onTimelineComplete &&
        config.timeline.length > 0 &&
        elapsedSec >=
            config.timeline.reduce((max, t) => Math.max(max, t.offsetSeconds), 0) &&
        (await dispatchedAllTimelineIds(sessionId, config))) {
        await endSession(io, sessionId, {
            outcome: "completed",
            reason: "timeline_complete",
        });
    }
}
async function dispatchedAllTimelineIds(sessionId, config) {
    const dispatched = await loadDispatchedTimelineIds(sessionId);
    return config.timeline.every((t) => dispatched.has(t.id));
}
async function dispatchDueTimelineEvents(io, session, config, elapsedSec) {
    if (config.timeline.length === 0)
        return;
    const dispatched = await loadDispatchedTimelineIds(session.id);
    const due = config.timeline
        .filter((t) => !dispatched.has(t.id) && t.offsetSeconds <= elapsedSec)
        .sort((a, b) => a.offsetSeconds - b.offsetSeconds);
    for (const event of due) {
        await applyStateDispatch(io, session.id, event.dispatch, {
            source: "timeline",
            ruleId: event.id,
            offsetSeconds: event.offsetSeconds,
        });
    }
}
async function fireDueScheduledEvents(io, session, now) {
    const due = await db
        .select()
        .from(trainerScheduledEvents)
        .where(and(eq(trainerScheduledEvents.sessionId, session.id), isNull(trainerScheduledEvents.firedAt), lte(trainerScheduledEvents.fireAt, now)))
        .orderBy(asc(trainerScheduledEvents.fireAt));
    for (const row of due) {
        await db
            .update(trainerScheduledEvents)
            .set({ firedAt: new Date() })
            .where(eq(trainerScheduledEvents.id, row.id));
        if (row.kind === "assignment_completion") {
            const payload = row.payloadJson;
            const dispatch = payload?.dispatch;
            const ruleId = typeof payload?.ruleId === "string"
                ? payload.ruleId
                : row.ruleId ?? undefined;
            if (dispatch && typeof dispatch === "object") {
                const raw = dispatch;
                const triggerUnit = typeof payload?.trigger?.unitName === "string"
                    ? payload.trigger.unitName
                    : undefined;
                const completionDispatch = { ...raw };
                if (raw.update?.trim()) {
                    completionDispatch.update = formatDispatchUpdateWithUnit(triggerUnit, raw.update);
                }
                await applyStateDispatch(io, session.id, completionDispatch, {
                    source: "completion",
                    ruleId,
                });
            }
        }
        else if (row.kind === "force_end") {
            await endSession(io, session.id, {
                outcome: "failed",
                reason: "force_end",
            });
        }
    }
}
async function flagMissedExpectedActions(sessionId, config, elapsedSec) {
    if (config.expectedActions.length === 0)
        return;
    const completed = await loadCompletedExpectedIds(sessionId);
    const flagged = await loadFlaggedMissedIds(sessionId);
    for (const action of config.expectedActions) {
        if (completed.has(action.id) || flagged.has(action.id))
            continue;
        if (typeof action.deadlineSeconds !== "number")
            continue;
        if (elapsedSec < action.deadlineSeconds)
            continue;
        await db.insert(trainerSessionEvents).values({
            id: crypto.randomUUID(),
            sessionId,
            eventType: "expected_action_missed",
            payloadJson: {
                actionId: action.id,
                label: action.label,
                deadlineSeconds: action.deadlineSeconds,
                atSeconds: elapsedSec,
            },
        });
    }
}
async function loadFlaggedMissedIds(sessionId) {
    const rows = await db
        .select({ payloadJson: trainerSessionEvents.payloadJson })
        .from(trainerSessionEvents)
        .where(and(eq(trainerSessionEvents.sessionId, sessionId), eq(trainerSessionEvents.eventType, "expected_action_missed")));
    const out = new Set();
    for (const r of rows) {
        const id = r.payloadJson?.actionId;
        if (typeof id === "string")
            out.add(id);
    }
    return out;
}
/**
 * Hook called whenever a board entry changes (radio assignment, manual fix,
 * etc). Evaluates expected actions and schedules any newly-triggered
 * assignment-completion follow-ups.
 */
export async function evaluateAfterBoardChange(io, sessionId) {
    const session = await loadSession(sessionId);
    if (!session || session.endedAt)
        return;
    const config = await loadConfig(session.scenarioId);
    if (!config)
        return;
    const board = await db
        .select({
        unitName: trainerCommandBoardEntries.unitName,
        assignment: trainerCommandBoardEntries.assignment,
    })
        .from(trainerCommandBoardEntries)
        .where(eq(trainerCommandBoardEntries.sessionId, sessionId));
    const elapsedMs = simulationElapsedMs(session);
    const elapsedSec = Math.floor(elapsedMs / 1000);
    await markExpectedActionsFromBoard(sessionId, config.expectedActions, board, elapsedSec);
    await scheduleAssignmentCompletions(sessionId, config.assignmentCompletions, board, new Date());
    void io;
}
async function markExpectedActionsFromBoard(sessionId, actions, board, elapsedSec) {
    if (actions.length === 0 || board.length === 0)
        return;
    const completed = await loadCompletedExpectedIds(sessionId);
    for (const action of actions) {
        if (completed.has(action.id))
            continue;
        const hit = board.find((b) => matchesAssignment(action.match, b));
        if (!hit)
            continue;
        const isLate = typeof action.deadlineSeconds === "number" &&
            elapsedSec > action.deadlineSeconds;
        await db.insert(trainerSessionEvents).values({
            id: crypto.randomUUID(),
            sessionId,
            eventType: isLate
                ? "expected_action_delayed"
                : "expected_action_completed",
            payloadJson: {
                actionId: action.id,
                label: action.label,
                atSeconds: elapsedSec,
                deadlineSeconds: action.deadlineSeconds ?? null,
                match: { unitName: hit.unitName, assignment: hit.assignment },
            },
        });
    }
}
async function scheduleAssignmentCompletions(sessionId, rules, board, now) {
    if (rules.length === 0 || board.length === 0)
        return;
    const alreadyScheduled = await loadScheduledCompletionKeys(sessionId);
    for (const rule of rules) {
        // Legacy scheduled rows used the authored rule id as the de-dupe key.
        if (alreadyScheduled.has(rule.id))
            continue;
        const hits = board.filter((b) => matchesAssignment(rule.trigger, b));
        if (hits.length === 0)
            continue;
        const fireAt = new Date(now.getTime() + rule.delaySeconds * 1000);
        for (const hit of hits) {
            const completionKey = assignmentCompletionKey(rule.id, hit);
            if (alreadyScheduled.has(completionKey))
                continue;
            await db.insert(trainerScheduledEvents).values({
                id: crypto.randomUUID(),
                sessionId,
                kind: "assignment_completion",
                ruleId: completionKey,
                fireAt,
                payloadJson: {
                    dispatch: rule.dispatch,
                    ruleId: rule.id,
                    completionKey,
                    trigger: hit,
                },
            });
            alreadyScheduled.add(completionKey);
        }
    }
}
function assignmentCompletionKey(ruleId, hit) {
    return [
        ruleId,
        hit.unitName.trim().toLowerCase(),
        (hit.assignment ?? "").trim().toLowerCase(),
    ].join("::");
}
/**
 * Idempotent finalize. Safe to call from manual end, timeout, failure,
 * or "force_end" scheduled events.
 */
export async function endSession(io, sessionId, opts) {
    const [row] = await db
        .select({
        endedAt: trainerSessions.endedAt,
        classroomId: trainerSessions.classroomId,
    })
        .from(trainerSessions)
        .where(eq(trainerSessions.id, sessionId))
        .limit(1);
    if (!row || row.endedAt)
        return;
    const endedAt = new Date();
    await db
        .update(trainerSessions)
        .set({ endedAt, simulationOutcome: opts.outcome, endReason: opts.reason })
        .where(eq(trainerSessions.id, sessionId));
    const eventType = opts.outcome === "failed"
        ? "session_failed"
        : opts.outcome === "completed"
            ? "session_completed"
            : opts.outcome === "timeout"
                ? "session_failed"
                : "session_ended";
    await db.insert(trainerSessionEvents).values({
        id: crypto.randomUUID(),
        sessionId,
        eventType,
        payloadJson: {
            outcome: opts.outcome,
            reason: opts.reason,
            ...(opts.payload ?? {}),
        },
    });
    io.to(`session:${sessionId}`).emit("trainer:session:ended", {
        outcome: opts.outcome,
        reason: opts.reason,
    });
    if (row.classroomId) {
        await db
            .update(classrooms)
            .set({ activeSessionId: null, calledOnParticipantId: null })
            .where(eq(classrooms.id, row.classroomId));
        io.to(`classroom:${row.classroomId}`).emit("classroom:scenario-ended", {
            outcome: opts.outcome,
            reason: opts.reason,
        });
    }
}
//# sourceMappingURL=self-paced-runtime.js.map