import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
    "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider",
    {
        variants: {
            tone: {
                neutral: "border-border text-muted-foreground",
                primary: "border-primary/40 bg-primary/10 text-primary",
                warning: "border-warning/40 bg-warning/10 text-warning",
                success: "border-success/40 bg-success/10 text-success",
                destructive:
                    "border-destructive/40 bg-destructive/10 text-destructive",
            },
        },
        defaultVariants: { tone: "neutral" },
    },
);

export interface BadgeProps
    extends
        HTMLAttributes<HTMLSpanElement>,
        VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
    return (
        <span className={cn(badgeVariants({ tone }), className)} {...props} />
    );
}
