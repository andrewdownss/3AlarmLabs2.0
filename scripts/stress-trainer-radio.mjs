#!/usr/bin/env node
/**
 * Stress-test POST /api/trainer/radio (UploadThing + Whisper + GPT + DB).
 *
 * Usage:
 *   node scripts/stress-trainer-radio.mjs \
 *     --url http://localhost/api/trainer/radio \
 *     --cookie "better-auth.session_token=YOUR_TOKEN" \
 *     --session <trainer-session-uuid> \
 *     --audio ./sample.webm \
 *     --burst 15
 *
 * Or with env (keeps secrets out of shell history):
 *   RADIO_STRESS_COOKIE="better-auth.session_token=..." \
 *   RADIO_STRESS_SESSION_ID=<uuid> \
 *   RADIO_STRESS_AUDIO=./clip.webm \
 *   node scripts/stress-trainer-radio.mjs --burst 20
 *
 * Modes:
 *   --burst N       N parallel uploads (default 10)
 *   --sustain R,T   R uploads spread over T seconds (sequential, evenly spaced)
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function parseArgs(argv) {
	const out = {
		url: process.env.RADIO_STRESS_URL || 'http://localhost/api/trainer/radio',
		cookie: process.env.RADIO_STRESS_COOKIE || '',
		session: process.env.RADIO_STRESS_SESSION_ID || '',
		audio: process.env.RADIO_STRESS_AUDIO || '',
		burst: 10,
		sustainRate: 0,
		sustainSeconds: 60,
		help: false
	};

	for (let i = 2; i < argv.length; i++) {
		const a = argv[i];
		const next = argv[i + 1];
		if (a === '--url' && next) {
			out.url = next;
			i++;
		} else if (a === '--cookie' && next) {
			out.cookie = next;
			i++;
		} else if (a === '--session' && next) {
			out.session = next;
			i++;
		} else if (a === '--audio' && next) {
			out.audio = next;
			i++;
		} else if (a === '--burst' && next) {
			out.burst = Math.max(1, parseInt(next, 10) || 10);
			out.sustainRate = 0;
			i++;
		} else if (a === '--sustain' && next) {
			const parts = next.split(',');
			out.sustainRate = Math.max(1, parseInt(parts[0], 10) || 1);
			out.sustainSeconds = Math.max(1, parseInt(parts[1], 10) || 60);
			out.burst = 0;
			i++;
		} else if (a === '--help' || a === '-h') {
			out.help = true;
		}
	}
	return out;
}

function sleep(ms) {
	return new Promise((r) => setTimeout(r, ms));
}

function percentile(sorted, p) {
	if (sorted.length === 0) return 0;
	const idx = Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1);
	return sorted[idx];
}

async function oneUpload({ url, cookie, sessionId, buffer, fileName, mimeType }) {
	const form = new FormData();
	form.set('sessionId', sessionId);
	form.set('audio', new Blob([buffer], { type: mimeType }), fileName);

	const started = performance.now();
	try {
		const res = await fetch(url, {
			method: 'POST',
			headers: cookie ? { Cookie: cookie } : {},
			body: form
		});
		const ms = performance.now() - started;
		let bodyPreview = '';
		try {
			const text = await res.text();
			bodyPreview = text.slice(0, 200);
		} catch {
			bodyPreview = '(could not read body)';
		}
		return { ok: res.ok, status: res.status, ms, bodyPreview };
	} catch (err) {
		const ms = performance.now() - started;
		return {
			ok: false,
			status: 0,
			ms,
			bodyPreview: err instanceof Error ? err.message : String(err)
		};
	}
}

function printHelp() {
	console.log(`
stress-trainer-radio.mjs — load test for /api/trainer/radio

Required:
  --session <uuid>   Trainer session id (from app URL after opening a session)
  --audio <path>     Short .webm (or .mp3) file, same format as real uploads

  --cookie "better-auth.session_token=..."   After login (DevTools → Application → Cookies)
    Or: RADIO_STRESS_COOKIE

Optional:
  --url <endpoint>   Default: http://localhost/api/trainer/radio (via nginx)
                     Direct API: http://127.0.0.1:4000/api/trainer/radio

Modes (one of):
  --burst <N>        N parallel uploads at once (default 10)
  --sustain R,T      R uploads over T seconds, evenly spaced (e.g. 30,60)

Env vars:
  RADIO_STRESS_URL, RADIO_STRESS_COOKIE, RADIO_STRESS_SESSION_ID, RADIO_STRESS_AUDIO
`);
}

async function main() {
	const opts = parseArgs(process.argv);
	if (opts.help) {
		printHelp();
		process.exit(0);
	}

	if (!opts.session || !opts.audio) {
		console.error('Missing --session and/or --audio. Use --help.');
		process.exit(1);
	}
	if (!opts.cookie) {
		console.error('Missing --cookie or RADIO_STRESS_COOKIE. Use --help.');
		process.exit(1);
	}

	const audioPath = resolve(opts.audio);
	if (!existsSync(audioPath)) {
		console.error('Audio file not found:', audioPath);
		process.exit(1);
	}

	const buffer = readFileSync(audioPath);
	const fileName = audioPath.split(/[/\\]/).pop() || 'radio.webm';
	const mimeType = fileName.endsWith('.webm')
		? 'audio/webm'
		: fileName.endsWith('.mp3')
			? 'audio/mpeg'
			: 'application/octet-stream';

	const payload = {
		url: opts.url,
		cookie: opts.cookie,
		sessionId: opts.session,
		buffer,
		fileName,
		mimeType
	};

	console.log('Target:', opts.url);
	console.log('Audio:', audioPath, `(${buffer.length} bytes)`);
	console.log('Session:', opts.session);

	let results;

	if (opts.sustainRate > 0) {
		const { sustainRate, sustainSeconds } = opts;
		const intervalMs = (sustainSeconds * 1000) / sustainRate;
		console.log(`Mode: sustain ${sustainRate} requests over ${sustainSeconds}s (~${intervalMs.toFixed(0)}ms apart)\n`);
		results = [];
		for (let i = 0; i < sustainRate; i++) {
			const r = await oneUpload(payload);
			results.push(r);
			process.stdout.write(`  [${i + 1}/${sustainRate}] ${r.status} ${r.ms.toFixed(0)}ms\n`);
			if (i < sustainRate - 1) await sleep(intervalMs);
		}
	} else {
		const n = opts.burst;
		console.log(`Mode: burst ${n} parallel requests\n`);
		results = await Promise.all(
			Array.from({ length: n }, (_, i) =>
				oneUpload(payload).then((r) => {
					process.stdout.write(`  [${i + 1}/${n}] ${r.status} ${r.ms.toFixed(0)}ms\n`);
					return r;
				})
			)
		);
	}

	const ok = results.filter((r) => r.ok).length;
	const latencies = results.map((r) => r.ms).sort((a, b) => a - b);
	const byStatus = {};
	for (const r of results) {
		const k = String(r.status);
		byStatus[k] = (byStatus[k] || 0) + 1;
	}

	console.log('\n--- Summary ---');
	console.log('Completed:', results.length);
	console.log('2xx OK:', ok);
	console.log('Failed:', results.length - ok);
	console.log('Status codes:', byStatus);
	if (latencies.length) {
		console.log(
			`Latency ms — min: ${latencies[0].toFixed(0)}  p50: ${percentile(latencies, 0.5).toFixed(0)}  p95: ${percentile(latencies, 0.95).toFixed(0)}  max: ${latencies[latencies.length - 1].toFixed(0)}`
		);
	}

	const failures = results.filter((r) => !r.ok);
	if (failures.length) {
		console.log('\n--- Sample errors (first 5) ---');
		for (const f of failures.slice(0, 5)) {
			console.log(`  status ${f.status}: ${f.bodyPreview}`);
		}
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
