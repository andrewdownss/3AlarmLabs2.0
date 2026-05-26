import { Router } from 'express';
import multer from 'multer';
import { transcribeAudio } from '../services/transcription.js';
import { parseCommand } from '../services/command-parser.js';
import {
	extractAssignmentActions,
	normalizeBoardColumn,
	resolveSizeUpSummary,
	shouldPlaceAssignment
} from '../lib/trainer-board-columns.js';
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

		const actions = extractAssignmentActions(parsedCommand).map((action) => {
			const boardColumn = normalizeBoardColumn(action);
			if (!shouldPlaceAssignment(action, boardColumn)) return null;
			return {
				unitName: String(action.unitName),
				division: boardColumn!,
				assignment: String(action.assignment ?? ''),
				location: String(action.location ?? ''),
				status: String(action.status ?? 'Assigned').trim() || 'Assigned'
			};
		}).filter((action): action is NonNullable<typeof action> => action !== null);

		const sizeUpText = resolveSizeUpSummary(parsedCommand, transcript);

		res.json({
			transcript,
			parsedCommand,
			actions,
			sizeUpText: sizeUpText ?? null
		});
	});

	return router;
}
