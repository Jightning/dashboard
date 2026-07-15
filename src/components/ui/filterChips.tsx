import { cn } from "@/lib/utils";

export interface FilterOption {
    id: string;
    label: string;
    color?: string;
}

/**
 * One-tap category filter row: "All" plus one chip per option.
 * Renders nothing when there are no options — no chrome for empty categories.
 */
export function FilterChips({
    options,
    active,
    onChange,
    allLabel = "All",
}: {
    options: FilterOption[];
    active: string | null;
    onChange: (id: string | null) => void;
    allLabel?: string;
}) {
    if (options.length === 0) return null;
    const chip = (selected: boolean, color?: string) =>
        cn(
            "cursor-pointer rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider transition-colors duration-(--dur-fast) focus-visible:outline-2 focus-visible:outline-ring",
            selected
                ? "border-primary/50 bg-primary/15 text-primary"
                : "border-border text-muted-foreground hover:text-foreground",
            selected && color && "text-[inherit]",
        );
    return (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter">
            <button className={chip(active === null)} onClick={() => onChange(null)}>
                {allLabel}
            </button>
            {options.map((o) => (
                <button
                    key={o.id}
                    className={chip(active === o.id, o.color)}
                    style={
                        active === o.id && o.color
                            ? {
                                  color: o.color,
                                  borderColor: `color-mix(in oklab, ${o.color} 50%, transparent)`,
                                  background: `color-mix(in oklab, ${o.color} 12%, transparent)`,
                              }
                            : undefined
                    }
                    onClick={() => onChange(active === o.id ? null : o.id)}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}
