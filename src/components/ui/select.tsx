import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Select({
    className,
    ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
    return (
        <select
            className={cn(
                "flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50",
                className,
            )}
            {...props}
        />
    );
}
