import { generateText, type LanguageModel } from "ai";

/**
 * Voice input v1: MediaRecorder capture → audio file part → Gemini free tier
 * transcribes it. WebView2 has no Web Speech API, and a whisper.cpp sidecar
 * would block the mobile port — this is the $0 path that works today.
 */
export async function transcribeAudio(opts: {
    model: LanguageModel;
    audio: Blob;
}): Promise<string> {
    const data = new Uint8Array(await opts.audio.arrayBuffer());
    const result = await generateText({
        model: opts.model,
        messages: [
            {
                role: "user",
                content: [
                    {
                        type: "file",
                        mediaType: opts.audio.type || "audio/webm",
                        data,
                    },
                    {
                        type: "text",
                        text: "Transcribe this audio exactly as spoken. Output only the transcription, nothing else.",
                    },
                ],
            },
        ],
    });
    return result.text.trim();
}

/** Thin MediaRecorder wrapper; failures surface as thrown errors (mic denied, etc.). */
export class MicRecorder {
    private recorder: MediaRecorder | null = null;
    private chunks: Blob[] = [];

    get recording(): boolean {
        return this.recorder?.state === "recording";
    }

    async start(): Promise<void> {
        if (this.recorder) throw new Error("already recording");
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
        });
        this.chunks = [];
        this.recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
        this.recorder.ondataavailable = (e) => {
            if (e.data.size > 0) this.chunks.push(e.data);
        };
        this.recorder.start();
    }

    stop(): Promise<Blob> {
        const recorder = this.recorder;
        if (!recorder) throw new Error("not recording");
        return new Promise((resolve) => {
            recorder.onstop = () => {
                recorder.stream.getTracks().forEach((t) => t.stop());
                this.recorder = null;
                resolve(new Blob(this.chunks, { type: "audio/webm" }));
            };
            recorder.stop();
        });
    }
}
