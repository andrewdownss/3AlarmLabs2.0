/**
 * Self-paced timeline runtime — pure-ish helpers that operate on a session
 * snapshot + scenario config. Stateful side effects (DB writes, broadcasts)
 * happen here so callers (HTTP routes, the background poller, the socket
 * handler) all share one code path.
 */
import type { Server } from "socket.io";
import { type SimulationOutcome, type SimulationTimingFields } from "./self-paced.js";
export interface RuntimeSession extends SimulationTimingFields {
    id: string;
    scenarioId: string;
    endedAt: Date | null;
    simulationOutcome: SimulationOutcome;
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
export declare function runTimelineTick(io: Server, sessionId: string, now?: Date): Promise<void>;
/**
 * Hook called whenever a board entry changes (radio assignment, manual fix,
 * etc). Evaluates expected actions and schedules any newly-triggered
 * assignment-completion follow-ups.
 */
export declare function evaluateAfterBoardChange(io: Server, sessionId: string): Promise<void>;
export interface EndSessionOptions {
    outcome: SimulationOutcome;
    reason: string;
    payload?: Record<string, unknown>;
}
/**
 * Idempotent finalize. Safe to call from manual end, timeout, failure,
 * or "force_end" scheduled events.
 */
export declare function endSession(io: Server, sessionId: string, opts: EndSessionOptions): Promise<void>;
//# sourceMappingURL=self-paced-runtime.d.ts.map