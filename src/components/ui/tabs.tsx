import { cn } from "@/lib/utils";

export function TabBar<T extends string>({
    tabs,
    active,
    onSelect,
}: {
    tabs: { id: T; label: string }[];
    active: T;
    onSelect: (t: T) => void;
}) {
    return (
        <div className="flex gap-1 border-b border-border">
            {tabs.map((t) => (
                <button
                    key={t.id}
                    onClick={() => onSelect(t.id)}
                    aria-current={active === t.id ? "page" : undefined}
                    className={cn(
                        "cursor-pointer border-b-2 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] transition-colors duration-(--dur-fast) focus-visible:outline-2 focus-visible:outline-ring",
                        active === t.id
                            ? "border-primary text-primary"
                            : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                >
                    {t.label}
                </button>
            ))}
        </div>
    );
}
