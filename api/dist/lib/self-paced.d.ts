/**
 * Mirror of `frontend/src/lib/self-paced.ts` — keep them in sync.
 * Shared by API routes, the timeline engine, and the radio matcher.
 */
import { z } from 'zod';
export type SimulationOutcome = 'in_progress' | 'completed' | 'failed' | 'timeout';
export type SelfPacedScheduledEventKind = 'assignment_completion' | 'time_warning' | 'force_end';
export interface SelfPacedDispatchPayload {
    stage?: 'incipient' | 'growth' | 'fully_developed' | 'decay';
    side?: 'alpha' | 'bravo' | 'charlie' | 'delta';
    hazard?: string;
    update?: string;
}
export interface TimelineEvent {
    id: string;
    offsetSeconds: number;
    label?: string;
    dispatch: SelfPacedDispatchPayload;
}
export interface AssignmentMatch {
    unitName?: string;
    assignmentContains?: string;
}
export interface ExpectedAction {
    id: string;
    label: string;
    match: AssignmentMatch;
    deadlineSeconds?: number;
    critical?: boolean;
}
export interface AssignmentCompletionRule {
    id: string;
    label?: string;
    trigger: AssignmentMatch;
    delaySeconds: number;
    dispatch: SelfPacedDispatchPayload;
}
export interface SelfPacedEndConditions {
    onUnderControl?: boolean;
    onTimelineComplete?: boolean;
    onTimeExpired?: boolean;
}
export interface SelfPacedConfig {
    timeLimitSeconds?: number;
    timeline: TimelineEvent[];
    expectedActions: ExpectedAction[];
    assignmentCompletions: AssignmentCompletionRule[];
    endConditions: SelfPacedEndConditions;
}
export declare const stageEnum: z.ZodEnum<["incipient", "growth", "fully_developed", "decay"]>;
export declare const sideEnum: z.ZodEnum<["alpha", "bravo", "charlie", "delta"]>;
export declare const dispatchPayloadSchema: z.ZodEffects<z.ZodObject<{
    stage: z.ZodOptional<z.ZodEnum<["incipient", "growth", "fully_developed", "decay"]>>;
    side: z.ZodOptional<z.ZodEnum<["alpha", "bravo", "charlie", "delta"]>>;
    hazard: z.ZodOptional<z.ZodString>;
    update: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    stage?: "incipient" | "growth" | "fully_developed" | "decay" | undefined;
    side?: "alpha" | "bravo" | "charlie" | "delta" | undefined;
    hazard?: string | undefined;
    update?: string | undefined;
}, {
    stage?: "incipient" | "growth" | "fully_developed" | "decay" | undefined;
    side?: "alpha" | "bravo" | "charlie" | "delta" | undefined;
    hazard?: string | undefined;
    update?: string | undefined;
}>, {
    stage?: "incipient" | "growth" | "fully_developed" | "decay" | undefined;
    side?: "alpha" | "bravo" | "charlie" | "delta" | undefined;
    hazard?: string | undefined;
    update?: string | undefined;
}, {
    stage?: "incipient" | "growth" | "fully_developed" | "decay" | undefined;
    side?: "alpha" | "bravo" | "charlie" | "delta" | undefined;
    hazard?: string | undefined;
    update?: string | undefined;
}>;
export declare const assignmentMatchSchema: z.ZodEffects<z.ZodObject<{
    unitName: z.ZodOptional<z.ZodString>;
    assignmentContains: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    unitName?: string | undefined;
    assignmentContains?: string | undefined;
}, {
    unitName?: string | undefined;
    assignmentContains?: string | undefined;
}>, {
    unitName?: string | undefined;
    assignmentContains?: string | undefined;
}, {
    unitName?: string | undefined;
    assignmentContains?: string | undefined;
}>;
export declare const timelineEventSchema: z.ZodObject<{
    id: z.ZodString;
    offsetSeconds: z.ZodNumber;
    label: z.ZodOptional<z.ZodString>;
    dispatch: z.ZodEffects<z.ZodObject<{
        stage: z.ZodOptional<z.ZodEnum<["incipient", "growth", "fully_developed", "decay"]>>;
        side: z.ZodOptional<z.ZodEnum<["alpha", "bravo", "charlie", "delta"]>>;
        hazard: z.ZodOptional<z.ZodString>;
        update: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        stage?: "incipient" | "growth" | "fully_developed" | "decay" | undefined;
        side?: "alpha" | "bravo" | "charlie" | "delta" | undefined;
        hazard?: string | undefined;
        update?: string | undefined;
    }, {
        stage?: "incipient" | "growth" | "fully_developed" | "decay" | undefined;
        side?: "alpha" | "bravo" | "charlie" | "delta" | undefined;
        hazard?: string | undefined;
        update?: string | undefined;
    }>, {
        stage?: "incipient" | "growth" | "fully_developed" | "decay" | undefined;
        side?: "alpha" | "bravo" | "charlie" | "delta" | undefined;
        hazard?: string | undefined;
        update?: string | undefined;
    }, {
        stage?: "incipient" | "growth" | "fully_developed" | "decay" | undefined;
        side?: "alpha" | "bravo" | "charlie" | "delta" | undefined;
        hazard?: string | undefined;
        update?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    id: string;
    offsetSeconds: number;
    dispatch: {
        stage?: "incipient" | "growth" | "fully_developed" | "decay" | undefined;
        side?: "alpha" | "bravo" | "charlie" | "delta" | undefined;
        hazard?: string | undefined;
        update?: string | undefined;
    };
    label?: string | undefined;
}, {
    id: string;
    offsetSeconds: number;
    dispatch: {
        stage?: "incipient" | "growth" | "fully_developed" | "decay" | undefined;
        side?: "alpha" | "bravo" | "charlie" | "delta" | undefined;
        hazard?: string | undefined;
        update?: string | undefined;
    };
    label?: string | undefined;
}>;
export declare const expectedActionSchema: z.ZodObject<{
    id: z.ZodString;
    label: z.ZodString;
    match: z.ZodEffects<z.ZodObject<{
        unitName: z.ZodOptional<z.ZodString>;
        assignmentContains: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        unitName?: string | undefined;
        assignmentContains?: string | undefined;
    }, {
        unitName?: string | undefined;
        assignmentContains?: string | undefined;
    }>, {
        unitName?: string | undefined;
        assignmentContains?: string | undefined;
    }, {
        unitName?: string | undefined;
        assignmentContains?: string | undefined;
    }>;
    deadlineSeconds: z.ZodOptional<z.ZodNumber>;
    critical: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    id: string;
    label: string;
    match: {
        unitName?: string | undefined;
        assignmentContains?: string | undefined;
    };
    deadlineSeconds?: number | undefined;
    critical?: boolean | undefined;
}, {
    id: string;
    label: string;
    match: {
        unitName?: string | undefined;
        assignmentContains?: string | undefined;
    };
    deadlineSeconds?: number | undefined;
    critical?: boolean | undefined;
}>;
export declare const assignmentCompletionRuleSchema: z.ZodObject<{
    id: z.ZodString;
    label: z.ZodOptional<z.ZodString>;
    trigger: z.ZodEffects<z.ZodObject<{
        unitName: z.ZodOptional<z.ZodString>;
        assignmentContains: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        unitName?: string | undefined;
        assignmentContains?: string | undefined;
    }, {
        unitName?: string | undefined;
        assignmentContains?: string | undefined;
    }>, {
        unitName?: string | undefined;
        assignmentContains?: string | undefined;
    }, {
        unitName?: string | undefined;
        assignmentContains?: string | undefined;
    }>;
    delaySeconds: z.ZodNumber;
    dispatch: z.ZodEffects<z.ZodObject<{
        stage: z.ZodOptional<z.ZodEnum<["incipient", "growth", "fully_developed", "decay"]>>;
        side: z.ZodOptional<z.ZodEnum<["alpha", "bravo", "charlie", "delta"]>>;
        hazard: z.ZodOptional<z.ZodString>;
        update: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        stage?: "incipient" | "growth" | "fully_developed" | "decay" | undefined;
        side?: "alpha" | "bravo" | "charlie" | "delta" | undefined;
        hazard?: string | undefined;
        update?: string | undefined;
    }, {
        stage?: "incipient" | "growth" | "fully_developed" | "decay" | undefined;
        side?: "alpha" | "bravo" | "charlie" | "delta" | undefined;
        hazard?: string | undefined;
        update?: string | undefined;
    }>, {
        stage?: "incipient" | "growth" | "fully_developed" | "decay" | undefined;
        side?: "alpha" | "bravo" | "charlie" | "delta" | undefined;
        hazard?: string | undefined;
        update?: string | undefined;
    }, {
        stage?: "incipient" | "growth" | "fully_developed" | "decay" | undefined;
        side?: "alpha" | "bravo" | "charlie" | "delta" | undefined;
        hazard?: string | undefined;
        update?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    id: string;
    dispatch: {
        stage?: "incipient" | "growth" | "fully_developed" | "decay" | undefined;
        side?: "alpha" | "bravo" | "charlie" | "delta" | undefined;
        hazard?: string | undefined;
        update?: string | undefined;
    };
    trigger: {
        unitName?: string | undefined;
        assignmentContains?: string | undefined;
    };
    delaySeconds: number;
    label?: string | undefined;
}, {
    id: string;
    dispatch: {
        stage?: "incipient" | "growth" | "fully_developed" | "decay" | undefined;
        side?: "alpha" | "bravo" | "charlie" | "delta" | undefined;
        hazard?: string | undefined;
        update?: string | undefined;
    };
    trigger: {
        unitName?: string | undefined;
        assignmentContains?: string | undefined;
    };
    delaySeconds: number;
    label?: string | undefined;
}>;
export declare const selfPacedConfigSchema: z.ZodObject<{
    timeLimitSeconds: z.ZodOptional<z.ZodNumber>;
    timeline: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        offsetSeconds: z.ZodNumber;
        label: z.ZodOptional<z.ZodString>;
        dispatch: z.ZodEffects<z.ZodObject<{
            stage: z.ZodOptional<z.ZodEnum<["incipient", "growth", "fully_developed", "decay"]>>;
            side: z.ZodOptional<z.ZodEnum<["alpha", "bravo", "charlie", "delta"]>>;
            hazard: z.ZodOptional<z.ZodString>;
            update: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            stage?: "incipient" | "growth" | "fully_developed" | "decay" | undefined;
            side?: "alpha" | "bravo" | "charlie" | "delta" | undefined;
            hazard?: string | undefined;
            update?: string | undefined;
        }, {
            stage?: "incipient" | "growth" | "fully_developed" | "decay" | undefined;
            side?: "alpha" | "bravo" | "charlie" | "delta" | undefined;
            hazard?: string | undefined;
            update?: string | undefined;
        }>, {
            stage?: "incipient" | "growth" | "fully_developed" | "decay" | undefined;
            side?: "alpha" | "bravo" | "charlie" | "delta" | undefined;
            hazard?: string | undefined;
            update?: string | undefined;
        }, {
            stage?: "incipient" | "growth" | "fully_developed" | "decay" | undefined;
            side?: "alpha" | "bravo" | "charlie" | "delta" | undefined;
            hazard?: string | undefined;
            update?: string | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        offsetSeconds: number;
        dispatch: {
            stage?: "incipient" | "growth" | "fully_developed" | "decay" | undefined;
            side?: "alpha" | "bravo" | "charlie" | "delta" | undefined;
            hazard?: string | undefined;
            update?: string | undefined;
        };
        label?: string | undefined;
    }, {
        id: string;
        offsetSeconds: number;
        dispatch: {
            stage?: "incipient" | "growth" | "fully_developed" | "decay" | undefined;
            side?: "alpha" | "bravo" | "charlie" | "delta" | undefined;
            hazard?: string | undefined;
            update?: string | undefined;
        };
        label?: string | undefined;
    }>, "many">>;
    expectedActions: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodString;
        match: z.ZodEffects<z.ZodObject<{
            unitName: z.ZodOptional<z.ZodString>;
            assignmentContains: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            unitName?: string | undefined;
            assignmentContains?: string | undefined;
        }, {
            unitName?: string | undefined;
            assignmentContains?: string | undefined;
        }>, {
            unitName?: string | undefined;
            assignmentContains?: string | undefined;
        }, {
            unitName?: string | undefined;
            assignmentContains?: string | undefined;
        }>;
        deadlineSeconds: z.ZodOptional<z.ZodNumber>;
        critical: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        label: string;
        match: {
            unitName?: string | undefined;
            assignmentContains?: string | undefined;
        };
        deadlineSeconds?: number | undefined;
        critical?: boolean | undefined;
    }, {
        id: string;
        label: string;
        match: {
            unitName?: string | undefined;
            assignmentContains?: string | undefined;
        };
        deadlineSeconds?: number | undefined;
        critical?: boolean | undefined;
    }>, "many">>;
    assignmentCompletions: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodOptional<z.ZodString>;
        trigger: z.ZodEffects<z.ZodObject<{
            unitName: z.ZodOptional<z.ZodString>;
            assignmentContains: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            unitName?: string | undefined;
            assignmentContains?: string | undefined;
        }, {
            unitName?: string | undefined;
            assignmentContains?: string | undefined;
        }>, {
            unitName?: string | undefined;
            assignmentContains?: string | undefined;
        }, {
            unitName?: string | undefined;
            assignmentContains?: string | undefined;
        }>;
        delaySeconds: z.ZodNumber;
        dispatch: z.ZodEffects<z.ZodObject<{
            stage: z.ZodOptional<z.ZodEnum<["incipient", "growth", "fully_developed", "decay"]>>;
            side: z.ZodOptional<z.ZodEnum<["alpha", "bravo", "charlie", "delta"]>>;
            hazard: z.ZodOptional<z.ZodString>;
            update: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            stage?: "incipient" | "growth" | "fully_developed" | "decay" | undefined;
            side?: "alpha" | "bravo" | "charlie" | "delta" | undefined;
            hazard?: string | undefined;
            update?: string | undefined;
        }, {
            stage?: "incipient" | "growth" | "fully_developed" | "decay" | undefined;
            side?: "alpha" | "bravo" | "charlie" | "delta" | undefined;
            hazard?: string | undefined;
            update?: string | undefined;
        }>, {
            stage?: "incipient" | "growth" | "fully_developed" | "decay" | undefined;
            side?: "alpha" | "bravo" | "charlie" | "delta" | undefined;
            hazard?: string | undefined;
            update?: string | undefined;
        }, {
            stage?: "incipient" | "growth" | "fully_developed" | "decay" | undefined;
            side?: "alpha" | "bravo" | "charlie" | "delta" | undefined;
            hazard?: string | undefined;
            update?: string | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        dispatch: {
            stage?: "incipient" | "growth" | "fully_developed" | "decay" | undefined;
            side?: "alpha" | "bravo" | "charlie" | "delta" | undefined;
            hazard?: string | undefined;
            update?: string | undefined;
        };
        trigger: {
            unitName?: string | undefined;
            assignmentContains?: string | undefined;
        };
        delaySeconds: number;
        label?: string | undefined;
    }, {
        id: string;
        dispatch: {
            stage?: "incipient" | "growth" | "fully_developed" | "decay" | undefined;
            side?: "alpha" | "bravo" | "charlie" | "delta" | undefined;
            hazard?: string | undefined;
            update?: string | undefined;
        };
        trigger: {
            unitName?: string | undefined;
            assignmentContains?: string | undefined;
        };
        delaySeconds: number;
        label?: string | undefined;
    }>, "many">>;
    endConditions: z.ZodDefault<z.ZodObject<{
        onUnderControl: z.ZodOptional<z.ZodBoolean>;
        onTimelineComplete: z.ZodOptional<z.ZodBoolean>;
        onTimeExpired: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        onUnderControl?: boolean | undefined;
        onTimelineComplete?: boolean | undefined;
        onTimeExpired?: boolean | undefined;
    }, {
        onUnderControl?: boolean | undefined;
        onTimelineComplete?: boolean | undefined;
        onTimeExpired?: boolean | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    timeline: {
        id: string;
        offsetSeconds: number;
        dispatch: {
            stage?: "incipient" | "growth" | "fully_developed" | "decay" | undefined;
            side?: "alpha" | "bravo" | "charlie" | "delta" | undefined;
            hazard?: string | undefined;
            update?: string | undefined;
        };
        label?: string | undefined;
    }[];
    expectedActions: {
        id: string;
        label: string;
        match: {
            unitName?: string | undefined;
            assignmentContains?: string | undefined;
        };
        deadlineSeconds?: number | undefined;
        critical?: boolean | undefined;
    }[];
    assignmentCompletions: {
        id: string;
        dispatch: {
            stage?: "incipient" | "growth" | "fully_developed" | "decay" | undefined;
            side?: "alpha" | "bravo" | "charlie" | "delta" | undefined;
            hazard?: string | undefined;
            update?: string | undefined;
        };
        trigger: {
            unitName?: string | undefined;
            assignmentContains?: string | undefined;
        };
        delaySeconds: number;
        label?: string | undefined;
    }[];
    endConditions: {
        onUnderControl?: boolean | undefined;
        onTimelineComplete?: boolean | undefined;
        onTimeExpired?: boolean | undefined;
    };
    timeLimitSeconds?: number | undefined;
}, {
    timeLimitSeconds?: number | undefined;
    timeline?: {
        id: string;
        offsetSeconds: number;
        dispatch: {
            stage?: "incipient" | "growth" | "fully_developed" | "decay" | undefined;
            side?: "alpha" | "bravo" | "charlie" | "delta" | undefined;
            hazard?: string | undefined;
            update?: string | undefined;
        };
        label?: string | undefined;
    }[] | undefined;
    expectedActions?: {
        id: string;
        label: string;
        match: {
            unitName?: string | undefined;
            assignmentContains?: string | undefined;
        };
        deadlineSeconds?: number | undefined;
        critical?: boolean | undefined;
    }[] | undefined;
    assignmentCompletions?: {
        id: string;
        dispatch: {
            stage?: "incipient" | "growth" | "fully_developed" | "decay" | undefined;
            side?: "alpha" | "bravo" | "charlie" | "delta" | undefined;
            hazard?: string | undefined;
            update?: string | undefined;
        };
        trigger: {
            unitName?: string | undefined;
            assignmentContains?: string | undefined;
        };
        delaySeconds: number;
        label?: string | undefined;
    }[] | undefined;
    endConditions?: {
        onUnderControl?: boolean | undefined;
        onTimelineComplete?: boolean | undefined;
        onTimeExpired?: boolean | undefined;
    } | undefined;
}>;
/** Parse arbitrary JSON; returns null if invalid (treats invalid as "no script"). */
export declare function parseSelfPacedConfig(raw: unknown): SelfPacedConfig | null;
export interface SimulationTimingFields {
    hasStarted: boolean;
    startedAt: Date;
    pausedAt: Date | null;
    accumulatedPauseMs: number;
}
/**
 * Wall-clock simulation time minus accumulated paused windows minus the
 * currently-open pause window. Authoritative timeline / deadline clock.
 */
export declare function simulationElapsedMs(session: SimulationTimingFields, now?: Date): number;
/**
 * Detects a student "under control" declaration in a radio transcript.
 *
 * Matches natural variants like "fire under control", "incident under
 * control", "command, under control", etc. Rejects obvious negations
 * ("not under control", "fire is not under control") so a situation report
 * doesn't prematurely end the session.
 */
export declare function isUnderControlDeclaration(text: string | null | undefined): boolean;
/**
 * Case-insensitive match used by both the expected-action matcher and the
 * assignment-completion scheduler.
 */
export declare function matchesAssignment(rule: AssignmentMatch, candidate: {
    unitName?: string | null;
    assignment?: string | null;
}): boolean;
//# sourceMappingURL=self-paced.d.ts.map