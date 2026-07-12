import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ApprovalBroker, ApprovalRequest } from "@/ai/permissions/broker";

/**
 * Renders pending tool-call approvals from the broker. Works for tools run by
 * the orchestrator and by nested specialist agents alike.
 */
export function ApprovalCards({ broker }: { broker: ApprovalBroker }) {
    const [pending, setPending] = useState<ApprovalRequest[]>([]);

    useEffect(() => broker.subscribe(setPending), [broker]);

    if (pending.length === 0) return null;

    return (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
            {pending.map((req) => (
                <motion.div
                    key={req.id}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.25, ease: [0.34, 1.4, 0.64, 1] }}
                    className="hud-panel hud-corners border-warning/50 p-4 shadow-[0_0_18px_oklch(0.79_0.14_80/20%)]"
                    style={
                        {
                            "--corner-color": "var(--warning)",
                        } as React.CSSProperties
                    }
                >
                    <div className="mb-2 flex items-center gap-2">
                        <ShieldAlert
                            aria-hidden
                            className="animate-pulse-core h-4 w-4 text-warning"
                        />
                        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-warning">
                            approval required
                        </span>
                    </div>
                    <div className="mb-1 text-sm">
                        The AI wants to run{" "}
                        <code className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-xs text-warning">
                            {req.tool}
                        </code>
                    </div>
                    <div className="mb-2 font-mono text-xs text-muted-foreground">
                        {req.scope.access} access · {scopeLabel(req)}
                    </div>
                    <pre className="mb-3 max-h-32 overflow-auto rounded-sm border border-border bg-background/60 p-2 font-mono text-xs">
                        {JSON.stringify(req.input, null, 2)}
                    </pre>
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            onClick={() => broker.respond(req.id, "allow-once")}
                        >
                            Allow once
                        </Button>
                        <Button
                            size="sm"
                            variant="hud"
                            onClick={() =>
                                broker.respond(req.id, "allow-session")
                            }
                        >
                            Allow for session ({req.scope.scopeValue})
                        </Button>
                        <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => broker.respond(req.id, "deny")}
                        >
                            Deny
                        </Button>
                    </div>
                </motion.div>
            ))}
        </div>
    );
}

function scopeLabel(req: ApprovalRequest): string {
    return req.scope.scopeType === "doc_folder"
        ? `folder ${req.scope.scopeValue}`
        : `domain ${req.scope.scopeValue}`;
}
