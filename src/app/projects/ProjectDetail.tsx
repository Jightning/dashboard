import { useCallback, useEffect, useRef, useState } from "react";
import {
    ArrowLeft,
    Check,
    ExternalLink,
    MessageSquare,
    Plus,
    Trash2,
    Upload,
    X,
} from "lucide-react";
import * as projectsRepo from "@/db/repo/projects";
import * as sessionsRepo from "@/db/repo/sessions";
import * as lib from "@/db/repo/library";
import { listAutomations } from "@/db/repo/automations";
import {
    deleteDocument,
    insertDocument,
    listProjectDocuments,
} from "@/db/repo/documents";
import { listPresets } from "@/db/repo/presets";
import { ingestPdf } from "@/ai/multimodal/pdf";
import { openExternal } from "@/lib/openExternal";
import { relativeTime } from "@/components/hud/networkData";
import { SESSION_COLORS } from "@/app/chat/InstancesSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type {
    Automation,
    Bookmark,
    ChatSession,
    Document,
    Preset,
    Project,
} from "@/lib/schemas";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * One project's home: identity (name/description/color), its files, chats,
 * bookmarks, and automations. Documents land in /projects/<slug> so the
 * existing doc_folder permission scoping and search_documents folder filters
 * apply to project files for free.
 */
export function ProjectDetail({
    project,
    onBack,
    onChanged,
    onOpenChat,
}: {
    project: Project;
    onBack: () => void;
    onChanged: () => Promise<void>;
    onOpenChat: (sessionId: string) => void;
}) {
    const [name, setName] = useState(project.name);
    const [description, setDescription] = useState(project.description ?? "");
    const [docs, setDocs] = useState<Document[]>([]);
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
    const [automations, setAutomations] = useState<Automation[]>([]);
    const [presets, setPresets] = useState<Preset[]>([]);
    const [presetId, setPresetId] = useState("");
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const folder = `/projects/${slug}`;

    const refreshDocs = useCallback(async () => {
        setDocs(await listProjectDocuments(project.id));
    }, [project.id]);

    const refreshBookmarks = useCallback(async () => {
        setBookmarks(await lib.listBookmarks({ projectId: project.id }));
    }, [project.id]);

    useEffect(() => {
        void (async () => {
            await refreshDocs();
            await refreshBookmarks();
            setSessions(await sessionsRepo.listSessions({ projectId: project.id }));
            setAutomations(await listAutomations({ projectId: project.id }));
            const ps = await listPresets();
            setPresets(ps);
            setPresetId((cur) => cur || (ps[0]?.id ?? ""));
        })();
    }, [project.id, refreshDocs, refreshBookmarks]);

    const saveIdentity = async (patch: {
        name?: string;
        description?: string | null;
        color?: string | null;
    }) => {
        setError(null);
        try {
            await projectsRepo.updateProject(project.id, patch);
            await onChanged();
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    };

    const upload = async (files: FileList | null) => {
        if (!files) return;
        setError(null);
        try {
            for (const file of Array.from(files)) {
                if (file.type === "application/pdf") {
                    await ingestPdf({
                        data: new Uint8Array(await file.arrayBuffer()),
                        fileName: file.name,
                        folder,
                        projectId: project.id,
                    });
                } else {
                    await insertDocument({
                        title: file.name,
                        contentText: await file.text(),
                        mimeType: file.type || "text/plain",
                        folder,
                        sourceName: file.name,
                        byteSize: file.size,
                        projectId: project.id,
                    });
                }
            }
            await refreshDocs();
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    };

    const newChat = async (preset: Preset) => {
        const session = await sessionsRepo.createSession({
            title: `${project.name} · ${preset.name}`,
            presetId: preset.id,
            permissionLevelId: preset.permission_level_id,
            projectId: project.id,
        });
        onOpenChat(session.id);
    };

    const remove = async () => {
        setError(null);
        try {
            await projectsRepo.deleteProject(project.id);
            await onChanged();
            onBack();
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    };

    return (
        <div className="h-full overflow-y-auto p-6">
            <div className="mx-auto flex max-w-3xl flex-col gap-4">
                <header className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Back to projects"
                            onClick={onBack}
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <Input
                            value={name}
                            placeholder="Project name"
                            onChange={(e) => setName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") e.currentTarget.blur();
                            }}
                            onBlur={() => {
                                if (name.trim() && name.trim() !== project.name)
                                    void saveIdentity({ name: name.trim() });
                                else setName(project.name);
                            }}
                            className="h-9 flex-1 border-transparent bg-transparent font-display text-xl font-semibold tracking-wide hover:border-transparent focus-visible:border-primary/40"
                        />
                        <div className="flex items-center gap-1">
                            {SESSION_COLORS.map((c) => (
                                <button
                                    key={c}
                                    aria-label={`Set color ${c}`}
                                    onClick={() => void saveIdentity({ color: c })}
                                    className={cn(
                                        "h-3.5 w-3.5 cursor-pointer rounded-full border border-transparent hover:scale-110",
                                        project.color === c &&
                                            "ring-1 ring-foreground/60",
                                    )}
                                    style={{ background: c }}
                                />
                            ))}
                        </div>
                    </div>
                    <Input
                        value={description}
                        placeholder="What is this project about?"
                        onChange={(e) => setDescription(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") e.currentTarget.blur();
                        }}
                        onBlur={() => {
                            if ((description.trim() || null) !== project.description)
                                void saveIdentity({
                                    description: description.trim() || null,
                                });
                        }}
                        className="h-8 border-transparent bg-transparent text-sm text-muted-foreground hover:border-transparent focus-visible:border-primary/40"
                    />
                    {error && <p className="text-xs text-destructive">{error}</p>}
                </header>

                <Card corners>
                    <CardHeader className="flex-row items-center justify-between">
                        <CardTitle>Files</CardTitle>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <Upload className="mr-1 h-3.5 w-3.5" /> Upload
                        </Button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="application/pdf,.md,.txt"
                            multiple
                            className="hidden"
                            onChange={(e) => {
                                void upload(e.target.files);
                                e.target.value = "";
                            }}
                        />
                    </CardHeader>
                    <CardContent className="flex flex-col gap-1">
                        {docs.length === 0 && (
                            <p className="text-xs text-muted-foreground">
                                No files yet. PDFs, Markdown, and plain text
                                become searchable by the knowledge agent.
                            </p>
                        )}
                        {docs.map((d) => (
                            <div key={d.id} className="flex items-center gap-2 text-sm">
                                <span className="flex-1 truncate">{d.title}</span>
                                <span className="font-mono text-[10px] text-muted-foreground">
                                    {formatBytes(d.byte_size)}
                                </span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`Delete ${d.title}`}
                                    onClick={() =>
                                        void deleteDocument(d.id).then(refreshDocs)
                                    }
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                <Card corners>
                    <CardHeader>
                        <CardTitle>Chats</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2">
                        {sessions.map((s) => (
                            <button
                                key={s.id}
                                onClick={() => onOpenChat(s.id)}
                                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/50"
                            >
                                <MessageSquare
                                    aria-hidden
                                    className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                                />
                                <span className="flex-1 truncate">{s.title}</span>
                                <span className="font-mono text-[10px] text-muted-foreground">
                                    {relativeTime(s.updated_at)}
                                </span>
                            </button>
                        ))}
                        <div className="flex items-end gap-2">
                            <label className="flex flex-1 flex-col gap-1 text-sm">
                                New chat
                                <Select
                                    value={presetId}
                                    onChange={(e) => setPresetId(e.target.value)}
                                >
                                    {presets.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name}
                                        </option>
                                    ))}
                                </Select>
                            </label>
                            <Button
                                disabled={!presetId}
                                aria-label="Start project chat"
                                onClick={() => {
                                    const preset = presets.find(
                                        (p) => p.id === presetId,
                                    );
                                    if (preset) void newChat(preset);
                                }}
                            >
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card corners>
                    <CardHeader>
                        <CardTitle>Bookmarks</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2">
                        {bookmarks.map((b) => (
                            <div key={b.id} className="flex items-center gap-2 text-sm">
                                <button
                                    className="flex-1 cursor-pointer truncate text-left hover:text-primary"
                                    onClick={() => void openExternal(b.url)}
                                >
                                    {b.title}
                                </button>
                                <span className="max-w-48 truncate font-mono text-[10px] text-muted-foreground">
                                    {b.url}
                                </span>
                                <ExternalLink
                                    aria-hidden
                                    className="h-3 w-3 text-muted-foreground"
                                />
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`Delete ${b.title}`}
                                    onClick={() =>
                                        void lib
                                            .deleteBookmark(b.id)
                                            .then(refreshBookmarks)
                                    }
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        ))}
                        <AddBookmarkRow
                            projectId={project.id}
                            reload={refreshBookmarks}
                        />
                    </CardContent>
                </Card>

                <Card corners>
                    <CardHeader>
                        <CardTitle>Automations</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2">
                        {automations.map((a) => (
                            <div key={a.id} className="flex items-center gap-2 text-sm">
                                <span className="flex-1 truncate">{a.name}</span>
                                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                                    {describeSchedule(a)}
                                </span>
                                <Badge tone={a.enabled ? "success" : "neutral"}>
                                    {a.enabled ? "enabled" : "paused"}
                                </Badge>
                            </div>
                        ))}
                        <p className="text-xs text-muted-foreground">
                            Create or edit automations in Agents → Automations
                            and assign them to this project.
                        </p>
                    </CardContent>
                </Card>

                <footer className="flex items-center gap-2 pb-4">
                    {confirmingDelete ? (
                        <>
                            <span className="text-xs text-muted-foreground">
                                Delete this project? Its chats, files, and
                                bookmarks stay, unfiled.
                            </span>
                            <Button
                                variant="destructive"
                                size="sm"
                                aria-label="Confirm delete project"
                                onClick={() => void remove()}
                            >
                                <Check className="mr-1 h-3.5 w-3.5" /> Delete
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                aria-label="Cancel delete project"
                                onClick={() => setConfirmingDelete(false)}
                            >
                                <X className="mr-1 h-3.5 w-3.5" /> Cancel
                            </Button>
                        </>
                    ) : (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setConfirmingDelete(true)}
                        >
                            <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete project
                        </Button>
                    )}
                </footer>
            </div>
        </div>
    );
}

function AddBookmarkRow({
    projectId,
    reload,
}: {
    projectId: string;
    reload: () => Promise<void>;
}) {
    const [title, setTitle] = useState("");
    const [url, setUrl] = useState("");
    const [group, setGroup] = useState("General");

    const add = async () => {
        if (!title.trim() || !url.trim()) return;
        await lib.createBookmark({
            title,
            url,
            groupName: group || "General",
            projectId,
        });
        setTitle("");
        setUrl("");
        await reload();
    };

    return (
        <div className="flex items-end gap-2">
            <label className="flex flex-1 flex-col gap-1 text-sm">
                Title
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm">
                URL
                <Input value={url} onChange={(e) => setUrl(e.target.value)} />
            </label>
            <label className="flex w-32 flex-col gap-1 text-sm">
                Group
                <Input value={group} onChange={(e) => setGroup(e.target.value)} />
            </label>
            <Button onClick={() => void add()} aria-label="Add bookmark">
                <Plus className="h-4 w-4" />
            </Button>
        </div>
    );
}

function describeSchedule(a: Automation): string {
    switch (a.schedule_kind) {
        case "interval":
            return `every ${a.interval_minutes} min`;
        case "daily":
            return `daily ${a.time_of_day}`;
        case "weekly":
            return `${DAYS[a.day_of_week ?? 0]} ${a.time_of_day}`;
    }
}

function formatBytes(n: number | null): string {
    if (n === null) return "—";
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
