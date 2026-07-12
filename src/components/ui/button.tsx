import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
    "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[background-color,border-color,box-shadow,transform] duration-(--dur-fast) ease-(--ease-out-expo) active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
    {
        variants: {
            variant: {
                default:
                    "bg-primary text-primary-foreground hover:glow hover:bg-primary/90",
                secondary:
                    "bg-secondary text-secondary-foreground hover:bg-secondary/85",
                outline:
                    "border border-border bg-transparent hover:border-primary/50 hover:bg-accent hover:glow-sm",
                ghost: "hover:bg-accent hover:text-accent-foreground",
                destructive:
                    "bg-destructive text-destructive-foreground hover:bg-destructive/85",
                /* HUD action: outlined cyan, mono uppercase — for command-y actions */
                hud: "border border-primary/40 bg-primary/10 font-mono text-xs uppercase tracking-wider text-primary hover:border-primary/70 hover:bg-primary/20 hover:glow-sm",
            },
            size: {
                default: "h-9 px-4 py-2",
                sm: "h-8 px-3 text-xs",
                icon: "h-9 w-9",
            },
        },
        defaultVariants: { variant: "default", size: "default" },
    },
);

export interface ButtonProps
    extends
        ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
    return (
        <button
            className={cn(buttonVariants({ variant, size }), className)}
            {...props}
        />
    );
}
