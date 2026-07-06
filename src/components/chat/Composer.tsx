import { useRef, useState } from "react";
import { Mic, Paperclip, SendHorizonal, Square, X } from "lucide-react";
import type { FileUIPart } from "ai";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { fileToImagePart } from "@/ai/multimodal/image";
import { MicRecorder } from "@/ai/multimodal/stt";

export function Composer({
    disabled,
    busy,
    onSend,
    onStop,
    visionEnabled,
    ingestPdf,
    transcriber,
}: {
    disabled?: boolean;
    busy: boolean;
    onSend: (text: string, files: FileUIPart[]) => void;
    onStop: () => void;
    /** Whether the active model accepts image parts. */
    visionEnabled?: boolean;
    /** PDF → documents ingestion; enables .pdf in the attach picker. */
    ingestPdf?: (file: File) => Promise<{ title: string; folder: string }>;
    /** Audio → text; enables the mic button. */
    transcriber?: (audio: Blob) => Promise<string>;
}) {
    const [text, setText] = useState("");
    const [images, setImages] = useState<FileUIPart[]>([]);
    const [notice, setNotice] = useState<string | null>(null);
    const [recording, setRecording] = useState(false);
    const [transcribing, setTranscribing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const recorderRef = useRef(new MicRecorder());

    const submit = () => {
        const trimmed = text.trim();
        if ((!trimmed && images.length === 0) || busy || disabled) return;
        setText("");
        setImages([]);
        setNotice(null);
        onSend(trimmed, images);
    };

    const handleFiles = async (files: FileList | null) => {
        if (!files) return;
        setNotice(null);
        try {
            for (const file of Array.from(files)) {
                if (file.type.startsWith("image/")) {
                    if (!visionEnabled)
                        throw new Error("this model does not accept images");
                    const part = await fileToImagePart(file);
                    setImages((prev) => [...prev, part]);
                } else if (file.type === "application/pdf" && ingestPdf) {
                    const doc = await ingestPdf(file);
                    setText(
                        (t) =>
                            `${t}${t ? "\n" : ""}(I just added the document "${doc.title}" to ${doc.folder}.) `,
                    );
                } else {
                    throw new Error(
                        `unsupported file type: ${file.type || file.name}`,
                    );
                }
            }
        } catch (e) {
            setNotice(e instanceof Error ? e.message : String(e));
        }
    };

    const toggleMic = async () => {
        if (!transcriber) return;
        setNotice(null);
        try {
            if (recording) {
                setRecording(false);
                setTranscribing(true);
                const audio = await recorderRef.current.stop();
                const transcript = await transcriber(audio);
                setText((t) => (t ? `${t} ${transcript}` : transcript));
            } else {
                await recorderRef.current.start();
                setRecording(true);
            }
        } catch (e) {
            setRecording(false);
            setNotice(e instanceof Error ? e.message : String(e));
        } finally {
            setTranscribing(false);
        }
    };

    const attachAccept = [
        visionEnabled ? "image/*" : null,
        ingestPdf ? "application/pdf" : null,
    ]
        .filter(Boolean)
        .join(",");

    return (
        <div className="border-t border-border">
            {(images.length > 0 || notice) && (
                <div className="flex flex-wrap items-center gap-2 px-3 pt-2">
                    {images.map((img, i) => (
                        <span
                            key={i}
                            className="flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-xs"
                        >
                            🖼 {img.filename ?? "image"}
                            <button
                                aria-label="Remove attachment"
                                onClick={() =>
                                    setImages((prev) =>
                                        prev.filter((_, j) => j !== i),
                                    )
                                }
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </span>
                    ))}
                    {notice && (
                        <span className="text-xs text-destructive">
                            {notice}
                        </span>
                    )}
                </div>
            )}
            <div className="flex items-end gap-2 p-3">
                {attachAccept && (
                    <>
                        <input
                            ref={fileInputRef}
                            type="file"
                            hidden
                            multiple
                            accept={attachAccept}
                            onChange={(e) => {
                                void handleFiles(e.target.files);
                                e.target.value = "";
                            }}
                        />
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Attach image or PDF"
                            disabled={disabled}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <Paperclip className="h-4 w-4" />
                        </Button>
                    </>
                )}
                {transcriber && (
                    <Button
                        variant={recording ? "destructive" : "ghost"}
                        size="icon"
                        aria-label={
                            recording ? "Stop recording" : "Record voice input"
                        }
                        disabled={disabled || transcribing}
                        onClick={() => void toggleMic()}
                    >
                        <Mic className="h-4 w-4" />
                    </Button>
                )}
                <Textarea
                    rows={2}
                    className="flex-1 resize-none"
                    placeholder={
                        disabled
                            ? "Start a chat first"
                            : transcribing
                              ? "Transcribing…"
                              : "Message… (Enter to send)"
                    }
                    value={text}
                    disabled={disabled}
                    onChange={(e) => setText(e.target.value)}
                    onPaste={(e) => {
                        if (e.clipboardData.files.length > 0) {
                            e.preventDefault();
                            void handleFiles(e.clipboardData.files);
                        }
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            submit();
                        }
                    }}
                />
                {busy ? (
                    <Button
                        variant="destructive"
                        size="icon"
                        aria-label="Stop"
                        onClick={onStop}
                    >
                        <Square className="h-4 w-4" />
                    </Button>
                ) : (
                    <Button
                        size="icon"
                        aria-label="Send"
                        onClick={submit}
                        disabled={disabled}
                    >
                        <SendHorizonal className="h-4 w-4" />
                    </Button>
                )}
            </div>
        </div>
    );
}
