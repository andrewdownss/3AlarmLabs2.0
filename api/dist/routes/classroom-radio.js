import { Router } from 'express';
import multer from 'multer';
import cookie from 'cookie';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { classroomParticipants, classrooms, trainerRadioMessages, trainerScenarios, trainerSessionEvents, trainerSessions } from '../db/schema/trainer.js';
import { CLASSROOM_COOKIE_NAME, verifyClassroomCookieValue } from '../lib/classroom-cookie.js';
import { transcribeAudio } from '../services/transcription.js';
import { parseCommand } from '../services/command-parser.js';
import { extractAssignmentActions, resolveSizeUpSummary } from '../lib/trainer-board-columns.js';
import { endSession, evaluateAfterBoardChange } from '../lib/self-paced-runtime.js';
import { isUnderControlDeclaration, parseSelfPacedConfig } from '../lib/self-paced.js';
import { applyParsedCommandToBoard } from '../lib/board-persistence.js';
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
export function createClassroomRadioRouter(io) {
    const router = Router();
    router.post('/', upload.single('audio'), async (req, res) => {
        const sessionId = String(req.body?.sessionId ?? '');
        if (!sessionId || !req.file) {
            res.status(400).json({ error: 'Missing sessionId or audio' });
            return;
        }
        const parsedCookies = cookie.parse(req.headers.cookie ?? '');
        const payload = verifyClassroomCookieValue(parsedCookies[CLASSROOM_COOKIE_NAME]);
        if (!payload) {
            res.status(401).json({ error: 'Not authenticated for classroom.' });
            return;
        }
        const [access] = await db
            .select({
            session: trainerSessions,
            classroom: classrooms,
            participant: classroomParticipants
        })
            .from(trainerSessions)
            .innerJoin(classrooms, eq(trainerSessions.classroomId, classrooms.id))
            .innerJoin(classroomParticipants, eq(classroomParticipants.classroomId, classrooms.id))
            .where(and(eq(trainerSessions.id, sessionId), eq(classrooms.id, payload.classroomId), eq(classroomParticipants.id, payload.participantId)))
            .limit(1);
        if (!access ||
            access.session.endedAt ||
            access.classroom.endedAt ||
            access.participant.kickedAt ||
            access.classroom.calledOnParticipantId !== payload.participantId) {
            res.status(403).json({ error: 'You are not currently called on.' });
            return;
        }
        const audioBuffer = req.file.buffer;
        const audioMime = req.file.mimetype;
        const audioName = req.file.originalname || 'radio.webm';
        const uploadPromise = (async () => {
            try {
                const { UTApi } = await import('uploadthing/server');
                const utapi = new UTApi({ token: process.env.UPLOADTHING_TOKEN });
                const file = new File([new Uint8Array(audioBuffer)], audioName, { type: audioMime });
                const result = await utapi.uploadFiles(file);
                return result.data?.ufsUrl || '';
            }
            catch (err) {
                console.error('[classroom-radio] Upload failed:', err);
                return '';
            }
        })();
        let transcript = '';
        try {
            transcript = await transcribeAudio(audioBuffer, audioMime);
        }
        catch (err) {
            console.error('[classroom-radio] Transcription failed:', err);
        }
        let parsedCommand = {};
        if (transcript) {
            try {
                parsedCommand = await parseCommand(transcript);
            }
            catch (err) {
                console.error('[classroom-radio] Command parsing failed:', err);
            }
        }
        const messageId = crypto.randomUUID();
        await db.insert(trainerRadioMessages).values({
            id: messageId,
            sessionId,
            audioUrl: '',
            transcript,
            parsedCommandJson: parsedCommand,
            speakerRole: 'student'
        });
        void uploadPromise.then(async (url) => {
            if (!url)
                return;
            try {
                await db.update(trainerRadioMessages).set({ audioUrl: url }).where(eq(trainerRadioMessages.id, messageId));
            }
            catch (err) {
                console.error('[classroom-radio] Failed to patch audioUrl:', err);
            }
        });
        await db.insert(trainerSessionEvents).values({
            id: crypto.randomUUID(),
            sessionId,
            eventType: 'radio_recorded',
            payloadJson: { messageId, transcript, participantId: payload.participantId }
        });
        const sizeUpText = resolveSizeUpSummary(parsedCommand, transcript);
        if (sizeUpText) {
            await db.insert(trainerSessionEvents).values({
                id: crypto.randomUUID(),
                sessionId,
                eventType: 'size_up',
                payloadJson: { messageId, transcript, summary: sizeUpText, participantId: payload.participantId }
            });
            io.to(`session:${sessionId}`).emit('trainer:sizeup:recorded', { summary: sizeUpText, transcript });
        }
        const actions = extractAssignmentActions(parsedCommand);
        const boardChanged = await applyParsedCommandToBoard(io, sessionId, parsedCommand);
        io.to(`session:${sessionId}`).emit('trainer:radio:transcribed', { transcript, parsedCommand });
        if (boardChanged || actions.length > 0)
            await evaluateAfterBoardChange(io, sessionId);
        if (transcript && isUnderControlDeclaration(transcript)) {
            const [scenarioRow] = await db
                .select({ config: trainerScenarios.selfPacedConfigJson })
                .from(trainerScenarios)
                .where(eq(trainerScenarios.id, access.session.scenarioId))
                .limit(1);
            const config = parseSelfPacedConfig(scenarioRow?.config ?? null);
            if (config?.endConditions.onUnderControl) {
                await endSession(io, sessionId, {
                    outcome: 'completed',
                    reason: 'under_control',
                    payload: { messageId, transcript, participantId: payload.participantId }
                });
            }
        }
        res.json({ messageId, transcript, command: parsedCommand });
    });
    return router;
}
//# sourceMappingURL=classroom-radio.js.map