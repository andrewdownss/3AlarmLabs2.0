import { Router } from 'express';
import multer from 'multer';
import { db } from '../db/index.js';
import { trainerRadioMessages, trainerCommandBoardEntries, trainerSessionEvents } from '../db/schema/trainer.js';
import { eq, and } from 'drizzle-orm';
import { transcribeAudio } from '../services/transcription.js';
import { parseCommand } from '../services/command-parser.js';
import { normalizeBoardColumn, extractAssignmentActions, shouldPlaceAssignment, resolveSizeUpSummary } from '../lib/trainer-board-columns.js';
import { getSessionForUser } from '../middleware/authz.js';
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
export function createRadioRouter(io) {
    const router = Router();
    router.post('/', upload.single('audio'), async (req, res) => {
        const sessionId = req.body.sessionId;
        if (!sessionId || !req.file) {
            res.status(400).json({ error: 'Missing sessionId or audio' });
            return;
        }
        const session = await getSessionForUser(sessionId, req.userId);
        if (!session) {
            res.status(404).json({ error: 'Session not found' });
            return;
        }
        let audioUrl = '';
        try {
            const { UTApi } = await import('uploadthing/server');
            const utapi = new UTApi({ token: process.env.UPLOADTHING_TOKEN });
            const file = new File([new Uint8Array(req.file.buffer)], req.file.originalname || 'radio.webm', { type: req.file.mimetype });
            const result = await utapi.uploadFiles(file);
            audioUrl = result.data?.ufsUrl || '';
        }
        catch (err) {
            console.error('[radio] Upload failed:', err);
        }
        let transcript = '';
        try {
            transcript = await transcribeAudio(req.file.buffer, req.file.mimetype);
        }
        catch (err) {
            console.error('[radio] Transcription failed:', err);
        }
        let parsedCommand = {};
        if (transcript) {
            try {
                parsedCommand = await parseCommand(transcript);
            }
            catch (err) {
                console.error('[radio] Command parsing failed:', err);
            }
        }
        const messageId = crypto.randomUUID();
        await db.insert(trainerRadioMessages).values({
            id: messageId, sessionId, audioUrl, transcript,
            parsedCommandJson: parsedCommand, speakerRole: 'student'
        });
        await db.insert(trainerSessionEvents).values({
            id: crypto.randomUUID(), sessionId,
            eventType: 'radio_recorded',
            payloadJson: { messageId, transcript }
        });
        const sizeUpText = resolveSizeUpSummary(parsedCommand, transcript);
        if (sizeUpText) {
            await db.insert(trainerSessionEvents).values({
                id: crypto.randomUUID(),
                sessionId,
                eventType: 'size_up',
                payloadJson: { messageId, transcript, summary: sizeUpText }
            });
            io.to(`session:${sessionId}`).emit('trainer:sizeup:recorded', {
                summary: sizeUpText,
                transcript
            });
        }
        const actions = extractAssignmentActions(parsedCommand);
        for (const action of actions) {
            const boardColumn = normalizeBoardColumn(action);
            if (!shouldPlaceAssignment(action, boardColumn))
                continue;
            const division = boardColumn;
            const unitName = String(action.unitName);
            const assignment = String(action.assignment ?? '');
            const location = String(action.location ?? '');
            const status = String(action.status ?? 'Assigned').trim() || 'Assigned';
            const existing = await db
                .select()
                .from(trainerCommandBoardEntries)
                .where(and(eq(trainerCommandBoardEntries.sessionId, sessionId), eq(trainerCommandBoardEntries.unitName, unitName)))
                .limit(1);
            let entryId;
            if (existing.length > 0) {
                entryId = existing[0].id;
                await db
                    .update(trainerCommandBoardEntries)
                    .set({
                    division,
                    assignment,
                    location,
                    status,
                    lastUpdatedAt: new Date()
                })
                    .where(eq(trainerCommandBoardEntries.id, entryId));
            }
            else {
                entryId = crypto.randomUUID();
                await db.insert(trainerCommandBoardEntries).values({
                    id: entryId,
                    sessionId,
                    division,
                    unitName,
                    assignment,
                    location,
                    status
                });
            }
            const entry = {
                id: entryId,
                sessionId,
                division,
                unitName,
                assignment,
                location,
                status
            };
            io.to(`session:${sessionId}`).emit('trainer:board:updated', { entry });
        }
        io.to(`session:${sessionId}`).emit('trainer:radio:transcribed', { transcript, parsedCommand });
        res.json({ transcript, command: parsedCommand, audioUrl });
    });
    return router;
}
//# sourceMappingURL=radio.js.map