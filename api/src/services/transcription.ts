import OpenAI from 'openai';

export async function transcribeAudio(buffer: Buffer, mimeType: string): Promise<string> {
	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) { console.warn('[transcription] OPENAI_API_KEY not set'); return ''; }

	const openai = new OpenAI({ apiKey });
	const file = new File([new Uint8Array(buffer)], 'audio.webm', { type: mimeType });

	const response = await openai.audio.transcriptions.create({
		model: 'gpt-4o-mini-transcribe',
		file,
		language: 'en'
	});

	return response.text;
}
