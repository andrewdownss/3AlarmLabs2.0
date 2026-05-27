import { Router } from 'express';
import multer from 'multer';
import { transcribeAudio } from '../services/transcription.js';
import { parseCommand } from '../services/command-parser.js';
import {
	extractAssignmentActions,
	extractSupervisorAssignmentActions,
	normalizeBoardColumn,
	normalizeBoardColumns,
	resolveSizeUpSummary,
	shouldPlaceAssignment
} from '../lib/trainer-board-columns.js';
import { applySupervisorAssignment, applyTaskAssignment } from '../services/board-engine.js';
import {
	DEMO_MAX_RADIO_UPLOAD_BYTES,
	DEMO_RADIO_RATE_LIMIT_PER_MINUTE
} from '../lib/demo-limits.js';
import { isDemoRadioRateLimited } from '../lib/demo-rate-limit.js';

const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: DEMO_MAX_RADIO_UPLOAD_BYTES }
});

function clientIp(req: { ip?: string; headers: Record<string, string | string[] | undefined> }): string {
	const forwarded = req.headers['x-forwarded-for'];
	if (typeof forwarded === 'string' && forwarded.length > 0) {
		return forwarded.split(',')[0]?.trim() ?? 'unknown';
	}
	return req.ip ?? 'unknown';
}

export function createDemoRadioRouter() {
	const router = Router();

	router.post('/', upload.single('audio'), async (req, res) => {
		const ip = clientIp(req);
		if (isDemoRadioRateLimited(ip, DEMO_RADIO_RATE_LIMIT_PER_MINUTE)) {
			res.status(429).json({ error: 'Too many demo radio requests. Please wait a moment.' });
			return;
		}

		if (!req.file) {
			res.status(400).json({ error: 'Missing audio clip.' });
			return;
		}

		if (req.file.size > DEMO_MAX_RADIO_UPLOAD_BYTES) {
			res.status(413).json({
				error: `Demo radio clip exceeds ${Math.floor(DEMO_MAX_RADIO_UPLOAD_BYTES / 1024 / 1024)}MB limit.`
			});
			return;
		}

		const audioBuffer = req.file.buffer;
		const audioMime = req.file.mimetype;

		let transcript = '';
		try {
			transcript = await transcribeAudio(audioBuffer, audioMime);
		} catch (err) {
			console.error('[demo-radio] Transcription failed:', err);
			res.status(502).json({ error: 'Could not transcribe demo radio clip.' });
			return;
		}

		let parsedCommand: Record<string, unknown> = {};
		if (transcript) {
			try {
				parsedCommand = await parseCommand(transcript);
			} catch (err) {
				console.error('[demo-radio] Command parsing failed:', err);
			}
		}

		let boardColumns = normalizeBoardColumns([]);
		let boardEntries: Array<{
			id: string;
			slotIndex?: number | null;
			division: string;
			unitName: string;
			assignment: string | null;
			location?: string | null;
			status: string;
		}> = [];
		const actions = extractAssignmentActions(parsedCommand).map((action) => {
			const boardColumn = normalizeBoardColumn(action);
			if (!shouldPlaceAssignment(action, boardColumn)) return null;
			const result = applyTaskAssignment(boardColumns, boardEntries, {
				unitName: String(action.unitName),
				assignment: String(action.assignment ?? ''),
				boardColumn,
				location: String(action.location ?? ''),
				status: String(action.status ?? 'Assigned').trim() || 'Assigned'
			});
			boardColumns = result.columns;
			boardEntries = result.entries;
			return result.entries.at(-1) ?? null;
		}).filter((action): action is NonNullable<typeof action> => action !== null);
		for (const supervisor of extractSupervisorAssignmentActions(parsedCommand)) {
			const result = applySupervisorAssignment(boardColumns, boardEntries, supervisor);
			boardColumns = result.columns;
			boardEntries = result.entries;
		}

		const sizeUpText = resolveSizeUpSummary(parsedCommand, transcript);

		res.json({
			transcript,
			parsedCommand,
			actions,
			boardColumns,
			boardEntries,
			sizeUpText: sizeUpText ?? null
		});
	});

	return router;
}
