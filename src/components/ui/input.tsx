import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({
    className,
    ...props
}: InputHTMLAttributes<HTMLInputElement>) {
    return (
        <input
            className={cn(
                "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50",
                className,
            )}
            {...props}
        />
    );
}

export function Textarea({
    className,
    ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
    return (
        <textarea
            className={cn(
                "flex min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50",
                className,
            )}
            {...props}
        />
    );
}
