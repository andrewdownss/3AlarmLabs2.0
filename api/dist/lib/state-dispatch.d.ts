/**
 * Shared "apply scenario state change" code path.
 *
 * Both the live instructor (`trainer:state:dispatch` socket event) and the
 * self-paced timeline engine (timer-fired or assignment-completion) call this
 * so the persisted event log + room broadcast stay identical between modes.
 */
import type { Server } from "socket.io";
import type { SelfPacedDispatchPayload } from "./self-paced.js";
export declare const VALID_STAGES: ReadonlySet<string>;
export declare const VALID_SIDES: ReadonlySet<string>;
export type DispatchSource = "instructor" | "timeline" | "completion" | "system";
export interface ApplyDispatchOptions {
    source: DispatchSource;
    /** Timeline / completion rule id, useful for replay analytics. */
    ruleId?: string;
    /** Authored simulation time for timeline events. */
    offsetSeconds?: number;
}
/**
 * Validate and apply a scenario state change. Returns the sanitized payload
 * that was actually broadcast (illegal stage/side values are dropped).
 */
export declare function applyStateDispatch(io: Server, sessionId: string, payload: SelfPacedDispatchPayload, options: ApplyDispatchOptions): Promise<SelfPacedDispatchPayload>;
//# sourceMappingURL=state-dispatch.d.ts.map