import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { listStepRuns } from "@/db/repo/pipelines";
import { createNote } from "@/db/repo/notes";
import type { PipelineRun, PipelineStepRun, RunStatus } from "@/lib/schemas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const TONE: Record<RunStatus, "primary" | "success" | "destructive"> = {
    running: "primary",
    success: "success",
    error: "destructive",
};

export function RunHistory({
    runs,
    pipelineName,
}: {
    runs: PipelineRun[];
    pipelineName: string;
}) {
    if (runs.length === 0)
        return <p className="text-xs text-muted-foreground">No runs yet.</p>;
    return (
        <div className="flex flex-col gap-1.5">
            {runs.map((run) => (
                <RunRow key={run.id} run={run} pipelineName={pipelineName} />
            ))}
        </div>
    );
}

function RunRow({
    run,
    pipelineName,
}: {
    run: PipelineRun;
    pipelineName: string;
}) {
    const [open, setOpen] = useState(false);
    const [steps, setSteps] = useState<PipelineStepRun[]>([]);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (open) void listStepRuns(run.id).then(setSteps);
    }, [open, run.id, run.status]);

    const Chevron = open ? ChevronDown : ChevronRight;
    return (
        <div className="rounded-md border border-border bg-card/60">
            <button
                onClick={() => setOpen((o) => !o)}
                className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-ring"
            >
                <Chevron aria-hidden className="h-3.5 w-3.5 shrink-0" />
                <Badge tone={TONE[run.status]}>{run.status}</Badge>
                <span className="flex-1 truncate font-mono text-xs text-muted-foreground">
                    {run.input || "(no input)"}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                    {new Date(run.started_at).toLocaleString()}
                </span>
            </button>
            {open && (
                <div className="flex flex-col gap-2 border-t border-border p-3">
                    {run.error && (
                        <p className="font-mono text-xs text-destructive">
                            {run.error}
                        </p>
                    )}
                    {steps.map((s) => (
                        <div key={s.id} className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                                    step {s.position}
                                </span>
                                <Badge tone={TONE[s.status]}>{s.status}</Badge>
                            </div>
                            <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-sm border border-border bg-background/60 p-2 font-mono text-xs">
                                {s.output ?? s.error ?? s.prompt}
                            </pre>
                        </div>
                    ))}
                    {run.status === "success" && steps.length > 0 && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="self-start"
                            disabled={saved}
                            onClick={() => {
                                const last = steps[steps.length - 1];
                                if (!last?.output) return;
                                void createNote({
                                    title: `${pipelineName} — ${new Date(run.started_at).toLocaleDateString()}`,
                                    folder: "/pipelines",
                                    bodyMd: last.output,
                                }).then(() => setSaved(true));
                            }}
                        >
                            {saved ? "Saved to /pipelines" : "Save as note"}
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}
