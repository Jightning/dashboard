import { useEffect, useRef, useState } from "react";
import {
    Image as ImageIcon,
    Mic,
    Paperclip,
    SendHorizonal,
    Square,
    X,
} from "lucide-react";
import type { FileUIPart } from "ai";
import { Button } from "@/components/ui/button";
import { fileToImagePart } from "@/ai/multimodal/image";
import { MicRecorder } from "@/ai/multimodal/stt";
import { cn } from "@/lib/utils";

export function Composer({
    disabled,
    busy,
    onSend,
    onStop,
    visionEnabled,
    ingestPdf,
    transcriber,
    draftKey,
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
    /** Key to persist an in-progress draft under (e.g. the session id). */
    draftKey?: string;
}) {
    const [text, setText] = useState(() => {
        if (!draftKey) return "";
        try {
            return localStorage.getItem(`hugh.draft.${draftKey}`) ?? "";
        } catch {
            return "";
        }
    });
    const [images, setImages] = useState<FileUIPart[]>([]);
    const [notice, setNotice] = useState<string | null>(null);
    const [recording, setRecording] = useState(false);
    const [transcribing, setTranscribing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const recorderRef = useRef(new MicRecorder());
    const taRef = useRef<HTMLTextAreaElement>(null);

    // One line (36px = h-9, matching the icon buttons) when empty; grows with
    // content up to max-h-40, then scrolls. Runs on every text change,
    // including the post-send reset to "".
    useEffect(() => {
        const ta = taRef.current;
        if (!ta) return;
        ta.style.height = "auto";
        ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
    }, [text]);

    // Persist the draft, debounced; clear the key when the draft empties.
    useEffect(() => {
        if (!draftKey) return;
        const key = `hugh.draft.${draftKey}`;
        const handle = setTimeout(() => {
            try {
                if (text) localStorage.setItem(key, text);
                else localStorage.removeItem(key);
            } catch {
                // best-effort
            }
        }, 300);
        return () => {
            clearTimeout(handle);
            // Flush synchronously on unmount/session switch so a pending
            // debounced write isn't silently dropped (e.g. typing then
            // immediately switching sessions).
            try {
                if (text) localStorage.setItem(key, text);
                else localStorage.removeItem(key);
            } catch {
                // best-effort
            }
        };
    }, [draftKey, text]);

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
        <div className="px-4 pb-4 pt-1">
            <div className="hud-panel hud-corners mx-auto max-w-3xl">
                {(images.length > 0 || notice) && (
                    <div className="flex flex-wrap items-center gap-2 px-3 pt-2">
                        {images.map((img, i) => (
                            <span
                                key={i}
                                className="flex items-center gap-1.5 rounded-sm border border-primary/40 bg-primary/10 px-1.5 py-0.5 font-mono text-xs text-primary"
                            >
                                <ImageIcon aria-hidden className="h-3 w-3" />
                                {img.filename ?? "image"}
                                <button
                                    aria-label="Remove attachment"
                                    className="cursor-pointer hover:text-foreground"
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
                            <span className="font-mono text-xs text-destructive">
                                {notice}
                            </span>
                        )}
                    </div>
                )}
                <div className="flex items-end gap-1.5 p-2">
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
                            className={cn(
                                recording &&
                                    "animate-pulse-core shadow-[0_0_14px_var(--destructive)]",
                            )}
                            aria-label={
                                recording
                                    ? "Stop recording"
                                    : "Record voice input"
                            }
                            disabled={disabled || transcribing}
                            onClick={() => void toggleMic()}
                        >
                            <Mic className="h-4 w-4" />
                        </Button>
                    )}
                    <textarea
                        ref={taRef}
                        rows={1}
                        className="max-h-40 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-5 placeholder:text-muted-foreground focus-visible:outline-none disabled:opacity-50"
                        placeholder={
                            disabled
                                ? "Start a chat first"
                                : transcribing
                                  ? "Transcribing…"
                                  : "Issue a directive… (Enter to send)"
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
        </div>
    );
}
