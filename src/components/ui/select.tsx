import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Select({
    className,
    ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
    return (
        <select
            className={cn(
                "flex h-9 cursor-pointer rounded-md border border-input bg-background/50 px-3 py-1 text-sm transition-[border-color,box-shadow] duration-(--dur-fast) hover:border-primary/40 focus-visible:border-primary/60 focus-visible:outline-none focus-visible:glow-sm disabled:opacity-50 [&>option]:bg-background [&>option]:text-foreground",
                className,
            )}
            {...props}
        />
    );
}
