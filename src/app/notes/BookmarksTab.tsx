import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import * as lib from "@/db/repo/library";
import { listProjects } from "@/db/repo/projects";
import { openExternal } from "@/lib/openExternal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FilterChips } from "@/components/ui/filterChips";
import type { Bookmark, Project } from "@/lib/schemas";

export function BookmarksTab() {
    const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [filter, setFilter] = useState<string | null>(null);

    const reload = useCallback(async () => {
        setBookmarks(await lib.listBookmarks());
        setProjects(await listProjects());
    }, []);
    useEffect(() => {
        void reload();
    }, [reload]);

    const groups = [...new Set(bookmarks.map((b) => b.group_name))];
    const filterOptions = [
        ...groups.map((g) => ({ id: `grp:${g}`, label: g })),
        ...projects.map((p) => ({
            id: `prj:${p.id}`,
            label: p.name,
            color: p.color ?? undefined,
        })),
    ];
    const visible = bookmarks.filter((b) => {
        if (!filter) return true;
        if (filter.startsWith("grp:")) return b.group_name === filter.slice(4);
        return b.project_id === filter.slice(4);
    });
    const visibleGroups = [...new Set(visible.map((b) => b.group_name))];
    const projectName = (id: string | null) =>
        id ? projects.find((p) => p.id === id)?.name : undefined;
    const projectColor = (id: string | null) =>
        id ? (projects.find((p) => p.id === id)?.color ?? undefined) : undefined;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Bookmarks</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
                <FilterChips
                    options={filterOptions}
                    active={filter}
                    onChange={setFilter}
                />
                {visibleGroups.map((g) => (
                    <div key={g} className="flex flex-col gap-1">
                        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                            {g}
                        </span>
                        {visible
                            .filter((b) => b.group_name === g)
                            .map((b) => (
                                <BookmarkRow
                                    key={b.id}
                                    bookmark={b}
                                    projects={projects}
                                    projectName={projectName(b.project_id)}
                                    projectColor={projectColor(b.project_id)}
                                    reload={reload}
                                />
                            ))}
                    </div>
                ))}
                <AddBookmarkForm projects={projects} reload={reload} />
            </CardContent>
        </Card>
    );
}

function BookmarkRow({
    bookmark: b,
    projects,
    projectName,
    projectColor,
    reload,
}: {
    bookmark: Bookmark;
    projects: Project[];
    projectName: string | undefined;
    projectColor: string | undefined;
    reload: () => Promise<void>;
}) {
    const [editing, setEditing] = useState(false);
    const [title, setTitle] = useState(b.title);
    const [url, setUrl] = useState(b.url);
    const [group, setGroup] = useState(b.group_name);
    const [projectId, setProjectId] = useState(b.project_id ?? "");

    const save = async () => {
        if (!title.trim() || !url.trim()) return;
        await lib.updateBookmark(b.id, {
            title,
            url,
            groupName: group || "General",
            projectId: projectId || null,
        });
        setEditing(false);
        await reload();
    };

    if (editing) {
        return (
            <div className="flex items-end gap-2 text-sm">
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
                <label className="flex w-40 flex-col gap-1 text-sm">
                    Project
                    <Select
                        value={projectId}
                        onChange={(e) => setProjectId(e.target.value)}
                    >
                        <option value="">No project</option>
                        {projects.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.name}
                            </option>
                        ))}
                    </Select>
                </label>
                <Button onClick={() => void save()} aria-label="Save bookmark">
                    Save
                </Button>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2 text-sm">
            <button
                className="flex-1 cursor-pointer truncate text-left hover:text-primary"
                onClick={() => void openExternal(b.url)}
            >
                {b.title}
            </button>
            {projectName && (
                <span
                    className="rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider"
                    style={
                        projectColor
                            ? {
                                  color: projectColor,
                                  borderColor: `color-mix(in oklab, ${projectColor} 50%, transparent)`,
                                  background: `color-mix(in oklab, ${projectColor} 12%, transparent)`,
                              }
                            : undefined
                    }
                >
                    {projectName}
                </span>
            )}
            <span className="max-w-48 truncate font-mono text-[10px] text-muted-foreground">
                {b.url}
            </span>
            <ExternalLink aria-hidden className="h-3 w-3 text-muted-foreground" />
            <Button
                variant="ghost"
                size="icon"
                aria-label={`Edit ${b.title}`}
                onClick={() => setEditing(true)}
            >
                <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${b.title}`}
                onClick={() => void lib.deleteBookmark(b.id).then(reload)}
            >
                <Trash2 className="h-3.5 w-3.5" />
            </Button>
        </div>
    );
}

function AddBookmarkForm({
    projects,
    reload,
}: {
    projects: Project[];
    reload: () => Promise<void>;
}) {
    const [title, setTitle] = useState("");
    const [url, setUrl] = useState("");
    const [group, setGroup] = useState("General");
    const [projectId, setProjectId] = useState("");

    const add = async () => {
        if (!title.trim() || !url.trim()) return;
        await lib.createBookmark({
            title,
            url,
            groupName: group || "General",
            projectId: projectId || null,
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
            <label className="flex w-40 flex-col gap-1 text-sm">
                Project
                <Select
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                >
                    <option value="">No project</option>
                    {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                            {p.name}
                        </option>
                    ))}
                </Select>
            </label>
            <Button onClick={() => void add()} aria-label="Add bookmark">
                <Plus className="h-4 w-4" />
            </Button>
        </div>
    );
}
