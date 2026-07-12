import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
    /** Draw HUD corner brackets on the panel edge. */
    corners?: boolean;
}

export function Card({ className, corners, ...props }: CardProps) {
    return (
        <div
            className={cn(
                "hud-panel text-card-foreground",
                corners && "hud-corners",
                className,
            )}
            {...props}
        />
    );
}

export function CardHeader({
    className,
    ...props
}: HTMLAttributes<HTMLDivElement>) {
    return (
        <div className={cn("flex flex-col gap-1 p-4", className)} {...props} />
    );
}

export function CardTitle({
    className,
    ...props
}: HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn(
                "font-semibold leading-none tracking-wide",
                className,
            )}
            {...props}
        />
    );
}

export function CardContent({
    className,
    ...props
}: HTMLAttributes<HTMLDivElement>) {
    return <div className={cn("p-4 pt-0", className)} {...props} />;
}
