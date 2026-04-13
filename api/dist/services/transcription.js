import OpenAI from 'openai';
export async function transcribeAudio(buffer, mimeType) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        console.warn('[transcription] OPENAI_API_KEY not set');
        return '';
    }
    const openai = new OpenAI({ apiKey });
    const file = new File([new Uint8Array(buffer)], 'audio.webm', { type: mimeType });
    const response = await openai.audio.transcriptions.create({
        model: 'whisper-1',
        file,
        language: 'en'
    });
    return response.text;
}
//# sourceMappingURL=transcription.js.map