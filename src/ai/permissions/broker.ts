import type { ResolvedScope } from "./types";

export type ApprovalVerdict = "allow-once" | "allow-session" | "deny";

export interface ApprovalRequest {
    id: string;
    tool: string;
    input: unknown;
    scope: ResolvedScope;
}

/**
 * Bridges tool execution and the UI. A gated tool awaits `ask()`; the chat UI
 * subscribes, renders an ApprovalCard, and calls `respond()`. Promise-based so
 * it works at any agent nesting depth (orchestrator or specialist), which the
 * AI SDK's transport-level approval flow cannot do for nested agents.
 */
export class ApprovalBroker {
    private listeners = new Set<(pending: ApprovalRequest[]) => void>();
    private pending = new Map<
        string,
        {
            request: ApprovalRequest;
            resolve: (verdict: ApprovalVerdict) => void;
        }
    >();
    private counter = 0;

    ask(request: Omit<ApprovalRequest, "id">): Promise<ApprovalVerdict> {
        const id = `apr_${++this.counter}`;
        return new Promise<ApprovalVerdict>((resolve) => {
            this.pending.set(id, { request: { ...request, id }, resolve });
            this.notify();
        });
    }

    respond(id: string, verdict: ApprovalVerdict): void {
        const entry = this.pending.get(id);
        if (!entry) throw new Error(`no pending approval with id ${id}`);
        this.pending.delete(id);
        entry.resolve(verdict);
        this.notify();
    }

    /** Deny everything outstanding (chat aborted, session switched). */
    denyAll(): void {
        for (const [id] of this.pending) this.respond(id, "deny");
    }

    list(): ApprovalRequest[] {
        return [...this.pending.values()].map((p) => p.request);
    }

    subscribe(listener: (pending: ApprovalRequest[]) => void): () => void {
        this.listeners.add(listener);
        listener(this.list());
        return () => this.listeners.delete(listener);
    }

    private notify(): void {
        const snapshot = this.list();
        for (const l of this.listeners) l(snapshot);
    }
}
