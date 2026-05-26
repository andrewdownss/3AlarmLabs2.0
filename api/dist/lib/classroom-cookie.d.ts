export declare const CLASSROOM_COOKIE_NAME = "classroom_session";
export interface ClassroomCookiePayload {
    classroomId: string;
    participantId: string;
    displayName: string;
    exp: number;
}
export declare function createClassroomCookieValue(payload: Omit<ClassroomCookiePayload, 'exp'>, now?: number): string | null;
export declare function classroomCookieMaxAge(): number;
export declare function verifyClassroomCookieValue(value: string | undefined | null): ClassroomCookiePayload | null;
//# sourceMappingURL=classroom-cookie.d.ts.map