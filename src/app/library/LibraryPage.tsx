import { useCallback, useEffect, useState } from "react";
import { Copy, ExternalLink, Plus, Trash2 } from "lucide-react";
import * as lib from "@/db/repo/library";
import { openExternal } from "@/lib/openExternal";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Bookmark, Snippet } from "@/lib/schemas";

export function LibraryPage() {
    const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
    const [snippets, setSnippets] = useState<Snippet[]>([]);

    const reload = useCallback(async () => {
        setBookmarks(await lib.listBookmarks());
        setSnippets(await lib.listSnippets());
    }, []);
    useEffect(() => {
        void reload();
    }, [reload]);

    return (
        <div className="h-full overflow-y-auto p-6">
            <div className="mx-auto flex max-w-3xl flex-col gap-6">
                <header>
                    <h1 className="font-display text-2xl font-bold tracking-wide">
                        Library
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Bookmarks and snippets — all reachable from ⌘K.
                    </p>
                </header>
                <BookmarksCard bookmarks={bookmarks} reload={reload} />
                <SnippetsCard snippets={snippets} reload={reload} />
            </div>
        </div>
    );
}

function BookmarksCard({
    bookmarks,
    reload,
}: {
    bookmarks: Bookmark[];
    reload: () => Promise<void>;
}) {
    const [title, setTitle] = useState("");
    const [url, setUrl] = useState("");
    const [group, setGroup] = useState("School");
    const groups = [...new Set(bookmarks.map((b) => b.group_name))];

    const add = async () => {
        if (!title.trim() || !url.trim()) return;
        await lib.createBookmark({ title, url, groupName: group || "General" });
        setTitle("");
        setUrl("");
        await reload();
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Bookmarks</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
                {groups.map((g) => (
                    <div key={g} className="flex flex-col gap-1">
                        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                            {g}
                        </span>
                        {bookmarks
                            .filter((b) => b.group_name === g)
                            .map((b) => (
                                <div
                                    key={b.id}
                                    className="flex items-center gap-2 text-sm"
                                >
                                    <button
                                        className="flex-1 cursor-pointer truncate text-left hover:text-primary"
                                        onClick={() =>
                                            void openExternal(b.url)
                                        }
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
                                                .then(reload)
                                        }
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            ))}
                    </div>
                ))}
                <div className="flex items-end gap-2">
                    <label className="flex flex-1 flex-col gap-1 text-sm">
                        Title
                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                    </label>
                    <label className="flex flex-1 flex-col gap-1 text-sm">
                        URL
                        <Input
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                        />
                    </label>
                    <label className="flex w-32 flex-col gap-1 text-sm">
                        Group
                        <Input
                            value={group}
                            onChange={(e) => setGroup(e.target.value)}
                        />
                    </label>
                    <Button onClick={() => void add()} aria-label="Add bookmark">
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

function SnippetsCard({
    snippets,
    reload,
}: {
    snippets: Snippet[];
    reload: () => Promise<void>;
}) {
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [copied, setCopied] = useState<string | null>(null);

    const add = async () => {
        if (!title.trim() || !body.trim()) return;
        await lib.createSnippet({ title, body });
        setTitle("");
        setBody("");
        await reload();
    };

    const copy = async (s: Snippet) => {
        await navigator.clipboard.writeText(s.body);
        setCopied(s.id);
        setTimeout(() => setCopied(null), 1200);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Snippets</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
                {snippets.map((s) => (
                    <div key={s.id} className="flex items-center gap-2 text-sm">
                        <span className="w-40 truncate">{s.title}</span>
                        <code className="flex-1 truncate rounded-sm bg-muted px-1.5 py-0.5 font-mono text-xs">
                            {s.body}
                        </code>
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Copy ${s.title}`}
                            onClick={() => void copy(s)}
                        >
                            <Copy className="h-3.5 w-3.5" />
                        </Button>
                        {copied === s.id && (
                            <span className="font-mono text-[10px] uppercase text-success">
                                copied
                            </span>
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Delete ${s.title}`}
                            onClick={() =>
                                void lib.deleteSnippet(s.id).then(reload)
                            }
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                ))}
                <div className="flex items-end gap-2">
                    <label className="flex w-48 flex-col gap-1 text-sm">
                        Title
                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                    </label>
                    <label className="flex flex-1 flex-col gap-1 text-sm">
                        Body
                        <Textarea
                            rows={1}
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                        />
                    </label>
                    <Button onClick={() => void add()} aria-label="Add snippet">
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
