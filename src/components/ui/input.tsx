import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const fieldClasses =
    "w-full rounded-md border border-input bg-background/50 text-sm placeholder:text-muted-foreground transition-[border-color,box-shadow] duration-(--dur-fast) hover:border-primary/40 focus-visible:border-primary/60 focus-visible:outline-none focus-visible:glow-sm disabled:opacity-50";

export function Input({
    className,
    ...props
}: InputHTMLAttributes<HTMLInputElement>) {
    return (
        <input
            className={cn("flex h-9 px-3 py-1", fieldClasses, className)}
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
            className={cn("flex min-h-16 px-3 py-2", fieldClasses, className)}
            {...props}
        />
    );
}
