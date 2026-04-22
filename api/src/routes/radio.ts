import { Router } from 'express';
import multer from 'multer';
import { db } from '../db/index.js';
import {
	trainerRadioMessages,
	trainerCommandBoardEntries,
	trainerSessionEvents,
	trainerScenarios
} from '../db/schema/trainer.js';
import { eq, and } from 'drizzle-orm';
import { transcribeAudio } from '../services/transcription.js';
import { parseCommand } from '../services/command-parser.js';
import {
	normalizeBoardColumn,
	extractAssignmentActions,
	shouldPlaceAssignment,
	resolveSizeUpSummary
} from '../lib/trainer-board-columns.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { getSessionForUser } from '../middleware/authz.js';
import { endSession, evaluateAfterBoardChange } from '../lib/self-paced-runtime.js';
import { isUnderControlDeclaration, parseSelfPacedConfig } from '../lib/self-paced.js';
import type { Server } from 'socket.io';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export function createRadioRouter(io: Server) {
	const router = Router();

	router.post('/', upload.single('audio'), async (req: AuthenticatedRequest, res) => {
		const sessionId = req.body.sessionId;
		if (!sessionId || !req.file) { res.status(400).json({ error: 'Missing sessionId or audio' }); return; }

		const session = await getSessionForUser(sessionId, req.userId!);
		if (!session) { res.status(404).json({ error: 'Session not found' }); return; }

		const audioBuffer = req.file.buffer;
		const audioMime = req.file.mimetype;
		const audioName = req.file.originalname || 'radio.webm';

		// Upload runs in parallel with transcription (independent work) and is
		// deliberately not awaited before responding. The `audioUrl` is only
		// used for replay/review, so we patch the DB row once the upload
		// resolves without blocking the radio feedback loop.
		const uploadPromise: Promise<string> = (async () => {
			try {
				const { UTApi } = await import('uploadthing/server');
				const utapi = new UTApi({ token: process.env.UPLOADTHING_TOKEN });
				const file = new File([new Uint8Array(audioBuffer)], audioName, { type: audioMime });
				const result = await utapi.uploadFiles(file);
				return result.data?.ufsUrl || '';
			} catch (err) {
				console.error('[radio] Upload failed:', err);
				return '';
			}
		})();

		let transcript = '';
		try { transcript = await transcribeAudio(audioBuffer, audioMime); }
		catch (err) { console.error('[radio] Transcription failed:', err); }

		let parsedCommand: Record<string, unknown> = {};
		if (transcript) {
			try { parsedCommand = await parseCommand(transcript); }
			catch (err) { console.error('[radio] Command parsing failed:', err); }
		}

		const messageId = crypto.randomUUID();
		await db.insert(trainerRadioMessages).values({
			id: messageId, sessionId, audioUrl: '', transcript,
			parsedCommandJson: parsedCommand, speakerRole: 'student'
		});

		void uploadPromise.then(async (url) => {
			if (!url) return;
			try {
				await db
					.update(trainerRadioMessages)
					.set({ audioUrl: url })
					.where(eq(trainerRadioMessages.id, messageId));
			} catch (err) {
				console.error('[radio] Failed to patch audioUrl:', err);
			}
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
			if (!shouldPlaceAssignment(action, boardColumn)) continue;

			const division = boardColumn!;
			const unitName = String(action.unitName);
			const assignment = String(action.assignment ?? '');
			const location = String(action.location ?? '');
			const status = String(action.status ?? 'Assigned').trim() || 'Assigned';

			const existing = await db
				.select()
				.from(trainerCommandBoardEntries)
				.where(
					and(
						eq(trainerCommandBoardEntries.sessionId, sessionId),
						eq(trainerCommandBoardEntries.unitName, unitName)
					)
				)
				.limit(1);

			let entryId: string;
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
			} else {
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

		if (actions.length > 0) {
			await evaluateAfterBoardChange(io, sessionId);
		}

		if (transcript && isUnderControlDeclaration(transcript)) {
			const [scenarioRow] = await db
				.select({ config: trainerScenarios.selfPacedConfigJson })
				.from(trainerScenarios)
				.where(eq(trainerScenarios.id, session.scenarioId))
				.limit(1);
			const config = parseSelfPacedConfig(scenarioRow?.config ?? null);
			if (config?.endConditions.onUnderControl) {
				await endSession(io, sessionId, {
					outcome: 'completed',
					reason: 'under_control',
					payload: { messageId, transcript }
				});
			}
		}

		res.json({ messageId, transcript, command: parsedCommand });
	});

	return router;
}
