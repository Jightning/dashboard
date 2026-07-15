import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import * as repo from "@/db/repo/permissions";
import type { PermissionGrant, PermissionLevel } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Tools a grant can currently target; grows as dashboard features land. */
const KNOWN_TOOLS = [
    "search_documents",
    "read_document",
    "list_documents",
    "search_notes",
    "read_note",
    "list_notes",
    "fetch_url",
];

export function PermissionsPage() {
    const [levels, setLevels] = useState<PermissionLevel[]>([]);
    const [grants, setGrants] = useState<Record<string, PermissionGrant[]>>({});
    const [newLevelName, setNewLevelName] = useState("");

    const reload = useCallback(async () => {
        const all = await repo.listLevels();
        setLevels(all);
        const byLevel: Record<string, PermissionGrant[]> = {};
        for (const level of all)
            byLevel[level.id] = await repo.listGrants(level.id);
        setGrants(byLevel);
    }, []);

    useEffect(() => {
        void reload();
    }, [reload]);

    const createLevel = async () => {
        if (!newLevelName.trim()) return;
        await repo.createLevel(newLevelName.trim());
        setNewLevelName("");
        await reload();
    };

    return (
        <div className="h-full overflow-y-auto p-6">
            <div className="mx-auto flex max-w-2xl flex-col gap-4">
                <header>
                    <h1 className="font-display text-2xl font-semibold tracking-wide">
                        Permissions
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        A permission level is a named set of scoped grants. Pick
                        one per chat; anything a level doesn't grant still shows
                        an approval card.
                    </p>
                </header>

                {levels.map((level) => (
                    <LevelCard
                        key={level.id}
                        level={level}
                        grants={grants[level.id] ?? []}
                        onChanged={reload}
                    />
                ))}

                <div className="flex gap-2">
                    <Input
                        placeholder="New level name (e.g. Study)"
                        value={newLevelName}
                        onChange={(e) => setNewLevelName(e.target.value)}
                        onKeyDown={(e) =>
                            e.key === "Enter" && void createLevel()
                        }
                    />
                    <Button onClick={() => void createLevel()}>
                        Add level
                    </Button>
                </div>
            </div>
        </div>
    );
}

function LevelCard({
    level,
    grants,
    onChanged,
}: {
    level: PermissionLevel;
    grants: PermissionGrant[];
    onChanged: () => Promise<void>;
}) {
    const [tool, setTool] = useState(KNOWN_TOOLS[0]!);
    const [access, setAccess] = useState<"read" | "write">("read");
    const [scopeType, setScopeType] = useState<
        "any" | "doc_folder" | "url_domain"
    >("any");
    const [scopeValue, setScopeValue] = useState("");
    const [error, setError] = useState<string | null>(null);

    const addGrant = async () => {
        setError(null);
        try {
            await repo.addGrant({
                levelId: level.id,
                tool,
                access,
                scopeType,
                scopeValue: scopeValue.trim() || null,
            });
            setScopeValue("");
            await onChanged();
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    };

    return (
        <Card>
            <CardHeader className="flex-row items-center justify-between">
                <div>
                    <CardTitle>{level.name}</CardTitle>
                    {level.description && (
                        <p className="text-xs text-muted-foreground">
                            {level.description}
                        </p>
                    )}
                </div>
                {!level.is_builtin && (
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete level"
                        onClick={() =>
                            void repo.deleteLevel(level.id).then(onChanged)
                        }
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                )}
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
                {grants.length === 0 && (
                    <div className="text-xs text-muted-foreground">
                        No grants — every tool call asks for approval.
                    </div>
                )}
                {grants.map((g) => (
                    <div key={g.id} className="flex items-center gap-2 text-sm">
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                            {g.tool}
                        </code>
                        <span className="text-xs uppercase text-muted-foreground">
                            {g.access}
                        </span>
                        <span className="flex-1 text-xs text-muted-foreground">
                            {g.scope_type === "any"
                                ? "any scope"
                                : `${g.scope_type}: ${g.scope_value}`}
                        </span>
                        {!level.is_builtin && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                aria-label="Remove grant"
                                onClick={() =>
                                    void repo.removeGrant(g.id).then(onChanged)
                                }
                            >
                                <Trash2 className="h-3 w-3" />
                            </Button>
                        )}
                    </div>
                ))}

                {!level.is_builtin && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Select
                            value={tool}
                            onChange={(e) => setTool(e.target.value)}
                        >
                            {KNOWN_TOOLS.map((t) => (
                                <option key={t}>{t}</option>
                            ))}
                        </Select>
                        <Select
                            value={access}
                            onChange={(e) =>
                                setAccess(e.target.value as "read" | "write")
                            }
                        >
                            <option value="read">read</option>
                            <option value="write">write</option>
                        </Select>
                        <Select
                            value={scopeType}
                            onChange={(e) =>
                                setScopeType(
                                    e.target.value as
                                        | "any"
                                        | "doc_folder"
                                        | "url_domain",
                                )
                            }
                        >
                            <option value="any">any scope</option>
                            <option value="doc_folder">folder</option>
                            <option value="url_domain">domain</option>
                        </Select>
                        {scopeType !== "any" && (
                            <Input
                                className="w-40"
                                placeholder={
                                    scopeType === "doc_folder"
                                        ? "/school"
                                        : "example.com"
                                }
                                value={scopeValue}
                                onChange={(e) => setScopeValue(e.target.value)}
                            />
                        )}
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void addGrant()}
                        >
                            Add grant
                        </Button>
                        {error && (
                            <span className="text-xs text-destructive">
                                {error}
                            </span>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
