import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import * as appsRepo from "@/db/repo/applications";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Application, ApplicationStatus } from "@/lib/schemas";

const COLUMNS: { status: ApplicationStatus; label: string }[] = [
    { status: "interested", label: "Interested" },
    { status: "applied", label: "Applied" },
    { status: "oa", label: "OA" },
    { status: "interview", label: "Interview" },
    { status: "offer", label: "Offer" },
];
const CLOSED: ApplicationStatus[] = ["rejected", "ghosted"];
const ALL_STATUSES = [...COLUMNS.map((c) => c.status), ...CLOSED];

export function ApplicationsPage() {
    const [apps, setApps] = useState<Application[]>([]);
    const [showClosed, setShowClosed] = useState(false);
    const [editing, setEditing] = useState<Application | "new" | null>(null);
    const [error, setError] = useState<string | null>(null);

    const reload = useCallback(async () => {
        setApps(await appsRepo.listApplications());
    }, []);
    useEffect(() => {
        void reload();
    }, [reload]);

    const act = async (fn: () => Promise<unknown>) => {
        setError(null);
        try {
            await fn();
            await reload();
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    };

    const closed = apps.filter((a) => CLOSED.includes(a.status));

    return (
        <div className="h-full overflow-y-auto p-6">
            <div className="mx-auto flex max-w-6xl flex-col gap-6">
                <header className="flex items-end justify-between">
                    <div>
                        <h1 className="font-display text-2xl font-semibold tracking-wide">
                            Applications
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {apps.length} tracked ·{" "}
                            {apps.filter((a) => a.status === "applied").length}{" "}
                            in flight · {closed.length} closed
                        </p>
                    </div>
                    <Button onClick={() => setEditing("new")}>
                        <Plus className="mr-1 h-3.5 w-3.5" /> Track application
                    </Button>
                </header>
                {error && <p className="text-xs text-destructive">{error}</p>}

                {editing && (
                    <ApplicationEditor
                        key={editing === "new" ? "new" : editing.id}
                        application={editing === "new" ? null : editing}
                        onDone={async () => {
                            setEditing(null);
                            await reload();
                        }}
                    />
                )}

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                    {COLUMNS.map((col) => (
                        <div key={col.status} className="flex flex-col gap-2">
                            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                                {col.label} ·{" "}
                                {apps.filter((a) => a.status === col.status).length}
                            </div>
                            {apps
                                .filter((a) => a.status === col.status)
                                .map((a) => (
                                    <AppCard
                                        key={a.id}
                                        app={a}
                                        act={act}
                                        onEdit={() => setEditing(a)}
                                    />
                                ))}
                        </div>
                    ))}
                </div>

                <button
                    className="cursor-pointer self-start font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
                    onClick={() => setShowClosed((s) => !s)}
                >
                    {showClosed ? "hide" : "show"} closed ({closed.length})
                </button>
                {showClosed && (
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        {closed.map((a) => (
                            <AppCard
                                key={a.id}
                                app={a}
                                act={act}
                                onEdit={() => setEditing(a)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function AppCard({
    app,
    act,
    onEdit,
}: {
    app: Application;
    act: (fn: () => Promise<unknown>) => Promise<void>;
    onEdit: () => void;
}) {
    const followUpDue =
        app.next_action_at !== null && app.next_action_at <= Date.now();
    return (
        <Card className="flex flex-col gap-2 p-3">
            <button
                onClick={onEdit}
                className="cursor-pointer text-left text-sm font-medium hover:text-primary"
            >
                {app.company}
            </button>
            <span className="text-xs text-muted-foreground">{app.role}</span>
            {app.next_action && (
                <Badge tone={followUpDue ? "warning" : "neutral"}>
                    {app.next_action}
                </Badge>
            )}
            <div className="flex items-center gap-1">
                <Select
                    aria-label={`Status of ${app.company}`}
                    value={app.status}
                    onChange={(e) =>
                        void act(() =>
                            appsRepo.setApplicationStatus(
                                app.id,
                                e.target.value as ApplicationStatus,
                            ),
                        )
                    }
                    className="flex-1 text-xs"
                >
                    {ALL_STATUSES.map((s) => (
                        <option key={s} value={s}>
                            {s}
                        </option>
                    ))}
                </Select>
                {app.url && (
                    <a
                        href={app.url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Open ${app.company} posting`}
                        className="p-1 text-muted-foreground hover:text-primary"
                    >
                        <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                )}
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${app.company}`}
                    onClick={() =>
                        void act(() => appsRepo.deleteApplication(app.id))
                    }
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            </div>
        </Card>
    );
}

function ApplicationEditor({
    application,
    onDone,
}: {
    application: Application | null;
    onDone: () => Promise<void>;
}) {
    const [company, setCompany] = useState(application?.company ?? "");
    const [role, setRole] = useState(application?.role ?? "");
    const [url, setUrl] = useState(application?.url ?? "");
    const [notes, setNotes] = useState(application?.notes ?? "");
    const [nextAction, setNextAction] = useState(application?.next_action ?? "");
    const [nextActionAt, setNextActionAt] = useState(
        application?.next_action_at
            ? new Date(application.next_action_at).toISOString().slice(0, 16)
            : "",
    );
    const [error, setError] = useState<string | null>(null);

    const save = async () => {
        setError(null);
        try {
            const fields = {
                company,
                role,
                url: url || null,
                notes: notes || null,
                nextAction: nextAction || null,
                nextActionAt: nextActionAt
                    ? new Date(nextActionAt).getTime()
                    : null,
            };
            if (application)
                await appsRepo.updateApplication(application.id, fields);
            else {
                const created = await appsRepo.createApplication(fields);
                if (fields.nextAction || fields.nextActionAt)
                    await appsRepo.updateApplication(created.id, fields);
            }
            await onDone();
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>
                    {application
                        ? `Edit ${application.company}`
                        : "Track application"}
                </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
                <div className="flex gap-3">
                    <label className="flex flex-1 flex-col gap-1 text-sm">
                        Company
                        <Input
                            value={company}
                            onChange={(e) => setCompany(e.target.value)}
                        />
                    </label>
                    <label className="flex flex-1 flex-col gap-1 text-sm">
                        Role
                        <Input
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                        />
                    </label>
                </div>
                <label className="flex flex-col gap-1 text-sm">
                    Posting URL
                    <Input value={url} onChange={(e) => setUrl(e.target.value)} />
                </label>
                <div className="flex gap-3">
                    <label className="flex flex-1 flex-col gap-1 text-sm">
                        Next action
                        <Input
                            value={nextAction}
                            placeholder="e.g. follow up with recruiter"
                            onChange={(e) => setNextAction(e.target.value)}
                        />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                        When
                        <Input
                            type="datetime-local"
                            value={nextActionAt}
                            onChange={(e) => setNextActionAt(e.target.value)}
                        />
                    </label>
                </div>
                <label className="flex flex-col gap-1 text-sm">
                    Notes
                    <Textarea
                        rows={3}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                    />
                </label>
                <div className="flex items-center gap-3">
                    <Button onClick={() => void save()}>Save</Button>
                    <Button variant="ghost" onClick={() => void onDone()}>
                        Cancel
                    </Button>
                    {error && (
                        <span className="text-xs text-destructive">{error}</span>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
