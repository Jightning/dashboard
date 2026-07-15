import { useEffect, useState } from "react";
import { Command } from "cmdk";
import {
    Bookmark as BookmarkIcon,
    Briefcase,
    CheckSquare,
    FileText,
    NotebookPen,
    Navigation,
    ScrollText,
} from "lucide-react";
import { searchNotes } from "@/db/repo/notes";
import { listOpenTasks, completeTask } from "@/db/repo/tasks";
import { listApplications } from "@/db/repo/applications";
import { searchLibrary, type LibraryHit } from "@/db/repo/library";
import { openExternal } from "@/lib/openExternal";
import type { NavTarget } from "@/app/Sidebar";
import type { Application, Task } from "@/lib/schemas";
import type { NoteSearchHit } from "@/db/repo/notes";

const NAV: { target: NavTarget; label: string }[] = [
    { target: { page: "home" }, label: "Home" },
    { target: { page: "agents", tab: "chat" }, label: "Chat" },
    { target: { page: "agents", tab: "roster" }, label: "Agent roster" },
    { target: { page: "agents", tab: "pipelines" }, label: "Pipelines" },
    { target: { page: "agents", tab: "automations" }, label: "Automations" },
    { target: { page: "notes" }, label: "Notes" },
    { target: { page: "notes", tab: "bookmarks" }, label: "Bookmarks" },
    { target: { page: "notes", tab: "snippets" }, label: "Snippets" },
    { target: { page: "planner", tab: "tasks" }, label: "Tasks" },
    { target: { page: "planner", tab: "calendar" }, label: "Calendar" },
    { target: { page: "planner", tab: "applications" }, label: "Applications" },
    { target: { page: "planner", tab: "review" }, label: "Review" },
    { target: { page: "presets" }, label: "Presets" },
    { target: { page: "permissions" }, label: "Permissions" },
    { target: { page: "settings" }, label: "Settings" },
];

export function CommandPalette({
    onNavigate,
}: {
    onNavigate: (target: NavTarget) => void;
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [notes, setNotes] = useState<NoteSearchHit[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [apps, setApps] = useState<Application[]>([]);
    const [libraryHits, setLibraryHits] = useState<LibraryHit[]>([]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((o) => !o);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    // Fan out searches; tasks/applications are small enough to filter client-side.
    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        const q = query.trim();
        void (async () => {
            const tasks = (await listOpenTasks()).slice(0, 30);
            if (!cancelled) setTasks(tasks);
            const apps = (await listApplications()).slice(0, 30);
            if (!cancelled) setApps(apps);
            if (q.length >= 2) {
                const notes = await searchNotes(q, { limit: 6 });
                if (!cancelled) setNotes(notes);
                const libraryHits = await searchLibrary(q);
                if (!cancelled) setLibraryHits(libraryHits);
            } else {
                if (!cancelled) setNotes([]);
                const libraryHits = await searchLibrary("");
                if (!cancelled) setLibraryHits(libraryHits);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [open, query]);

    const close = () => {
        setOpen(false);
        setQuery("");
    };
    const go = (target: NavTarget) => {
        onNavigate(target);
        close();
    };

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-start justify-center bg-background/60 pt-[15vh]"
            onClick={close}
        >
            <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xl">
                <Command
                    label="Command palette"
                    shouldFilter
                    className="hud-panel hud-corners overflow-hidden rounded-md border border-border"
                >
                    <Command.Input
                        autoFocus
                        value={query}
                        onValueChange={setQuery}
                        placeholder="Search notes, tasks, applications, bookmarks… (esc closes)"
                        onKeyDown={(e) => e.key === "Escape" && close()}
                        className="w-full border-b border-border bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted-foreground"
                    />
                    <Command.List className="max-h-[50vh] overflow-y-auto p-2">
                        <Command.Empty className="p-4 text-center text-xs text-muted-foreground">
                            Nothing matches.
                        </Command.Empty>

                        <Command.Group heading="Go to">
                            {NAV.map((n) => (
                                <Item
                                    key={n.label}
                                    icon={Navigation}
                                    onSelect={() => go(n.target)}
                                >
                                    {n.label}
                                </Item>
                            ))}
                        </Command.Group>

                        {libraryHits.length > 0 && (
                            <Command.Group heading="Library">
                                {libraryHits.map((h) => (
                                    <Item
                                        key={h.id}
                                        icon={
                                            h.kind === "bookmark"
                                                ? BookmarkIcon
                                                : ScrollText
                                        }
                                        onSelect={() => {
                                            if (h.kind === "bookmark")
                                                void openExternal(h.detail);
                                            else
                                                void navigator.clipboard.writeText(
                                                    h.detail,
                                                );
                                            close();
                                        }}
                                    >
                                        {h.title}
                                        <span className="ml-2 truncate font-mono text-[10px] text-muted-foreground">
                                            {h.kind === "bookmark"
                                                ? h.detail
                                                : "copy"}
                                        </span>
                                    </Item>
                                ))}
                            </Command.Group>
                        )}

                        {tasks.length > 0 && (
                            <Command.Group heading="Tasks (enter = complete)">
                                {tasks.map((t) => (
                                    <Item
                                        key={t.id}
                                        icon={CheckSquare}
                                        onSelect={() =>
                                            void completeTask(t.id).then(close)
                                        }
                                    >
                                        {t.title}
                                    </Item>
                                ))}
                            </Command.Group>
                        )}

                        {apps.length > 0 && (
                            <Command.Group heading="Applications">
                                {apps.map((a) => (
                                    <Item
                                        key={a.id}
                                        icon={Briefcase}
                                        onSelect={() =>
                                            go({
                                                page: "planner",
                                                tab: "applications",
                                            })
                                        }
                                    >
                                        {a.company} — {a.role}
                                        <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                                            {a.status}
                                        </span>
                                    </Item>
                                ))}
                            </Command.Group>
                        )}

                        {notes.length > 0 && (
                            <Command.Group heading="Notes">
                                {notes.map((n) => (
                                    <Item
                                        key={n.id}
                                        icon={NotebookPen}
                                        onSelect={() => go({ page: "notes" })}
                                    >
                                        {n.title}
                                        <span className="ml-2 truncate font-mono text-[10px] text-muted-foreground">
                                            {n.snippet}
                                        </span>
                                    </Item>
                                ))}
                            </Command.Group>
                        )}
                    </Command.List>
                </Command>
            </div>
        </div>
    );
}

function Item({
    icon: Icon,
    onSelect,
    children,
}: {
    icon: typeof FileText;
    onSelect: () => void;
    children: React.ReactNode;
}) {
    return (
        <Command.Item
            onSelect={onSelect}
            className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary"
        >
            <Icon aria-hidden className="h-3.5 w-3.5 shrink-0" />
            <span className="flex min-w-0 flex-1 items-baseline">{children}</span>
        </Command.Item>
    );
}
