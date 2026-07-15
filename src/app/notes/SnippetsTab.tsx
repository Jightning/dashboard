import { useCallback, useEffect, useState } from "react";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import * as lib from "@/db/repo/library";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FilterChips } from "@/components/ui/filterChips";
import type { Snippet } from "@/lib/schemas";

export function SnippetsTab() {
    const [snippets, setSnippets] = useState<Snippet[]>([]);
    const [filter, setFilter] = useState<string | null>(null);

    const reload = useCallback(async () => {
        setSnippets(await lib.listSnippets());
    }, []);
    useEffect(() => {
        void reload();
    }, [reload]);

    const groups = [...new Set(snippets.map((s) => s.group_name))];
    const filterOptions = groups.map((g) => ({ id: g, label: g }));
    const visible = snippets.filter((s) => !filter || s.group_name === filter);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Snippets</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
                <FilterChips
                    options={filterOptions}
                    active={filter}
                    onChange={setFilter}
                />
                {visible.map((s) => (
                    <SnippetRow key={s.id} snippet={s} reload={reload} />
                ))}
                <AddSnippetForm reload={reload} />
            </CardContent>
        </Card>
    );
}

function SnippetRow({
    snippet: s,
    reload,
}: {
    snippet: Snippet;
    reload: () => Promise<void>;
}) {
    const [editing, setEditing] = useState(false);
    const [title, setTitle] = useState(s.title);
    const [body, setBody] = useState(s.body);
    const [group, setGroup] = useState(s.group_name);
    const [copied, setCopied] = useState(false);

    const save = async () => {
        if (!title.trim() || !body.trim()) return;
        await lib.updateSnippet(s.id, {
            title,
            body,
            groupName: group || "General",
        });
        setEditing(false);
        await reload();
    };

    const copy = async () => {
        await navigator.clipboard.writeText(s.body);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
    };

    if (editing) {
        return (
            <div className="flex items-end gap-2 text-sm">
                <label className="flex w-48 flex-col gap-1 text-sm">
                    Title
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                </label>
                <label className="flex flex-1 flex-col gap-1 text-sm">
                    Body
                    <Textarea
                        rows={1}
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                    />
                </label>
                <label className="flex w-32 flex-col gap-1 text-sm">
                    Group
                    <Input value={group} onChange={(e) => setGroup(e.target.value)} />
                </label>
                <Button onClick={() => void save()} aria-label="Save snippet">
                    Save
                </Button>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2 text-sm">
            <span className="w-40 truncate">{s.title}</span>
            <code className="flex-1 truncate rounded-sm bg-muted px-1.5 py-0.5 font-mono text-xs">
                {s.body}
            </code>
            <Button
                variant="ghost"
                size="icon"
                aria-label={`Copy ${s.title}`}
                onClick={() => void copy()}
            >
                <Copy className="h-3.5 w-3.5" />
            </Button>
            {copied && (
                <span className="font-mono text-[10px] uppercase text-success">
                    copied
                </span>
            )}
            <Button
                variant="ghost"
                size="icon"
                aria-label={`Edit ${s.title}`}
                onClick={() => setEditing(true)}
            >
                <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${s.title}`}
                onClick={() => void lib.deleteSnippet(s.id).then(reload)}
            >
                <Trash2 className="h-3.5 w-3.5" />
            </Button>
        </div>
    );
}

function AddSnippetForm({ reload }: { reload: () => Promise<void> }) {
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [group, setGroup] = useState("General");

    const add = async () => {
        if (!title.trim() || !body.trim()) return;
        await lib.createSnippet({ title, body, groupName: group || "General" });
        setTitle("");
        setBody("");
        await reload();
    };

    return (
        <div className="flex items-end gap-2">
            <label className="flex w-48 flex-col gap-1 text-sm">
                Title
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm">
                Body
                <Textarea
                    rows={1}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                />
            </label>
            <label className="flex w-32 flex-col gap-1 text-sm">
                Group
                <Input value={group} onChange={(e) => setGroup(e.target.value)} />
            </label>
            <Button onClick={() => void add()} aria-label="Add snippet">
                <Plus className="h-4 w-4" />
            </Button>
        </div>
    );
}
