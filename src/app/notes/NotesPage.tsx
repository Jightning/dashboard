import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { marked } from "marked";
import { Eye, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import * as notesRepo from "@/db/repo/notes";
import type { Note, NoteSummary } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

marked.setOptions({ breaks: true, gfm: true });

type SaveState = "idle" | "saving" | "saved";

export function NotesPage() {
    const [notes, setNotes] = useState<NoteSummary[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [draft, setDraft] = useState<Note | null>(null);
    const [save, setSave] = useState<SaveState>("idle");
    const [mode, setMode] = useState<"split" | "preview">("split");

    const reloadList = useCallback(async () => {
        setNotes(await notesRepo.listNotes());
    }, []);

    useEffect(() => {
        void reloadList();
    }, [reloadList]);

    // Load the selected note's full body into the editable draft.
    useEffect(() => {
        if (!activeId) {
            setDraft(null);
            return;
        }
        let cancelled = false;
        void notesRepo.getNote(activeId).then((n) => {
            if (!cancelled) {
                setDraft(n);
                setSave("idle");
            }
        });
        return () => {
            cancelled = true;
        };
    }, [activeId]);

    const newNote = async () => {
        const note = await notesRepo.createNote({});
        await reloadList();
        setActiveId(note.id);
    };

    const removeNote = async (id: string) => {
        await notesRepo.deleteNote(id);
        if (activeId === id) setActiveId(null);
        await reloadList();
    };

    // Debounced autosave: write 600ms after the last keystroke.
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const scheduleSave = useCallback(
        (next: Note) => {
            setSave("saving");
            if (saveTimer.current) clearTimeout(saveTimer.current);
            saveTimer.current = setTimeout(() => {
                void notesRepo
                    .updateNote(next.id, {
                        title: next.title,
                        folder: next.folder,
                        bodyMd: next.body_md,
                    })
                    .then(() => {
                        setSave("saved");
                        void reloadList();
                    });
            }, 600);
        },
        [reloadList],
    );

    const edit = (patch: Partial<Note>) => {
        setDraft((d) => {
            if (!d) return d;
            const next = { ...d, ...patch };
            scheduleSave(next);
            return next;
        });
    };

    return (
        <div className="flex h-full">
            <NoteList
                notes={notes}
                activeId={activeId}
                onSelect={setActiveId}
                onNew={() => void newNote()}
                onDelete={(id) => void removeNote(id)}
            />
            <div className="min-w-0 flex-1">
                {draft ? (
                    <NoteEditor
                        key={draft.id}
                        draft={draft}
                        mode={mode}
                        save={save}
                        onEdit={edit}
                        onToggleMode={() =>
                            setMode((m) =>
                                m === "split" ? "preview" : "split",
                            )
                        }
                    />
                ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
                        <FileText className="h-10 w-10 opacity-40" />
                        <p className="text-sm">
                            Select a note, or create a new one.
                        </p>
                        <Button variant="hud" onClick={() => void newNote()}>
                            <Plus className="h-3 w-3" /> New note
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}

function NoteList({
    notes,
    activeId,
    onSelect,
    onNew,
    onDelete,
}: {
    notes: NoteSummary[];
    activeId: string | null;
    onSelect: (id: string) => void;
    onNew: () => void;
    onDelete: (id: string) => void;
}) {
    return (
        <div className="flex w-64 shrink-0 flex-col border-r border-border">
            <div className="flex items-center justify-between px-3 py-3">
                <h1 className="font-display text-lg font-semibold tracking-wide">
                    Notes
                </h1>
                <Button
                    size="icon"
                    variant="ghost"
                    aria-label="New note"
                    onClick={onNew}
                >
                    <Plus className="h-4 w-4" />
                </Button>
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-2">
                {notes.length === 0 && (
                    <p className="px-2 py-4 text-xs text-muted-foreground">
                        No notes yet.
                    </p>
                )}
                {notes.map((note) => (
                    <button
                        key={note.id}
                        onClick={() => onSelect(note.id)}
                        className={cn(
                            "group flex w-full cursor-pointer flex-col gap-0.5 rounded-md border border-transparent px-2.5 py-2 text-left transition-colors duration-(--dur-fast) hover:bg-accent",
                            activeId === note.id &&
                                "border-primary/30 bg-primary/10",
                        )}
                    >
                        <div className="flex items-center gap-1.5">
                            <span
                                className={cn(
                                    "flex-1 truncate text-sm",
                                    activeId === note.id && "text-primary",
                                )}
                            >
                                {note.title || "Untitled"}
                            </span>
                            <Trash2
                                aria-label="Delete note"
                                className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(note.id);
                                }}
                            />
                        </div>
                        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                            {note.folder}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
}

function NoteEditor({
    draft,
    mode,
    save,
    onEdit,
    onToggleMode,
}: {
    draft: Note;
    mode: "split" | "preview";
    save: SaveState;
    onEdit: (patch: Partial<Note>) => void;
    onToggleMode: () => void;
}) {
    const html = useMemo(
        () => marked.parse(draft.body_md || "*Nothing here yet.*") as string,
        [draft.body_md],
    );

    return (
        <div className="flex h-full flex-col">
            <div className="flex items-center gap-2 border-b border-border px-4 py-2">
                <Input
                    value={draft.title}
                    onChange={(e) => onEdit({ title: e.target.value })}
                    placeholder="Untitled"
                    className="h-8 flex-1 border-transparent bg-transparent text-base font-semibold hover:border-transparent focus-visible:border-primary/40"
                />
                <label className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Folder
                    <Input
                        value={draft.folder}
                        onChange={(e) => onEdit({ folder: e.target.value })}
                        className="h-8 w-32 font-mono text-xs"
                    />
                </label>
                <SaveIndicator state={save} />
                <Button
                    size="icon"
                    variant="ghost"
                    aria-label={
                        mode === "split"
                            ? "Preview only"
                            : "Edit and preview"
                    }
                    onClick={onToggleMode}
                >
                    {mode === "split" ? (
                        <Eye className="h-4 w-4" />
                    ) : (
                        <Pencil className="h-4 w-4" />
                    )}
                </Button>
            </div>
            <div className="flex min-h-0 flex-1">
                {mode === "split" && (
                    <textarea
                        value={draft.body_md}
                        onChange={(e) => onEdit({ body_md: e.target.value })}
                        placeholder="# Start writing…"
                        spellCheck
                        className="h-full flex-1 resize-none border-r border-border bg-transparent p-4 font-mono text-sm leading-relaxed placeholder:text-muted-foreground focus-visible:outline-none"
                    />
                )}
                <div
                    className="markdown h-full flex-1 overflow-y-auto p-4 text-sm"
                    dangerouslySetInnerHTML={{ __html: html }}
                />
            </div>
        </div>
    );
}

function SaveIndicator({ state }: { state: SaveState }) {
    const text =
        state === "saving" ? "saving…" : state === "saved" ? "saved" : "";
    return (
        <span
            className={cn(
                "w-14 font-mono text-[10px] uppercase tracking-wider",
                state === "saved" ? "text-success" : "text-muted-foreground",
            )}
        >
            {text}
        </span>
    );
}
