import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
        <div className="flex flex-col gap-2">
            {pending.map((req) => (
                <Card key={req.id} className="border-amber-500/60">
                    <CardHeader className="flex-row items-center gap-2 pb-2">
                        <ShieldAlert className="h-4 w-4 text-amber-500" />
                        <CardTitle className="text-sm">
                            The AI wants to run{" "}
                            <code className="rounded bg-muted px-1">
                                {req.tool}
                            </code>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2">
                        <div className="text-xs text-muted-foreground">
                            {req.scope.access} access · {scopeLabel(req)}
                        </div>
                        <pre className="max-h-32 overflow-auto rounded bg-muted p-2 text-xs">
                            {JSON.stringify(req.input, null, 2)}
                        </pre>
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                onClick={() =>
                                    broker.respond(req.id, "allow-once")
                                }
                            >
                                Allow once
                            </Button>
                            <Button
                                size="sm"
                                variant="secondary"
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
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

function scopeLabel(req: ApprovalRequest): string {
    return req.scope.scopeType === "doc_folder"
        ? `folder ${req.scope.scopeValue}`
        : `domain ${req.scope.scopeValue}`;
}
