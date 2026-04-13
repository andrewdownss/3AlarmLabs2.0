export interface SessionRow {
    id: string;
    scenarioId: string;
    mode: 'instructor_led' | 'self_practice';
    joinCode: string | null;
    organizationId: string | null;
    instructorId: string | null;
    studentId: string | null;
    activeStage: string;
    activeSide: string;
    hasStarted: boolean;
    startedAt: Date;
    endedAt: Date | null;
}
/**
 * Load a session and verify the given user is a participant (instructor or student).
 * Returns the session row if authorised, or null if not found / not allowed.
 */
export declare function getSessionForUser(sessionId: string, userId: string): Promise<SessionRow | null>;
//# sourceMappingURL=authz.d.ts.map